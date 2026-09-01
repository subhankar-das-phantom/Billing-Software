/**
 * Shared Feature System — Single source of truth for SaaS gating.
 *
 * Both backend middleware and frontend nav filtering import from here.
 * Features are stored in Plan.features[] in the DB, but these enums
 * provide compile-time safety and serve as the canonical list.
 */

// ─── Feature Enum ────────────────────────────────────────────────
export enum Feature {
  DASHBOARD          = 'DASHBOARD',
  CUSTOMERS          = 'CUSTOMERS',
  PRODUCTS           = 'PRODUCTS',
  INVOICE_CREATE     = 'INVOICE_CREATE',
  INVOICE_HISTORY    = 'INVOICE_HISTORY',
  INVOICE_PRINT      = 'INVOICE_PRINT',
  PAYMENTS           = 'PAYMENTS',
  COLLECTIONS        = 'COLLECTIONS',
  CREDIT_NOTES       = 'CREDIT_NOTES',
  NOTES              = 'NOTES',
  MANUAL_ENTRIES     = 'MANUAL_ENTRIES',
  LEDGER             = 'LEDGER',
  OUTSTANDING_TRACKING = 'OUTSTANDING_TRACKING',
  EMPLOYEES          = 'EMPLOYEES',
  EMPLOYEE_ANALYTICS = 'EMPLOYEE_ANALYTICS',
  ACTIVITY_LOGS      = 'ACTIVITY_LOGS',
  GST_REPORTS        = 'GST_REPORTS',
  ADVANCED_REPORTING = 'ADVANCED_REPORTING',
  REPORTS            = 'REPORTS',
  SUPPLIERS          = 'SUPPLIERS',
  PURCHASES          = 'PURCHASES',
  PURCHASE_REPORTS   = 'PURCHASE_REPORTS',
  INVENTORY_LEDGER   = 'INVENTORY_LEDGER',
  INVENTORY_INTELLIGENCE = 'INVENTORY_INTELLIGENCE',
}

// ─── Plan Codes ──────────────────────────────────────────────────
export enum PlanCode {
  STARTER      = 'starter',
  BUSINESS     = 'business',
  PROFESSIONAL = 'professional',
}

// ─── Subscription Statuses ───────────────────────────────────────
export enum SubscriptionStatus {
  TRIAL     = 'trial',
  ACTIVE    = 'active',
  GRACE     = 'grace',
  EXPIRED   = 'expired',
  SUSPENDED = 'suspended',
}

// ─── Payment Statuses ────────────────────────────────────────────
export enum PaymentStatus {
  PENDING   = 'pending',
  COMPLETED = 'completed',
  FAILED    = 'failed',
  REFUNDED  = 'refunded',
}

// ─── Referral Statuses ───────────────────────────────────────────
export enum ReferralStatus {
  PENDING   = 'pending',
  QUALIFIED = 'qualified',
  REWARDED  = 'rewarded',
  REJECTED  = 'rejected',
}

// ─── Referral Reward Types ───────────────────────────────────────
export enum RewardType {
  FREE_DAYS        = 'FREE_DAYS',
  PERCENT_DISCOUNT = 'PERCENT_DISCOUNT',
  FLAT_DISCOUNT    = 'FLAT_DISCOUNT',
}

// ─── Adjustment Types ────────────────────────────────────────────
export enum AdjustmentType {
  REFERRAL_REWARD = 'referral_reward',
  MANUAL_BONUS    = 'manual_bonus',
  PROMOTION       = 'promotion',
  COMPENSATION    = 'compensation',
}

// ─── Notification Types ──────────────────────────────────────────
export enum NotificationType {
  SUBSCRIPTION_EXPIRY_WARNING = 'subscription_expiry_warning',
  SUBSCRIPTION_EXPIRED        = 'subscription_expired',
  SUBSCRIPTION_ACTIVATED      = 'subscription_activated',
  REFERRAL_REWARD             = 'referral_reward',
  PLAN_UPGRADE                = 'plan_upgrade',
  SYSTEM                      = 'system',
}

export enum NotificationChannel {
  IN_APP   = 'in_app',
  EMAIL    = 'email',
  WHATSAPP = 'whatsapp',
}

// ─── Discount Types (for PricingRule) ────────────────────────────
export enum DiscountType {
  PERCENTAGE = 'percentage',
  FLAT       = 'flat',
}

// ─── Payment Gateways ────────────────────────────────────────────
export enum PaymentGateway {
  RAZORPAY = 'razorpay',
  MANUAL   = 'manual',
  FREE     = 'free',
}

// ─── Default Plan → Feature Mapping ─────────────────────────────
// Used by the seeder. At runtime, Plan.features[] from DB is used.

const STARTER_FEATURES: Feature[] = [
  Feature.DASHBOARD,
  Feature.CUSTOMERS,
  Feature.PRODUCTS,
  Feature.INVOICE_CREATE,
  Feature.INVOICE_HISTORY,
  Feature.INVOICE_PRINT,
];

const BUSINESS_FEATURES: Feature[] = [
  ...STARTER_FEATURES,
  Feature.PAYMENTS,
  Feature.COLLECTIONS,
  Feature.CREDIT_NOTES,
  Feature.NOTES,
  Feature.MANUAL_ENTRIES,
  Feature.LEDGER,
  Feature.OUTSTANDING_TRACKING,
  Feature.SUPPLIERS,
  Feature.PURCHASES,
  Feature.PURCHASE_REPORTS,
  Feature.INVENTORY_LEDGER,
];

const PROFESSIONAL_FEATURES: Feature[] = [
  ...BUSINESS_FEATURES,
  Feature.EMPLOYEES,
  Feature.EMPLOYEE_ANALYTICS,
  Feature.ACTIVITY_LOGS,
  Feature.GST_REPORTS,
  Feature.ADVANCED_REPORTING,
  Feature.INVENTORY_INTELLIGENCE,
  Feature.REPORTS,
];

export const DEFAULT_PLAN_FEATURES: Record<PlanCode, Feature[]> = {
  [PlanCode.STARTER]:      STARTER_FEATURES,
  [PlanCode.BUSINESS]:     BUSINESS_FEATURES,
  [PlanCode.PROFESSIONAL]: PROFESSIONAL_FEATURES,
};

// ─── Well-Known System Setting Keys ─────────────────────────────
export const SettingKeys = {
  DEFAULT_TRIAL_DAYS:       'defaultTrialDays',
  DEFAULT_GRACE_DAYS:       'defaultGraceDays',
  REFERRAL_MAX_FREE_DAYS:   'referralMaxFreeDays',
  DEFAULT_TRIAL_PLAN:       'defaultTrialPlan',
  RAZORPAY_KEY_ID:          'razorpayKeyId',
  RAZORPAY_WEBHOOK_SECRET:  'razorpayWebhookSecret',
} as const;

// ─── Supported Subscription Durations ────────────────────────────
export const SUPPORTED_DURATIONS = [1, 3, 6, 12] as const;
export type SupportedDuration = typeof SUPPORTED_DURATIONS[number];
