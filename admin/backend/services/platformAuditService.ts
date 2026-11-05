/**
 * Bharat Enterprise Billing System — Platform Audit Service
 * Cryptographically hash-chained, partitioned audit logging with automatic sensitive field redaction.
 */

import { Types, ClientSession } from 'mongoose';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformAuditHead, AUDIT_GENESIS_HASH } from '../models/PlatformAuditHead';
import { computeCanonicalSha256 } from '../utils/canonicalJson';
import type { IPlatformAuditLog, AuditSeverity } from '../types';

export const SENSITIVE_KEY_REGEX =
  /password|token|secret|authorization|cookie|key|upiid|accountnumber|ifsccode|pan|aadhaar|govid|backupcode|recoverycode|codehash|otp|pin|cvv/i;

/**
 * Deeply redacts sensitive keys from any arbitrary object or array.
 */
export function redactSensitiveFields(val: unknown, seen = new WeakSet<object>()): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val !== 'object') {
    return val;
  }
  if (val instanceof Date) {
    return val;
  }
  // Convert Mongoose Documents or types with toObject / toJSON
  if (typeof (val as any).toObject === 'function') {
    val = (val as any).toObject();
  }
  if (typeof (val as any).toHexString === 'function') {
    return (val as any).toHexString();
  }
  if (seen.has(val as object)) {
    return '[CIRCULAR]';
  }
  seen.add(val as object);

  try {
    if (Array.isArray(val)) {
      return val.map((item) => redactSensitiveFields(item, seen));
    }
    const result: Record<string, unknown> = {};
    const obj = val as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (SENSITIVE_KEY_REGEX.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveFields(v, seen);
      }
    }
    return result;
  } finally {
    seen.delete(val as object);
  }
}

export interface LogPlatformAuditParams {
  scope?: string;
  actorId?: Types.ObjectId | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetTenantId?: Types.ObjectId | string | null;
  supportSessionId?: string | null;
  reason: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditSeverity;
}

/**
 * Appends a tamper-evident audit record to the partitioned hash chain.
 */
export async function logPlatformAudit(
  params: LogPlatformAuditParams,
  session?: ClientSession,
): Promise<IPlatformAuditLog> {
  const targetTenantId = params.targetTenantId
    ? new Types.ObjectId(params.targetTenantId.toString())
    : null;

  const scope =
    params.scope ||
    (targetTenantId ? `tenant:${targetTenantId.toString()}` : 'global');

  const redactedBefore = params.before
    ? (redactSensitiveFields(params.before) as Record<string, unknown>)
    : null;
  const redactedAfter = params.after
    ? (redactSensitiveFields(params.after) as Record<string, unknown>)
    : null;

  // 1. Idempotently ensure PlatformAuditHead exists for the scope
  let head = await PlatformAuditHead.findOne({ scope }).session(session || null);
  if (!head) {
    try {
      await PlatformAuditHead.create(
        [
          {
            scope,
            lastSequence: 0,
            lastHash: AUDIT_GENESIS_HASH,
            updatedAt: new Date(),
          },
        ],
        { session: session || undefined },
      );
    } catch {
      // Ignore duplicate key if another process created it concurrently
    }
  }

  // 2. Optimistic Concurrency Control (OCC) loop to advance hash chain
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    head = await PlatformAuditHead.findOne({ scope }).session(session || null);
    if (!head) {
      throw new Error(`PlatformAuditHead not found for scope "${scope}"`);
    }

    const currentSeq = head.lastSequence;
    const currentHash = head.lastHash;
    const nextSeq = currentSeq + 1;
    const now = new Date();

    // Canonical payload for hash computation
    const canonicalPayload = {
      scope,
      sequence: nextSeq,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      before: redactedBefore,
      after: redactedAfter,
      previousHash: currentHash,
      timestamp: now,
    };

    const hash = computeCanonicalSha256(canonicalPayload);

    const updatedHead = await PlatformAuditHead.findOneAndUpdate(
      { scope, lastSequence: currentSeq },
      {
        $inc: { lastSequence: 1 },
        $set: { lastHash: hash, updatedAt: now },
      },
      { session: session || undefined, new: true },
    );

    if (updatedHead) {
      // Successfully secured next slot in the sequence; insert log
      const logs = await PlatformAuditLog.create(
        [
          {
            scope,
            sequence: nextSeq,
            actorId: params.actorId || null,
            actorEmail: params.actorEmail,
            actorRole: params.actorRole,
            action: params.action,
            targetType: params.targetType,
            targetId: params.targetId,
            targetTenantId,
            supportSessionId: params.supportSessionId || null,
            reason: params.reason,
            before: redactedBefore,
            after: redactedAfter,
            ipAddress: params.ipAddress || '',
            userAgent: params.userAgent || '',
            severity: params.severity || 'INFO',
            previousHash: currentHash,
            hash,
            createdAt: now,
          },
        ],
        { session: session || undefined },
      );

      const createdLog = logs[0];
      if (!createdLog) {
        throw new Error('Failed to create PlatformAuditLog record');
      }
      return createdLog;
    }

    // Jittered backoff on contention
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20) + 10));
  }

  throw new Error(
    `Failed to advance PlatformAuditHead for scope "${scope}" due to concurrent contention after ${MAX_ATTEMPTS} attempts`,
  );
}

