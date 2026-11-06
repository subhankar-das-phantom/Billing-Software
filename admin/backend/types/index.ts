/**
 * Bharat Enterprise Billing System — Platform Control Plane Types
 * Strict, explicit interfaces, DTOs, and typed service boundaries.
 */

import type { Request } from 'express';
import type { Types } from 'mongoose';

// ─── Platform Roles ──────────────────────────────────────────────
export enum PlatformRole {
  PLATFORM_OWNER = 'PLATFORM_OWNER',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  SUPPORT_ADMIN  = 'SUPPORT_ADMIN',
  SUPPORT_AGENT  = 'SUPPORT_AGENT',
  TELESUPPORT    = 'TELESUPPORT',
  READ_ONLY      = 'READ_ONLY',
}

// ─── Platform Permissions (17 Granular Privileges) ───────────────
export enum PlatformPermission {
  DASHBOARD_VIEW          = 'platform.dashboard.view',
  TENANTS_VIEW            = 'platform.tenants.view',
  TENANTS_MANAGE          = 'platform.tenants.manage',
  TENANTS_SUSPEND         = 'platform.tenants.suspend',
  TENANTS_REACTIVATE      = 'platform.tenants.reactivate',
  TENANT_DATA_VIEW        = 'platform.tenantData.view',
  SUBSCRIPTIONS_VIEW      = 'platform.subscriptions.view',
  SUBSCRIPTIONS_MANAGE    = 'platform.subscriptions.manage',
  FEATURE_OVERRIDES_VIEW  = 'platform.featureOverrides.view',
  FEATURE_OVERRIDES_MANAGE = 'platform.featureOverrides.manage',
  SUPPORT_START           = 'platform.support.start',
  SUPPORT_OPERATE         = 'platform.support.operate',
  SUPPORT_END             = 'platform.support.end',
  AUDIT_VIEW              = 'platform.audit.view',
  USERS_VIEW              = 'platform.users.view',
  USERS_MANAGE            = 'platform.users.manage',
  EMERGENCY_BYPASS_MANAGE = 'platform.emergencyBypass.manage',
}

