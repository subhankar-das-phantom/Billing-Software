/**
 * Bharat Enterprise Billing System — Support Session Diagnostic Guard Middleware
 * Strictly enforces anti-impersonation, read-only boundary gating, and action counter tracking.
 */

import { Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import { PlatformRequest, SupportSessionStatus } from '../types';
import PlatformSupportSession from '../models/PlatformSupportSession';
import { getActiveSupportSession } from '../services/supportSessionService';

// Regex identifying routes handling tenant credentials or authentication
const CREDENTIAL_ROUTE_REGEX = /(?:\/api)?\/(?:auth\/(?:update-password|change-password|reset-password|password|register|login|mfa)|credentials)/i;

// Regex identifying core business mutations forbidden during diagnostic support sessions
const BUSINESS_ENTITY_MUTATION_REGEX = /(?:invoices?|bills?|sales?|stocks?|inventory|products?|batch(?:es)?|customers?|suppliers?|payments?|credit-?notes?|manual-?entr(?:y|ies)|ledgers?|balances?|purchases?)/i;

// Allowlist for authorized Tier-2 diagnostic actions
const AUTHORIZED_DIAGNOSTIC_MUTATION_REGEX = /(?:diagnostics\/(?:cache-flush|notification-retry|ping|test-connection)|cache\/flush|notifications\/(?:retry|resend)|support-sessions\/[^/]+\/(?:end|revoke)|support\/(?:sessions\/)?[^/]+\/(?:end|revoke))/i;

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

    // 1. Check header, query, or body for explicit session identification
    const sessionCodeHeader =
      (req.headers['x-support-session-code'] as string) ||
      (req.headers['x-support-session-id'] as string) ||
      (req.query?.supportSessionCode as string) ||
      (req.query?.supportSessionId as string) ||
      (req.body?.supportSessionCode as string) ||
      (req.body?.supportSessionId as string);

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

      if (
        foundSession.status !== SupportSessionStatus.ACTIVE ||
        foundSession.isRevoked ||
        foundSession.expiresAt <= new Date()
      ) {
        if (foundSession.status === SupportSessionStatus.ACTIVE && foundSession.expiresAt <= new Date()) {
          foundSession.status = SupportSessionStatus.EXPIRED;
          foundSession.endedAt = foundSession.expiresAt;
          await foundSession.save();
        }
        const isRevoked = foundSession.isRevoked || foundSession.status === SupportSessionStatus.REVOKED;
        res.status(403).json({
          success: false,
          code: isRevoked ? 'SUPPORT_SESSION_REVOKED' : 'SUPPORT_SESSION_EXPIRED',
          error: isRevoked
            ? 'Support session has been revoked and is immediately invalidated.'
            : 'Support session has expired or is no longer active.',
        });
        return;
      }

      // Hardened operator ownership check: If authenticated as platform operator, verify session ownership
      if (
        req.platformUser?._id &&
        foundSession.operatorId &&
        foundSession.operatorId.toString() !== req.platformUser._id.toString()
      ) {
        res.status(403).json({
          success: false,
          code: 'SUPPORT_SESSION_OPERATOR_MISMATCH',
          error: 'Support session code belongs to a different platform operator.',
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

    // Validate pre-attached or resolved session expiration & revocation status
    if (
      session.status !== SupportSessionStatus.ACTIVE ||
      session.isRevoked ||
      session.expiresAt <= new Date()
    ) {
      if (session.status === SupportSessionStatus.ACTIVE && session.expiresAt <= new Date()) {
        session.status = SupportSessionStatus.EXPIRED;
        session.endedAt = session.expiresAt;
        await PlatformSupportSession.updateOne(
          { _id: session._id },
          { $set: { status: SupportSessionStatus.EXPIRED, endedAt: session.expiresAt } }
        );
      }
      const isRevoked = session.isRevoked || session.status === SupportSessionStatus.REVOKED;
      res.status(403).json({
        success: false,
        code: isRevoked ? 'SUPPORT_SESSION_REVOKED' : 'SUPPORT_SESSION_EXPIRED',
        error: isRevoked
          ? 'Support session has been revoked and is immediately invalidated.'
          : 'Support session has expired or is no longer active.',
      });
      return;
    }

    // ─── Operator Active Status Guard (Cascading Invalidation) ────
    if (session.operatorId && mongoose.connection?.readyState === 1) {
      const PlatformUserModel = mongoose.models.PlatformUser || (await import('../models/PlatformUser')).default;
      if (PlatformUserModel && typeof PlatformUserModel.findById === 'function') {
        const operator = await PlatformUserModel.findById(session.operatorId).select('isActive').lean();
        if (operator && operator.isActive === false) {
          session.status = SupportSessionStatus.REVOKED;
          session.isRevoked = true;
          session.endedAt = new Date();
          await PlatformSupportSession.updateOne(
            { _id: session._id },
            { $set: { status: SupportSessionStatus.REVOKED, isRevoked: true, endedAt: new Date() } }
          );
          res.status(403).json({
            success: false,
            code: 'SUPPORT_SESSION_OPERATOR_SUSPENDED',
            error: 'Operator account is suspended. Active support sessions have been invalidated.',
          });
          return;
        }
      }
    }

    // ─── Anti-Impersonation Invariant ────────────────────────────
    // Operator NEVER receives tenant identity. Purge any attempted identity pollution.
    delete (req as any).user;
    delete (req as any).userRole;
    delete (req as any).userModel;
    delete (req as any).admin;
    delete (req as any).tenantUser;
    delete (req as any).isImpersonated;

    const requestPath = req.baseUrl
      ? `${req.baseUrl}${req.path}`
      : (req.originalUrl ? req.originalUrl.split('?')[0]! : req.path);

    // ─── Target Tenant Isolation Guard ────────────────────────────
    const queryTenantId = req.query?.tenantId;
    const headerTenantId = req.headers['x-tenant-id'];
    const bodyTenantId = req.body?.tenantId;
    const paramsTenantId = req.params?.tenantId;
    const pathTenantMatch = requestPath.match(/\/(?:tenants|tenant)\/([0-9a-fA-F]{24})/i);
    const extractedPathTenantId = pathTenantMatch ? pathTenantMatch[1] : undefined;

    const explicitTenantTargets = [
      queryTenantId,
      headerTenantId,
      bodyTenantId,
      paramsTenantId,
      extractedPathTenantId,
      (requestPath.includes('/tenants/') ? req.params?.id : undefined),
    ].filter(Boolean) as (string | string[])[];

    for (const rawTarget of explicitTenantTargets) {
      const targetStr = Array.isArray(rawTarget) ? rawTarget[0] : rawTarget;
      if (
        targetStr &&
        typeof targetStr === 'string' &&
        Types.ObjectId.isValid(targetStr) &&
        session.targetTenantId &&
        session.targetTenantId.toString() !== targetStr.toString()
      ) {
        res.status(403).json({
          success: false,
          code: 'SUPPORT_SESSION_TENANT_MISMATCH',
          error: 'Active support session is pinned to a different tenant.',
        });
        return;
      }
    }

    // Deep cross-tenant entity checks for customer and invoice lookups
    const customerPathMatch = requestPath.match(/\/customers\/([0-9a-fA-F]{24})/i);
    const customerTargetId = customerPathMatch
      ? customerPathMatch[1]
      : (requestPath.includes('/customers/') ? req.params?.id : req.params?.customerId);

    if (
      customerTargetId &&
      typeof customerTargetId === 'string' &&
      Types.ObjectId.isValid(customerTargetId) &&
      mongoose.connection?.readyState === 1
    ) {
      try {
        const CustomerModel: any = mongoose.models.Customer || require('../../../backend/models/Customer');
        if (CustomerModel && typeof CustomerModel.findById === 'function') {
          const customer = await CustomerModel.findById(customerTargetId).select('tenantId').lean();
          if (customer && customer.tenantId && customer.tenantId.toString() !== session.targetTenantId.toString()) {
            res.status(403).json({
              success: false,
              code: 'SUPPORT_SESSION_TENANT_MISMATCH',
              error: 'Active support session is pinned to a different tenant.',
            });
            return;
          }
        }
      } catch {
        // Model lookup fallback
      }
    }

    const invoicePathMatch = requestPath.match(/\/invoices\/([0-9a-fA-F]{24})/i);
    const invoiceTargetId = invoicePathMatch
      ? invoicePathMatch[1]
      : (requestPath.includes('/invoices/') ? req.params?.id : req.params?.invoiceId);

    if (
      invoiceTargetId &&
      typeof invoiceTargetId === 'string' &&
      Types.ObjectId.isValid(invoiceTargetId) &&
      mongoose.connection?.readyState === 1
    ) {
      try {
        const InvoiceModel: any = mongoose.models.Invoice || require('../../../backend/models/Invoice');
        if (InvoiceModel && typeof InvoiceModel.findById === 'function') {
          const invoice = await InvoiceModel.findById(invoiceTargetId).select('tenantId').lean();
          if (invoice && invoice.tenantId && invoice.tenantId.toString() !== session.targetTenantId.toString()) {
            res.status(403).json({
              success: false,
              code: 'SUPPORT_SESSION_TENANT_MISMATCH',
              error: 'Active support session is pinned to a different tenant.',
            });
            return;
          }
        }
      } catch {
        // Model lookup fallback
      }
    }

    // Auto-scope downstream queries to tenant session target
    if (session.targetTenantId) {
      if (req.query && typeof req.query === 'object') {
        (req.query as any).tenantId = session.targetTenantId.toString();
      }
      (req as any).tenantId = session.targetTenantId;
      (req as any).targetTenantId = session.targetTenantId;
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

    // ─── Method Spoofing & Core Business Mutation Gate ─────────────
    const overrideHeader =
      (req.headers['x-http-method-override'] as string) ||
      (req.headers['x-method-override'] as string) ||
      (req.headers['x-http-method'] as string);
    const queryOverride = (req.query?._method as string) || (req.query?.method as string);
    const bodyOverride = (req.body?._method as string) || (req.body?.method as string);

    const rawEffectiveMethod = overrideHeader || queryOverride || bodyOverride || req.method || 'GET';
    const effectiveMethod = (typeof rawEffectiveMethod === 'string' ? rawEffectiveMethod.trim() : req.method).toUpperCase();

    // Check for GraphQL mutation smuggling
    const contentType = ((req.headers['content-type'] as string) || '').toLowerCase();
    const rawBodyStr = typeof req.body === 'string' ? req.body : (req.body?.query ? String(req.body.query) : '');
    const rawQueryStr = typeof req.query?.query === 'string' ? String(req.query.query) : '';
    const isGraphQLMutation =
      (contentType.includes('graphql') || requestPath.includes('/graphql')) &&
      (rawBodyStr.includes('mutation') || rawQueryStr.includes('mutation'));

    const isMutatingMethod =
      isGraphQLMutation ||
      (effectiveMethod !== 'GET' && effectiveMethod !== 'HEAD' && effectiveMethod !== 'OPTIONS');

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
