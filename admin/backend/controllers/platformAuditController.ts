/**
 * Bharat Enterprise Billing System — Platform Audit Controller
 * Cryptographically verified, keyset-paginated audit trail inspection endpoints.
 */

import { Response } from 'express';
import { Types } from 'mongoose';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { verifyAuditChain } from '../services/platformAuditService';
import {
  encodeKeysetCursor,
  decodeAndVerifyKeysetCursor,
  computeFilterSignature,
} from '../utils/cursorCrypto';
import type { PlatformRequest, AuditSeverity } from '../types';

/**
 * GET /api/platform/audit
 * Cryptographic keyset-paginated retrieval of tamper-evident platform audit logs.
 */
export async function getAuditLogs(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const {
      cursor,
      limit = '20',
      scope,
      action,
      actorId,
      targetTenantId,
      severity,
      from,
      to,
    } = req.query;

    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

    // Construct active filter object for deterministic filter signature
    const activeFilters: Record<string, unknown> = {};
    const mongoConditions: Record<string, unknown>[] = [];

    if (scope && typeof scope === 'string' && scope.trim()) {
      activeFilters.scope = scope.trim();
      mongoConditions.push({ scope: scope.trim() });
    }

    if (action && typeof action === 'string' && action.trim()) {
      activeFilters.action = action.trim();
      mongoConditions.push({ action: action.trim() });
    }

    if (actorId && typeof actorId === 'string' && Types.ObjectId.isValid(actorId)) {
      activeFilters.actorId = actorId;
      mongoConditions.push({ actorId: new Types.ObjectId(actorId) });
    }

    if (targetTenantId && typeof targetTenantId === 'string' && Types.ObjectId.isValid(targetTenantId)) {
      activeFilters.targetTenantId = targetTenantId;
      mongoConditions.push({ targetTenantId: new Types.ObjectId(targetTenantId) });
    }

    if (
      severity &&
      typeof severity === 'string' &&
      ['INFO', 'WARNING', 'CRITICAL', 'SECURITY_ALERT'].includes(severity)
    ) {
      activeFilters.severity = severity as AuditSeverity;
      mongoConditions.push({ severity });
    }

    if (from && typeof from === 'string') {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        activeFilters.from = fromDate.toISOString();
        mongoConditions.push({ createdAt: { $gte: fromDate } });
      }
    }

    if (to && typeof to === 'string') {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        activeFilters.to = toDate.toISOString();
        mongoConditions.push({ createdAt: { $lte: toDate } });
      }
    }

    const currentFilterSig = computeFilterSignature(activeFilters);

    // Keyset pagination predicate evaluation
    if (cursor && typeof cursor === 'string') {
      const decodedCursor = decodeAndVerifyKeysetCursor(cursor, {
        expectedSortField: 'createdAt',
        expectedSortDirection: 'desc',
        expectedTenantScope: (targetTenantId as string) || null,
        currentFilterSig,
      });

      const cursorVal = new Date(decodedCursor.val);
      const cursorId = new Types.ObjectId(decodedCursor.id);

      mongoConditions.push({
        $or: [
          { createdAt: { $lt: cursorVal } },
          { createdAt: cursorVal, _id: { $lt: cursorId } },
        ],
      });
    }

    const finalQuery = mongoConditions.length > 0 ? { $and: mongoConditions } : {};

    // Fetch limit + 1 records to check next page availability
    const logs = await PlatformAuditLog.find(finalQuery)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limitNum + 1)
      .lean();

    const hasNextPage = logs.length > limitNum;
    const pageRecords = hasNextPage ? logs.slice(0, limitNum) : logs;

    let nextCursor: string | null = null;
    if (hasNextPage && pageRecords.length > 0) {
      const lastRecord = pageRecords[pageRecords.length - 1]!;
      nextCursor = encodeKeysetCursor({
        sortField: 'createdAt',
        sortDirection: 'desc',
        val: lastRecord.createdAt.toISOString(),
        id: lastRecord._id.toString(),
        tenantScope: (targetTenantId as string) || null,
        filterSig: currentFilterSig,
      });
    }

    res.status(200).json({
      success: true,
      data: pageRecords,
      pagination: {
        hasNextPage,
        nextCursor,
        limit: limitNum,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to retrieve platform audit logs',
    });
  }
}

/**
 * GET /api/platform/audit/verify
 * Validates the cryptographic SHA-256 hash chain and monotonic sequences for a partition scope.
 */
export async function verifyAuditScope(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const { scope = 'global', startSequence, endSequence } = req.query;

    const start = startSequence ? parseInt(startSequence as string, 10) : undefined;
    const end = endSequence ? parseInt(endSequence as string, 10) : undefined;

    const result = await verifyAuditChain(scope as string, start, end);

    res.status(200).json({
      success: true,
      verification: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Audit chain verification failed',
    });
  }
}
