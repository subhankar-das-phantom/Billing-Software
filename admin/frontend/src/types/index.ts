/**
 * Bharat Enterprise Billing System — Platform Control Plane Contracts
 * Strict frontend TypeScript types and DTOs reflecting the backend architecture.
 */

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
  DASHBOARD_VIEW           = 'platform.dashboard.view',
  TENANTS_VIEW             = 'platform.tenants.view',
  TENANTS_MANAGE           = 'platform.tenants.manage',
  TENANTS_SUSPEND          = 'platform.tenants.suspend',
  TENANTS_REACTIVATE       = 'platform.tenants.reactivate',
  TENANT_DATA_VIEW         = 'platform.tenantData.view',
  SUBSCRIPTIONS_VIEW       = 'platform.subscriptions.view',
  SUBSCRIPTIONS_MANAGE     = 'platform.subscriptions.manage',
  FEATURE_OVERRIDES_VIEW   = 'platform.featureOverrides.view',
  FEATURE_OVERRIDES_MANAGE = 'platform.featureOverrides.manage',
  SUPPORT_START            = 'platform.support.start',
  SUPPORT_OPERATE          = 'platform.support.operate',
  SUPPORT_END              = 'platform.support.end',
  AUDIT_VIEW               = 'platform.audit.view',
  USERS_VIEW               = 'platform.users.view',
  USERS_MANAGE             = 'platform.users.manage',
  EMERGENCY_BYPASS_MANAGE  = 'platform.emergencyBypass.manage',
}

// ─── Canonical Role Permission Mappings ──────────────────────────
export const ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  [PlatformRole.PLATFORM_OWNER]: Object.values(PlatformPermission),

  [PlatformRole.PLATFORM_ADMIN]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW,
    PlatformPermission.TENANTS_MANAGE,
    PlatformPermission.TENANTS_SUSPEND,
    PlatformPermission.TENANTS_REACTIVATE,
    PlatformPermission.TENANT_DATA_VIEW,
    PlatformPermission.SUBSCRIPTIONS_VIEW,
    PlatformPermission.SUBSCRIPTIONS_MANAGE,
    PlatformPermission.FEATURE_OVERRIDES_VIEW,
    PlatformPermission.FEATURE_OVERRIDES_MANAGE,
    PlatformPermission.SUPPORT_START,
    PlatformPermission.SUPPORT_OPERATE,
    PlatformPermission.SUPPORT_END,
    PlatformPermission.AUDIT_VIEW,
    PlatformPermission.USERS_VIEW,
    PlatformPermission.USERS_MANAGE,
  ],

  [PlatformRole.SUPPORT_ADMIN]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW,
    PlatformPermission.TENANT_DATA_VIEW,
    PlatformPermission.SUBSCRIPTIONS_VIEW,
    PlatformPermission.SUBSCRIPTIONS_MANAGE,
    PlatformPermission.FEATURE_OVERRIDES_VIEW,
    PlatformPermission.FEATURE_OVERRIDES_MANAGE,
    PlatformPermission.SUPPORT_START,
    PlatformPermission.SUPPORT_OPERATE,
    PlatformPermission.SUPPORT_END,
    PlatformPermission.AUDIT_VIEW,
  ],

  [PlatformRole.SUPPORT_AGENT]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW,
    PlatformPermission.TENANT_DATA_VIEW,
    PlatformPermission.SUPPORT_START,
    PlatformPermission.SUPPORT_END,
  ],

  [PlatformRole.TELESUPPORT]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW,
  ],

  [PlatformRole.READ_ONLY]: [
    PlatformPermission.DASHBOARD_VIEW,
    PlatformPermission.TENANTS_VIEW,
    PlatformPermission.SUBSCRIPTIONS_VIEW,
    PlatformPermission.AUDIT_VIEW,
  ],
};

