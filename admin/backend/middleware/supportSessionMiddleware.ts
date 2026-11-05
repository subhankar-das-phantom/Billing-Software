/**
 * Bharat Enterprise Billing System — Support Session Diagnostic Guard Middleware
 * Strictly enforces anti-impersonation, read-only boundary gating, and action counter tracking.
 */

import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { PlatformRequest } from '../types';
import PlatformSupportSession from '../models/PlatformSupportSession';
import { getActiveSupportSession } from '../services/supportSessionService';

// Regex identifying routes handling tenant credentials or authentication
const CREDENTIAL_ROUTE_REGEX = /(?:\/api)?\/(?:auth\/(?:update-password|change-password|reset-password|password|register|login|mfa)|credentials)/i;

// Regex identifying core business mutations forbidden during diagnostic support sessions
const BUSINESS_ENTITY_MUTATION_REGEX = /(?:invoices?|bills?|sales?|stocks?|inventory|products?|batch(?:es)?|customers?|suppliers?|payments?|credit-?notes?|manual-?entr(?:y|ies)|ledgers?|balances?|purchases?)/i;

// Allowlist for authorized Tier-2 diagnostic actions
const AUTHORIZED_DIAGNOSTIC_MUTATION_REGEX = /(?:diagnostics\/(?:cache-flush|notification-retry|ping|test-connection)|cache\/flush|notifications\/(?:retry|resend)|support-sessions\/[^/]+\/end|support\/sessions\/[^/]+\/end)/i;

/**
 * Middleware: Enforces that active support sessions remain strictly bounded,
 * read-only for business entities, free of impersonation, and track actions performed.
 */
export async function enforceSupportSessionBounds(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let session = req.supportSession;

    // 1. Check header or query for explicit session identification
    const sessionCodeHeader =
      (req.headers['x-support-session-code'] as string) ||
      (req.headers['x-support-session-id'] as string) ||
      (req.query?.supportSessionCode as string) ||
      (req.query?.supportSessionId as string);

    if (!session && sessionCodeHeader) {
      const foundSession = await PlatformSupportSession.findOne({
        sessionCode: sessionCodeHeader.trim(),
      });

      if (!foundSession) {
        res.status(403).json({
          success: false,
          code: 'SUPPORT_SESSION_EXPIRED',
          error: 'Support session code is invalid.',
        });
        return;
      }

      if (foundSession.status !== 'ACTIVE' || foundSession.expiresAt <= new Date()) {
        if (foundSession.status === 'ACTIVE') {
          foundSession.status = 'EXPIRED' as any;
          foundSession.endedAt = foundSession.expiresAt;
          await foundSession.save();
        }
        res.status(403).json({
          success: false,
          code: 'SUPPORT_SESSION_EXPIRED',
          error: 'Support session has expired or is no longer active.',
        });
        return;
      }

      session = foundSession;
    }

    // 2. Fall back to active session lookup if platform user is authenticated
    if (!session && req.platformUser?._id) {
      const activeSession = await getActiveSupportSession(req.platformUser._id);
      if (activeSession) {
        session = activeSession;
      }
    }

    // If no support session is active or requested, proceed transparently
    if (!session) {
      next();
      return;
    }

    // ─── Anti-Impersonation Invariant ────────────────────────────
    // Operator NEVER receives tenant identity. Purge any attempted identity pollution.
    delete (req as any).user;
    delete (req as any).userRole;
    delete (req as any).userModel;
    delete (req as any).admin;
    delete (req as any).tenantUser;
    delete (req as any).isImpersonated;

    const requestPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;

    // ─── Target Tenant Isolation Guard ────────────────────────────
    const rawTarget = req.params?.id || req.params?.tenantId || req.query?.tenantId;
    const targetTenantParam = Array.isArray(rawTarget) ? rawTarget[0] : rawTarget;
    if (
      targetTenantParam &&
      typeof targetTenantParam === 'string' &&
      Types.ObjectId.isValid(targetTenantParam) &&
      session.targetTenantId &&
      session.targetTenantId.toString() !== targetTenantParam.toString() &&
      requestPath.includes('/tenants/')
    ) {
      res.status(403).json({
        success: false,
        code: 'SUPPORT_SESSION_TENANT_MISMATCH',
        error: 'Active support session is pinned to a different tenant.',
      });
      return;
    }

    // ─── Credential Route Gate ────────────────────────────────────
    // Strictly block credential and password modification routes
    if (CREDENTIAL_ROUTE_REGEX.test(requestPath)) {
      res.status(403).json({
        success: false,
        code: 'SUPPORT_SESSION_READ_ONLY',
        error: 'Credential modifications and authentication route access are strictly forbidden during diagnostic support sessions.',
      });
      return;
    }

    // ─── Core Business Mutation Gate ──────────────────────────────
    // If request method mutates state (POST, PUT, PATCH, DELETE)
    const isMutatingMethod = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';

    if (isMutatingMethod) {
      // Check if the route is an authorized Tier-2 diagnostic mutation
      const isAuthorizedDiagnostic = AUTHORIZED_DIAGNOSTIC_MUTATION_REGEX.test(requestPath);
      const isBusinessEntity = BUSINESS_ENTITY_MUTATION_REGEX.test(requestPath);

      if (isBusinessEntity || !isAuthorizedDiagnostic) {
        res.status(403).json({
          success: false,
          code: 'SUPPORT_SESSION_READ_ONLY',
          error: 'Mutating business entities (invoices, stock, balances, customers, etc.) is strictly forbidden during diagnostic support sessions.',
        });
        return;
      }
    }

    // ─── Actions Performed Increment ──────────────────────────────
    await PlatformSupportSession.updateOne(
      { _id: session._id },
      { $inc: { actionsPerformed: 1 } }
    );
    session.actionsPerformed = (session.actionsPerformed || 0) + 1;

    // ─── Attach Context for Downstream Auditing ────────────────────
    req.supportSession = session;
    (req as any).supportSessionId = session.sessionCode;
    req.headers['x-support-session-id'] = session.sessionCode;

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Support session bounds enforcement encountered an unexpected error.',
    });
  }
}

export default enforceSupportSessionBounds;