// ─── Platform User Model Interface ──────────────────────────────
export interface IPlatformUser {
  _id: Types.ObjectId;
  email: string;
  password?: string;
  fullName: string;
  role: PlatformRole;
  customPermissions: PlatformPermission[];
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockUntil?: Date | null;
  isLocked?: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes: Array<{
    codeHash: string;
    usedAt?: Date | null;
  }>;
  lastLoginAt?: Date | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Platform Session Model Interface ───────────────────────────
export interface IPlatformSession {
  _id: Types.ObjectId;
  platformUserId: Types.ObjectId;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date | null;
  revokedReason?: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Audit Log Interface with Hash-Chaining ──────────────────────
export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SECURITY_ALERT';

export interface IPlatformAuditLog {
  _id: Types.ObjectId;
  scope: string; // 'global' or 'tenant:<tenantId>'
  sequence: number; // Monotonically increasing sequence within scope
  actorId?: Types.ObjectId | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetTenantId?: Types.ObjectId | null;
  supportSessionId?: string | null;
  reason: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress: string;
  userAgent: string;
  severity: AuditSeverity;
  previousHash: string;
  hash: string;
  createdAt: Date;
}

// ─── Audit Head Interface for OCC & Chain Management ─────────────
export interface IPlatformAuditHead {
  _id: Types.ObjectId;
  scope: string; // Unique index
  lastSequence: number;
  lastHash: string;
  updatedAt: Date;
}

// ─── Distributed Lock Interface with Fencing ─────────────────────
export interface IDistributedLock {
  _id: Types.ObjectId;
  lockKey: string; // Unique index
  ownerToken: string | null;
  fencingToken: number; // Monotonically increasing generation number
  acquiredAt: Date | null;
  expiresAt: Date;
  lastHeartbeatAt: Date | null;
}

// ─── Feature Override Model Interface ────────────────────────────
export enum OverrideType {
  ALLOW = 'ALLOW',
  DENY  = 'DENY',
}

export interface ITenantFeatureOverride {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  feature: string;
  type: OverrideType;
  expiresAt: Date | null;
  reason: string;
  createdBy: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Support Session Model Interface ─────────────────────────────
export enum SupportSessionStatus {
  ACTIVE  = 'ACTIVE',
  ENDED   = 'ENDED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export interface IPlatformSupportSession {
  _id: Types.ObjectId;
  sessionCode: string; // Unique index
  operatorId: Types.ObjectId;
  targetTenantId: Types.ObjectId;
  tenantId?: Types.ObjectId; // alias to targetTenantId
  reason: string;
  permissionsSnapshot: PlatformPermission[];
  status: SupportSessionStatus;
  isReadOnly: boolean;
  isRevoked: boolean;
  allowedScope: string[];
  startedAt: Date;
  expiresAt: Date;
  endedAt?: Date | null;
  endedBy?: Types.ObjectId | null;
  actionsPerformed: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Keyset Pagination Contracts ─────────────────────────────────
export interface IKeysetCursor {
  sortField: 'createdAt' | 'normalizedFirmName' | 'paidAt' | 'invoiceDate';
  sortDirection: 'asc' | 'desc';
  val: string | number;
  id: string;
  tenantScope: string | null;
  filterSig: string;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage?: boolean;
    nextCursor: string | null;
    totalCount?: number;
    limit: number;
  };
}

// ─── Scoped Tenant DTOs ──────────────────────────────────────────
export interface TenantListItemDTO {
  tenantId: string;
  firmName: string;
  normalizedFirmName: string;
  email: string;
  phone: string;
  firmGSTIN: string;
  isActive: boolean;
  createdAt: string;
  subscription: {
    status: string;
    planName: string;
    planCode: string;
    expiresAt: string;
    isGrace: boolean;
  } | null;
}

export interface TenantOverviewDTO {
  tenantId: string;
  firmName: string;
  firmAddress: string;
  firmPhone: string;
  firmGSTIN: string;
  firmDL: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string | null;
  preferences: {
    themeMode: string;
    enableBatchTracking: boolean;
    documentPrintFormats?: Record<string, string>;
  };
  subscription: {
    status: string;
    planName: string;
    planCode: string;
    baseMonthlyPrice: number;
    finalAmount: number;
    startedAt: string;
    expiresAt: string;
    graceUntil: string;
    autoRenew: boolean;
    billingMode: string;
    daysRemaining: number;
  } | null;
  effectiveAccess: {
    canWrite: boolean;
    status: string;
    features: string[];
    emergencyBypassActive: boolean;
    emergencyBypassExpiresAt?: string | null;
  };
}

export interface TenantUsageDTO {
  tenantId: string;
  counts: {
    products: number;
    customers: number;
    invoices: number;
    employees: number;
    suppliers: number;
    batches: number;
  };
  financials: {
    totalSalesVolume: number;
    totalInvoicesCount: number;
  };
}

// ─── Dashboard Overview DTO ──────────────────────────────────────
export interface DashboardOverviewDTO {
  tenants: {
    total: number;
    active: number;
    trial: number;
    grace: number;
    expired: number;
    suspended: number;
  };
  mrr: {
    contractedMRR: number; // In Rupees with exact paise, e.g. 12450.50
    arr: number;
    activeSubscriptionsCount: number;
  };
  revenue: {
    today: number;
    thisMonth: number;
    todayPaymentsCount: number;
    thisMonthPaymentsCount: number;
  };
  systemHealth: {
    status: 'HEALTHY' | 'DEGRADED';
    cacheTimestamp: string;
    isCached: boolean;
  };
}

// ─── Request Context Extension ───────────────────────────────────
export interface PlatformRequest extends Request {
  platformUser?: IPlatformUser;
  platformSession?: IPlatformSession;
  targetTenant?: Record<string, unknown>;
  targetTenantId?: Types.ObjectId;
  supportSession?: IPlatformSupportSession;
}