export interface VerifyChainResult {
  valid: boolean;
  verifiedCount: number;
  error?: string;
  scope: string;
  startSequence?: number;
  endSequence?: number;
}

/**
 * Validates the cryptographic integrity of the partitioned audit log chain.
 * Recomputes SHA-256 for each entry and asserts sequential previousHash linking.
 */
export async function verifyAuditChain(
  scope: string,
  startSequence?: number,
  endSequence?: number,
): Promise<VerifyChainResult> {
  const filter: Record<string, unknown> = { scope };

  if (startSequence !== undefined || endSequence !== undefined) {
    const seqFilter: Record<string, number> = {};
    if (startSequence !== undefined) seqFilter.$gte = startSequence;
    if (endSequence !== undefined) seqFilter.$lte = endSequence;
    filter.sequence = seqFilter;
  }

  const logs = await PlatformAuditLog.find(filter).sort({ sequence: 1 }).lean();

  if (logs.length === 0) {
    return {
      valid: true,
      verifiedCount: 0,
      scope,
    };
  }

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]!;

    // Reconstruct canonical payload exactly as logged
    const canonicalPayload = {
      scope: log.scope,
      sequence: log.sequence,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      reason: log.reason,
      before: log.before,
      after: log.after,
      previousHash: log.previousHash,
      timestamp: log.createdAt,
    };

    const recomputedHash = computeCanonicalSha256(canonicalPayload);

    if (recomputedHash !== log.hash) {
      return {
        valid: false,
        verifiedCount: i,
        error: `Cryptographic hash mismatch at sequence ${log.sequence}. Stored hash "${log.hash}", computed hash "${recomputedHash}". Entry has been tampered.`,
        scope,
        startSequence: logs[0]!.sequence,
        endSequence: logs[logs.length - 1]!.sequence,
      };
    }

    if (i > 0) {
      const prevLog = logs[i - 1]!;
      if (log.previousHash !== prevLog.hash) {
        return {
          valid: false,
          verifiedCount: i,
          error: `Broken hash chain at sequence ${log.sequence}. Previous hash "${log.previousHash}" does not match prior entry hash "${prevLog.hash}".`,
          scope,
          startSequence: logs[0]!.sequence,
          endSequence: logs[logs.length - 1]!.sequence,
        };
      }
      if (log.sequence !== prevLog.sequence + 1) {
        return {
          valid: false,
          verifiedCount: i,
          error: `Monotonic sequence gap detected between sequence ${prevLog.sequence} and ${log.sequence}.`,
          scope,
          startSequence: logs[0]!.sequence,
          endSequence: logs[logs.length - 1]!.sequence,
        };
      }
    } else if (log.sequence === 1) {
      if (log.previousHash !== AUDIT_GENESIS_HASH) {
        return {
          valid: false,
          verifiedCount: 0,
          error: `Invalid genesis hash at sequence 1. Expected "${AUDIT_GENESIS_HASH}", got "${log.previousHash}".`,
          scope,
          startSequence: logs[0]!.sequence,
          endSequence: logs[logs.length - 1]!.sequence,
        };
      }
    }
  }

  return {
    valid: true,
    verifiedCount: logs.length,
    scope,
    startSequence: logs[0]!.sequence,
    endSequence: logs[logs.length - 1]!.sequence,
  };
}
