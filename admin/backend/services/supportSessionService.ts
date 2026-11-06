/**
 * Bharat Enterprise Billing System — Platform Support Session Service
 * Diagnostic boundary management, permission snapshots, and session lifecycle control.
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import PlatformSupportSession from '../models/PlatformSupportSession';
import PlatformUser from '../models/PlatformUser';
import { logPlatformAudit } from './platformAuditService';
import { ROLE_PERMISSIONS } from '../permissions';
import {
  IPlatformSupportSession,
  IPlatformUser,
  SupportSessionStatus,
  PlatformPermission,
  PlatformRole,
} from '../types';

export interface SupportSessionFilter {
  operatorId?: string | Types.ObjectId;
  targetTenantId?: string | Types.ObjectId;
  status?: SupportSessionStatus;
}

export interface SupportSessionPagination {
  page?: number;
  limit?: number;
}

export interface SupportSessionListResult {
  data: IPlatformSupportSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Generates a unique diagnostic session code in the format: SUP-YYYYMMDD-XXXX
 */
export function generateSupportSessionCode(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SUP-${yyyy}${mm}${dd}-${suffix}`;
}

/**
 * Computes the snapshot of effective permissions for the given operator.
 */
export function computePermissionsSnapshot(operator: IPlatformUser): PlatformPermission[] {
  if (operator.role === PlatformRole.PLATFORM_OWNER) {
    return Object.values(PlatformPermission);
  }

  const rolePerms = ROLE_PERMISSIONS[operator.role] || [];
  const customPerms = operator.customPermissions || [];
  return Array.from(new Set([...rolePerms, ...customPerms]));
}

/**
 * Starts a new diagnostic support session for a platform operator.
 * Enforces a duration ceiling of max 4 hours and floor of 0.5 hours.
 * Cleans up any prior active session for the operator before initiating a new one.
 */
export async function startSupportSession(
  operator: IPlatformUser,
  targetTenantId: Types.ObjectId | string,
  reason: string,
  durationHours: number = 2
): Promise<IPlatformSupportSession> {
  const trimmedReason = (reason || '').trim();
  if (trimmedReason.length < 10) {
    throw new Error('Support session reason must be at least 10 characters.');
  }

  if (!targetTenantId) {
    throw new Error('Target tenant ID is required.');
  }

  const tenantObjectId = new Types.ObjectId(targetTenantId.toString());

  // Enforce duration ceiling (0.5h to 4h)
  const boundedDurationHours = Math.min(Math.max(durationHours, 0.5), 4);

  // Cleanly close any existing ACTIVE session for this operator
  const existingActive = await PlatformSupportSession.findOne({
    operatorId: operator._id,
    status: SupportSessionStatus.ACTIVE,
  });

  if (existingActive) {
    existingActive.status = SupportSessionStatus.ENDED;
    existingActive.endedAt = new Date();
    existingActive.endedBy = operator._id;
    await existingActive.save();

    await logPlatformAudit({
      action: 'SUPPORT_SESSION.CLEANUP_SUPERSEDED',
      actorId: operator._id,
      actorEmail: operator.email,
      actorRole: operator.role,
      targetType: 'PlatformSupportSession',
      targetId: existingActive._id.toString(),
      targetTenantId: existingActive.targetTenantId,
      supportSessionId: existingActive.sessionCode,
      reason: 'Automatically closed superseded active session prior to launching new support session',
      severity: 'INFO',
    });
  }

  // Generate unique session code
  let sessionCode = generateSupportSessionCode();
  let collision = await PlatformSupportSession.exists({ sessionCode });
  while (collision) {
    sessionCode = generateSupportSessionCode();
    collision = await PlatformSupportSession.exists({ sessionCode });
  }

  const permissionsSnapshot = computePermissionsSnapshot(operator);
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + boundedDurationHours * 60 * 60 * 1000);

  const session = await PlatformSupportSession.create({
    sessionCode,
    operatorId: operator._id,
    targetTenantId: tenantObjectId,
    reason: trimmedReason,
    permissionsSnapshot,
    status: SupportSessionStatus.ACTIVE,
    isReadOnly: true,
    isRevoked: false,
    allowedScope: ['READ_ONLY'],
    startedAt,
    expiresAt,
    endedAt: null,
    endedBy: null,
    actionsPerformed: 0,
  });

  await logPlatformAudit({
    action: 'SUPPORT_SESSION.START',
    actorId: operator._id,
    actorEmail: operator.email,
    actorRole: operator.role,
    targetType: 'PlatformSupportSession',
    targetId: session._id.toString(),
    targetTenantId: session.targetTenantId,
    supportSessionId: session.sessionCode,
    reason: trimmedReason,
    severity: 'WARNING',
    after: {
      sessionCode: session.sessionCode,
      targetTenantId: session.targetTenantId.toString(),
      durationHours: boundedDurationHours,
      expiresAt: session.expiresAt.toISOString(),
      isReadOnly: session.isReadOnly,
    },
  });

  return session;
}

/**
 * Concludes an active support session cleanly.
 */
export async function endSupportSession(
  sessionIdOrCode: Types.ObjectId | string,
  operatorId: Types.ObjectId | string,
  reason?: string
): Promise<IPlatformSupportSession> {
  const query = Types.ObjectId.isValid(sessionIdOrCode.toString()) && sessionIdOrCode.toString().length === 24
    ? { _id: new Types.ObjectId(sessionIdOrCode.toString()) }
    : { sessionCode: sessionIdOrCode.toString() };

  const session = await PlatformSupportSession.findOne(query);

  if (!session) {
    throw new Error('Support session not found.');
  }

  const actorObjectId = new Types.ObjectId(operatorId.toString());

  if (session.status !== SupportSessionStatus.ACTIVE) {
    return session;
  }

  session.status = SupportSessionStatus.ENDED;
  session.endedAt = new Date();
  session.endedBy = actorObjectId;
  await session.save();

  await logPlatformAudit({
    action: 'SUPPORT_SESSION.END',
    actorId: actorObjectId,
    actorEmail: 'operator',
    actorRole: 'SUPPORT',
    targetType: 'PlatformSupportSession',
    targetId: session._id.toString(),
    targetTenantId: session.targetTenantId,
    supportSessionId: session.sessionCode,
    reason: reason || 'Diagnostic support session concluded by operator.',
    severity: 'INFO',
    after: {
      status: session.status,
      endedAt: session.endedAt.toISOString(),
      actionsPerformed: session.actionsPerformed,
    },
  });

  return session;
}

/**
 * Immediately revokes an active diagnostic support session with zero-window tolerance.
 */
export async function revokeSupportSession(
  sessionIdOrCode: Types.ObjectId | string,
  operatorId: Types.ObjectId | string,
  reason?: string
): Promise<IPlatformSupportSession> {
  const query = Types.ObjectId.isValid(sessionIdOrCode.toString()) && sessionIdOrCode.toString().length === 24
    ? { _id: new Types.ObjectId(sessionIdOrCode.toString()) }
    : { sessionCode: sessionIdOrCode.toString() };

  const session = await PlatformSupportSession.findOne(query);

  if (!session) {
    throw new Error('Support session not found.');
  }

  const actorObjectId = new Types.ObjectId(operatorId.toString());

  session.status = SupportSessionStatus.REVOKED;
  session.isRevoked = true;
  session.endedAt = new Date();
  session.endedBy = actorObjectId;
  await session.save();

  await logPlatformAudit({
    action: 'SUPPORT_SESSION.REVOKE',
    actorId: actorObjectId,
    actorEmail: 'operator',
    actorRole: 'SUPPORT',
    targetType: 'PlatformSupportSession',
    targetId: session._id.toString(),
    targetTenantId: session.targetTenantId,
    supportSessionId: session.sessionCode,
    reason: reason || 'Diagnostic support session revoked by operator.',
    severity: 'WARNING',
    after: {
      status: session.status,
      isRevoked: session.isRevoked,
      endedAt: session.endedAt.toISOString(),
      actionsPerformed: session.actionsPerformed,
    },
  });

  return session;
}

/**
 * Retrieves the currently active support session for an operator.
 * Automatically marks and expires sessions whose expiration deadline has passed,
 * or immediately invalidates if the operator has been suspended.
 */
export async function getActiveSupportSession(
  operatorId: Types.ObjectId | string
): Promise<IPlatformSupportSession | null> {
  const operatorObjectId = new Types.ObjectId(operatorId.toString());

  const session = await PlatformSupportSession.findOne({
    operatorId: operatorObjectId,
    status: SupportSessionStatus.ACTIVE,
    isRevoked: false,
  });

  if (!session) {
    return null;
  }

  // Operator suspension cascading invalidation check
  const operator = await PlatformUser.findById(operatorObjectId).select('isActive').lean();
  if (!operator || operator.isActive === false) {
    session.status = SupportSessionStatus.REVOKED;
    session.isRevoked = true;
    session.endedAt = new Date();
    await session.save();
    return null;
  }

  // Check if session has expired past deadline
  if (session.expiresAt <= new Date()) {
    session.status = SupportSessionStatus.EXPIRED;
    session.endedAt = session.expiresAt;
    await session.save();
    return null;
  }

  return session;
}

/**
 * Lists historical support sessions with optional filtering and pagination.
 */
export async function listSupportSessions(
  filter: SupportSessionFilter = {},
  pagination: SupportSessionPagination = {}
): Promise<SupportSessionListResult> {
  const query: Record<string, unknown> = {};

  if (filter.operatorId) {
    query.operatorId = new Types.ObjectId(filter.operatorId.toString());
  }
  if (filter.targetTenantId) {
    query.targetTenantId = new Types.ObjectId(filter.targetTenantId.toString());
  }
  if (filter.status) {
    query.status = filter.status;
  }

  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(Math.max(1, pagination.limit || 20), 100);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    PlatformSupportSession.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('operatorId', 'fullName email role')
      .populate('targetTenantId', 'firmName email phone firmGSTIN')
      .lean(),
    PlatformSupportSession.countDocuments(query),
  ]);

  return {
    data: data as unknown as IPlatformSupportSession[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