// ─── Platform User Model Contract ────────────────────────────────
export interface PlatformUser {
  _id: string;
  email: string;
  fullName: string;
  role: PlatformRole;
  customPermissions?: PlatformPermission[];
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginAttempts?: number;
  lockUntil?: string | null;
  mfaEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Platform Session Contract ───────────────────────────────────
export interface PlatformSession {
  _id: string;
  platformUserId: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt?: string | null;
  revokedReason?: string | null;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Support Session Contracts ───────────────────────────────────
export enum SupportSessionStatus {
  ACTIVE  = 'ACTIVE',
  ENDED   = 'ENDED',
  EXPIRED = 'EXPIRED',
}

export interface ActiveSupportSession {
  _id: string;
  sessionCode: string;
  operatorId: string;
  targetTenantId: string;
  targetTenantFirmName?: string;
  reason: string;
  permissionsSnapshot: PlatformPermission[];
  status: SupportSessionStatus;
  isReadOnly: boolean;
  startedAt: string;
  expiresAt: string;
  endedAt?: string | null;
  endedBy?: string | null;
  actionsPerformed: number;
  createdAt?: string;
}

// ─── Feature Override Contracts ──────────────────────────────────
export enum OverrideType {
  ALLOW = 'ALLOW',
  DENY  = 'DENY',
}

export interface TenantFeatureOverride {
  _id: string;
  tenantId: string | { _id: string; firmName?: string; email?: string };
  feature: string;
  type: OverrideType;
  expiresAt: string | null;
  reason: string;
  createdBy: string | { _id: string; email: string; fullName: string; role: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── SaaS Plan Contracts ──────────────────────────────────────────
export interface SaaSPlan {
  _id: string;
  name: string;
  code: string;
  description: string;
  baseMonthlyPrice: number;
  features: string[];
  active: boolean;
  displayOrder: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export const ENTERPRISE_FEATURES = [
  'DASHBOARD',
  'CUSTOMERS',
  'PRODUCTS',
  'INVOICE_CREATE',
  'INVOICE_HISTORY',
  'INVOICE_PRINT',
  'PAYMENTS',
  'COLLECTIONS',
  'CREDIT_NOTES',
  'NOTES',
  'MANUAL_ENTRIES',
  'LEDGER',
  'OUTSTANDING_TRACKING',
  'EMPLOYEES',
  'EMPLOYEE_ANALYTICS',
  'ACTIVITY_LOGS',
  'GST_REPORTS',
  'ADVANCED_REPORTING',
  'REPORTS',
  'SUPPLIERS',
  'PURCHASES',
  'PURCHASE_REPORTS',
  'INVENTORY_LEDGER',
  'INVENTORY_INTELLIGENCE',
] as const;

export const EMERGENCY_BYPASS_FEATURE = 'EMERGENCY_BYPASS';

// ─── Keyset Pagination Contracts ─────────────────────────────────
export interface KeysetPagination {
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  nextCursor: string | null;
  totalCount?: number;
  limit: number;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: KeysetPagination;
}

// ─── Tenant DTOs ─────────────────────────────────────────────────
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

// ─── Audit Log Contracts ─────────────────────────────────────────
export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SECURITY_ALERT';

export interface AuditLog {
  _id: string;
  scope: string;
  sequence: number;
  actorId?: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetTenantId?: string | null;
  supportSessionId?: string | null;
  reason: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress: string;
  userAgent: string;
  severity: AuditSeverity;
  previousHash: string;
  hash: string;
  createdAt: string;
}

// ─── Generic API Response Wrapper ────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

// ─── Cryptographic Verification Contracts ─────────────────────────
export interface VerifyChainResult {
  valid: boolean;
  verifiedCount: number;
  error?: string;
  scope: string;
  startSequence?: number;
  endSequence?: number;
}

// ─── RBAC Hierarchy & Privilege Ceilings ─────────────────────────
export const ROLE_HIERARCHY_LEVEL: Record<PlatformRole, number> = {
  [PlatformRole.PLATFORM_OWNER]: 100,
  [PlatformRole.PLATFORM_ADMIN]: 80,
  [PlatformRole.SUPPORT_ADMIN]: 60,
  [PlatformRole.SUPPORT_AGENT]: 40,
  [PlatformRole.TELESUPPORT]: 20,
  [PlatformRole.READ_ONLY]: 10,
};

export function canManageRole(
  actingRole: PlatformRole,
  targetRole: PlatformRole,
): boolean {
  if (actingRole === PlatformRole.PLATFORM_OWNER) {
    return true;
  }
  const actingLevel = ROLE_HIERARCHY_LEVEL[actingRole] ?? 0;
  const targetLevel = ROLE_HIERARCHY_LEVEL[targetRole] ?? 0;
  return actingLevel > targetLevel;
}

// ─── Platform Campaign & Notification Offers Contracts ─────────────
export enum CampaignType {
  PROMOTIONAL_OFFER = 'PROMOTIONAL_OFFER',
  BROADCAST_ANNOUNCEMENT = 'BROADCAST_ANNOUNCEMENT',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  DISCOUNT_COUPON = 'DISCOUNT_COUPON',
  FEATURE_RELEASE = 'FEATURE_RELEASE',
}

export enum TargetAudience {
  ALL_TENANTS = 'ALL_TENANTS',
  BY_PLAN = 'BY_PLAN',
  BY_STATUS = 'BY_STATUS',
  SPECIFIC_TENANTS = 'SPECIFIC_TENANTS',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
  BONUS_DAYS = 'BONUS_DAYS',
  NONE = 'NONE',
}

export enum CampaignBannerStyle {
  EMERALD = 'emerald',
  BLUE = 'blue',
  AMBER = 'amber',
  ROSE = 'rose',
  PURPLE = 'purple',
}

export enum CampaignPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface PlatformOfferCampaign {
  _id: string;
  title: string;
  message: string;
  type: CampaignType;
  targetAudience: TargetAudience;
  targetPlanCodes?: string[];
  targetStatuses?: string[];
  targetTenantIds?: string[];
  promoCode?: string;
  discountType: DiscountType;
  discountValue?: number;
  bannerStyle: CampaignBannerStyle;
  callToAction?: {
    label: string;
    url?: string;
    route?: string;
  };
  isDismissible: boolean;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  priority: CampaignPriority;
  broadcastCount: number;
  lastBroadcastAt?: string;
  createdBy?: {
    _id: string;
    email: string;
    fullName?: string;
  } | string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── SaaS Subscription Allocation & Payment Governance Contracts ───
export type PlatformPaymentMode =
  | 'NEFT'
  | 'RTGS'
  | 'IMPS'
  | 'UPI'
  | 'CASH'
  | 'CHEQUE'
  | 'COMPLIMENTARY';

export type SubscriptionLifecycleStatus =
  | 'active'
  | 'trial'
  | 'grace'
  | 'expired'
  | 'suspended';

export interface AllocateSubscriptionPayload {
  tenantId: string;
  planId: string;
  durationMonths?: number;
  customExpiresAt?: string;
  status: SubscriptionLifecycleStatus;
  recordPayment: boolean;
  paymentMode?: PlatformPaymentMode;
  utrNumber?: string;
  bankName?: string;
  depositedAccount?: string;
  paidAmount?: number;
  paidDate?: string;
  generateInvoice?: boolean;
  reason: string;
}

export interface RecordPaymentPayload {
  subscriptionId?: string;
  tenantId: string;
  mode: 'renew' | 'switch';
  targetPlanId?: string;
  durationMonths?: number;
  customExpiresAt?: string;
  baseAmount: number;
  discountAmount?: number;
  netTaxable: number;
  gstAmount: number;
  totalAmount: number;
  paymentMode: PlatformPaymentMode;
  utrNumber?: string;
  bankName?: string;
  depositedAccount?: string;
  paidDate: string;
  generateInvoice: boolean;
  reason: string;
}

export interface ManualPaymentRequestDTO {
  _id: string;
  tenantId: string;
  tenant?: {
    _id: string;
    firmName: string;
    email: string;
    phone?: string;
    firmGSTIN?: string;
  } | null;
  targetPlanId: string;
  targetPlan?: {
    _id: string;
    name: string;
    code: string;
    baseMonthlyPrice: number;
  } | null;
  durationMonths: number;
  declaredAmount: number;
  expectedAmount: number;
  paymentMode: string;
  utrNumber: string;
  bankName?: string;
  depositedAccount?: string;
  paidDate: string;
  receiptUrl?: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PlatformTaxInvoiceItem {
  description: string;
  sacCode: string;
  durationMonths: number;
  unitPrice: number;
  discount: number;
  taxableAmount: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  total: number;
}

export interface PlatformTaxInvoiceDTO {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  financialYear: string;
  status: 'ISSUED' | 'CANCELLED';
  supplier: {
    legalName: string;
    tradeName: string;
    gstin: string;
    stateCode: string;
    stateName: string;
    address: string;
    email: string;
    phone?: string;
  };
  recipient: {
    tenantId: string;
    firmName: string;
    gstin?: string;
    stateCode?: string;
    stateName?: string;
    address?: string;
    email: string;
    phone?: string;
  };
  items: PlatformTaxInvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  payment: {
    mode: string;
    utrNumber?: string;
    bankName?: string;
    depositedAccount?: string;
    paidDate?: string;
    clearingDate?: string;
  };
  pdfUrl?: string;
  createdAt: string;
  updatedAt?: string;
}



