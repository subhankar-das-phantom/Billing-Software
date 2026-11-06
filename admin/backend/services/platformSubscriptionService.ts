/**
 * Bharat Enterprise Billing System — Platform Subscription & Entitlement Engine
 *
 * Implements 5-Level Entitlement Precedence Resolution, State Machine Guards,
 * Integer Bounds Verification, Temporal Auto-Degradation, and Plan Downgrade Safety.
 */

import { Types } from 'mongoose';
import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import SubscriptionPayment from '../../../backend/saas/models/SubscriptionPayment';
import {
  acquireLease,
  releaseLease,
} from '../../../backend/models/DistributedLock';
import {
  activateSubscription,
  applyAutoRenewalCycle,
  updateAutoRenewStatus,
} from '../../../backend/saas/services/subscriptionService';
import { invalidatePlatformDashboardCache } from '../queries/dashboardQueries';
import { logPlatformAudit } from './platformAuditService';
import {
  PaymentStatus,
  PaymentGateway,
} from '../../../backend/saas/shared/features';
import {
  SubscriptionStatus,
  validateStateTransition,
  resolveAutoDegradedStatus,
  StateTransitionContext,
  ITenantSubscription,
  TenantSubscription,
} from '../models/TenantSubscription';
import {
  FeatureOverride,
  IFeatureOverride,
  validateLimitValue,
} from '../models/FeatureOverride';

// ─── System Global Defaults (Level 1) ─────────────────────────────
export interface FeatureDefinition {
  featureKey: string;
  defaultEnabled: boolean;
  defaultLimit: number | null;
  isPremium: boolean;
}

export const SYSTEM_GLOBAL_DEFAULTS: Record<string, FeatureDefinition> = {
  CUSTOMERS: {
    featureKey: 'CUSTOMERS',
    defaultEnabled: true,
    defaultLimit: null,
    isPremium: false,
  },
  PRODUCTS: {
    featureKey: 'PRODUCTS',
    defaultEnabled: true,
    defaultLimit: null,
    isPremium: false,
  },
  INVOICE_CREATE: {
    featureKey: 'INVOICE_CREATE',
    defaultEnabled: true,
    defaultLimit: 50,
    isPremium: false,
  },
  USERS: {
    featureKey: 'USERS',
    defaultEnabled: true,
    defaultLimit: 1,
    isPremium: false,
  },
  GST_REPORTS: {
    featureKey: 'GST_REPORTS',
    defaultEnabled: false,
    defaultLimit: 0,
    isPremium: true,
  },
  ADVANCED_REPORTING: {
    featureKey: 'ADVANCED_REPORTING',
    defaultEnabled: false,
    defaultLimit: 0,
    isPremium: true,
  },
  INVENTORY_INTELLIGENCE: {
    featureKey: 'INVENTORY_INTELLIGENCE',
    defaultEnabled: false,
    defaultLimit: 0,
    isPremium: true,
  },
  ACTIVITY_LOGS: {
    featureKey: 'ACTIVITY_LOGS',
    defaultEnabled: false,
    defaultLimit: 0,
    isPremium: true,
  },
};

// ─── Plan Tier Definitions (Level 2) ──────────────────────────────
export interface PlanTierDefinition {
  code: string;
  name: string;
  features: string[];
  limits: Record<string, number | null>;
}

export const PLAN_TIERS: Record<string, PlanTierDefinition> = {
  starter: {
    code: 'starter',
    name: 'Starter Plan',
    features: ['CUSTOMERS', 'PRODUCTS', 'INVOICE_CREATE', 'USERS'],
    limits: {
      USERS: 3,
      INVOICE_CREATE: 100,
      CUSTOMERS: 200,
      GST_REPORTS: 0,
      INVENTORY_INTELLIGENCE: 0,
      ADVANCED_REPORTING: 0,
      ACTIVITY_LOGS: 0,
    },
  },
  business: {
    code: 'business',
    name: 'Business Plan',
    features: ['CUSTOMERS', 'PRODUCTS', 'INVOICE_CREATE', 'USERS', 'GST_REPORTS', 'ACTIVITY_LOGS'],
    limits: {
      USERS: 10,
      INVOICE_CREATE: null,
      CUSTOMERS: null,
      GST_REPORTS: null,
      ACTIVITY_LOGS: null,
      INVENTORY_INTELLIGENCE: 0,
      ADVANCED_REPORTING: 0,
    },
  },
  enterprise: {
    code: 'enterprise',
    name: 'Enterprise Plan',
    features: [
      'CUSTOMERS',
      'PRODUCTS',
      'INVOICE_CREATE',
      'USERS',
      'GST_REPORTS',
      'ADVANCED_REPORTING',
      'INVENTORY_INTELLIGENCE',
      'ACTIVITY_LOGS',
    ],
    limits: {
      USERS: 100,
      INVOICE_CREATE: null,
      CUSTOMERS: null,
      GST_REPORTS: null,
      ADVANCED_REPORTING: null,
      INVENTORY_INTELLIGENCE: null,
      ACTIVITY_LOGS: null,
    },
  },
  professional: {
    code: 'professional',
    name: 'Professional Plan',
    features: [
      'CUSTOMERS',
      'PRODUCTS',
      'INVOICE_CREATE',
      'USERS',
      'GST_REPORTS',
      'ADVANCED_REPORTING',
      'INVENTORY_INTELLIGENCE',
      'ACTIVITY_LOGS',
    ],
    limits: {
      USERS: 50,
      INVOICE_CREATE: null,
      CUSTOMERS: null,
      GST_REPORTS: null,
      ADVANCED_REPORTING: null,
      INVENTORY_INTELLIGENCE: null,
      ACTIVITY_LOGS: null,
    },
  },
};

// ─── Entitlement Precedence Interfaces ────────────────────────────
export interface ResolvedFeatureEntitlement {
  featureKey: string;
  isEnabled: boolean;
  limitValue: number | null;
  isPremium: boolean;
  precedenceLevel: number;
  resolvedSource:
    | 'LEVEL_1_GLOBAL_DEFAULT'
    | 'LEVEL_2_PLAN_TIER'
    | 'LEVEL_3_STATE_MULTIPLIER'
    | 'LEVEL_4_TENANT_OVERRIDE';
}

export interface EffectiveEntitlementsResult {
  tenantId: string;
  storedStatus: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  planCode: string;
  canWrite: boolean;
  features: Record<string, ResolvedFeatureEntitlement>;
  overridesAppliedCount: number;
  expiredOverridesDroppedCount: number;
}

export interface EntitlementContext {
  currentDate?: Date;
  subscription?: {
    status: SubscriptionStatus;
    planCode: string;
    startDate: Date;
    endDate: Date;
    trialEndsAt?: Date | null;
    gracePeriodEndsAt?: Date | null;
  } | null;
  overrides?: Array<{
    featureKey: string;
    isEnabled: boolean;
    limitValue?: number | null;
    expiresAt?: Date | null;
    isActive?: boolean;
  }>;
  planTier?: PlanTierDefinition;
  globalDefaults?: Record<string, FeatureDefinition>;
}

/**
 * Pure evaluation function for the 5-Level Entitlement Precedence Matrix.
 */
export function evaluateEffectiveEntitlements(
  tenantId: string,
  context: EntitlementContext = {},
): EffectiveEntitlementsResult {
  const currentDate = context.currentDate || new Date();
  const globalDefaults = context.globalDefaults || SYSTEM_GLOBAL_DEFAULTS;

  // Resolve subscription & effective auto-degraded status
  let storedStatus = SubscriptionStatus.EXPIRED;
  let effectiveStatus = SubscriptionStatus.EXPIRED;
  let planCode = 'none';

  let planTier: PlanTierDefinition = {
    code: 'none',
    name: 'No Plan',
    features: [],
    limits: {},
  };

  if (context.planTier) {
    planTier = context.planTier;
    planCode = planTier.code;
  } else if (context.subscription) {
    storedStatus = context.subscription.status;
    effectiveStatus = resolveAutoDegradedStatus(context.subscription, currentDate);
    planCode = context.subscription.planCode || 'starter';
    planTier =
      PLAN_TIERS[planCode.toLowerCase()] ||
      PLAN_TIERS.starter!;
  }

  const overrides = context.overrides || [];
  let overridesAppliedCount = 0;
  let expiredOverridesDroppedCount = 0;

  // Map active unexpired overrides by featureKey
  const activeOverrideMap = new Map<
    string,
    {
      featureKey: string;
      isEnabled: boolean;
      limitValue?: number | null;
      expiresAt?: Date | null;
      isActive?: boolean;
    }
  >();

  for (const ov of overrides) {
    if (ov.isActive === false) {
      continue;
    }

    // Level 5 check: Is the override expired?
    const isExpired =
      ov.expiresAt !== null &&
      ov.expiresAt !== undefined &&
      new Date(ov.expiresAt).getTime() <= currentDate.getTime();

    if (isExpired) {
      expiredOverridesDroppedCount++;
      continue; // Dropped back immediately to Plan Tier with ZERO ghost privileges
    }

    activeOverrideMap.set(ov.featureKey, ov);
  }

  // Determine global write privileges based on effective commercial status
  let canWrite = false;
  if (
    effectiveStatus === SubscriptionStatus.ACTIVE ||
    effectiveStatus === SubscriptionStatus.TRIAL ||
    effectiveStatus === SubscriptionStatus.GRACE_PERIOD
  ) {
    canWrite = true;
  }

  // Collect all known feature keys
  const allFeatureKeys = new Set<string>([
    ...Object.keys(globalDefaults),
    ...planTier.features,
    ...Object.keys(planTier.limits),
    ...activeOverrideMap.keys(),
  ]);

  const features: Record<string, ResolvedFeatureEntitlement> = {};

  for (const featureKey of allFeatureKeys) {
    const defaultDef = globalDefaults[featureKey] || {
      featureKey,
      defaultEnabled: false,
      defaultLimit: null,
      isPremium: false,
    };

    // ─── Level 1: System Global Default ───────────────────────────
    let isEnabled = defaultDef.defaultEnabled;
    let limitValue = defaultDef.defaultLimit;
    const isPremium = defaultDef.isPremium;
    let precedenceLevel = 1;
    let resolvedSource: ResolvedFeatureEntitlement['resolvedSource'] =
      'LEVEL_1_GLOBAL_DEFAULT';

    // ─── Level 2: Plan Tier Base Entitlement ──────────────────────
    const isInPlan = planTier.features.includes(featureKey);
    const planLimit = planTier.limits[featureKey];

    if (isInPlan || planLimit !== undefined) {
      isEnabled = isInPlan;
      if (planLimit !== undefined) {
        limitValue = planLimit;
      }
      precedenceLevel = 2;
      resolvedSource = 'LEVEL_2_PLAN_TIER';
    }

    // ─── Level 3: Tenant Subscription State Multiplier ────────────
    if (effectiveStatus === SubscriptionStatus.SUSPENDED) {
      // SUSPENDED blocks all premium features completely!
      if (isPremium) {
        isEnabled = false;
        limitValue = 0;
        precedenceLevel = 3;
        resolvedSource = 'LEVEL_3_STATE_MULTIPLIER';
      }
    } else if (
      effectiveStatus === SubscriptionStatus.EXPIRED ||
      effectiveStatus === SubscriptionStatus.CANCELLED
    ) {
      // EXPIRED/CANCELLED locks write features and blocks premium capabilities
      if (isPremium) {
        isEnabled = false;
        limitValue = 0;
        precedenceLevel = 3;
        resolvedSource = 'LEVEL_3_STATE_MULTIPLIER';
      }
    }

    // ─── Level 4: Active Tenant-Specific Override ──────────────────
    const override = activeOverrideMap.get(featureKey);
    if (override) {
      isEnabled = override.isEnabled;
      if (override.limitValue !== undefined && override.limitValue !== null) {
        const sanitized = validateLimitValue(override.limitValue);
        if (sanitized.valid && sanitized.value !== null) {
          limitValue = sanitized.value;
        }
      }
      precedenceLevel = 4;
      resolvedSource = 'LEVEL_4_TENANT_OVERRIDE';
      overridesAppliedCount++;
    }

    features[featureKey] = {
      featureKey,
      isEnabled,
      limitValue,
      isPremium,
      precedenceLevel,
      resolvedSource,
    };
  }

  return {
    tenantId,
    storedStatus,
    effectiveStatus,
    planCode,
    canWrite,
    features,
    overridesAppliedCount,
    expiredOverridesDroppedCount,
  };
}

/**
 * Asynchronous service call resolving effective entitlements for a tenant.
 * Uses DB queries if context is omitted, or in-memory context when provided.
 */
export async function calculateEffectiveFeatures(
  tenantId: string | Types.ObjectId,
  context?: EntitlementContext,
): Promise<EffectiveEntitlementsResult> {
  const tenantStr = tenantId.toString();

  if (context && context.subscription !== undefined) {
    return evaluateEffectiveEntitlements(tenantStr, context);
  }

  const currentDate = context?.currentDate || new Date();
  const subDoc = await TenantSubscription.findOne({
    tenantId: new Types.ObjectId(tenantStr),
  })
    .sort({ createdAt: -1 })
    .lean();

  const overrideDocs = await FeatureOverride.find({
    tenantId: new Types.ObjectId(tenantStr),
    isActive: true,
  }).lean();

  return evaluateEffectiveEntitlements(tenantStr, {
    currentDate,
    subscription: subDoc as any,
    overrides: overrideDocs as any,
    planTier: context?.planTier,
    globalDefaults: context?.globalDefaults,
  });
}

/**
 * Verifies whether a tenant is entitled to a specific feature.
 */
export async function isFeatureEntitled(
  tenantId: string | Types.ObjectId,
  featureKey: string,
  context?: EntitlementContext,
): Promise<boolean> {
  const result = await calculateEffectiveFeatures(tenantId, context);
  const entitlement = result.features[featureKey];
  return entitlement ? entitlement.isEnabled === true : false;
}

/**
 * Gets the numeric entitlement limit for a feature.
 */
export async function getFeatureLimit(
  tenantId: string | Types.ObjectId,
  featureKey: string,
  context?: EntitlementContext,
): Promise<number | null> {
  const result = await calculateEffectiveFeatures(tenantId, context);
  const entitlement = result.features[featureKey];
  return entitlement ? entitlement.limitValue : null;
}

/**
 * Transitions a subscription's state with full guard validation.
 */
export async function transitionSubscriptionState(
  subscription: ITenantSubscription,
  targetStatus: SubscriptionStatus,
  context: StateTransitionContext = {},
): Promise<ITenantSubscription> {
  const validation = validateStateTransition(subscription.status, targetStatus, context);
  if (!validation.allowed) {
    throw new Error(validation.reason || `Transition to ${targetStatus} is rejected by state guards.`);
  }

  subscription.status = targetStatus;
  if (typeof (subscription as any).save === 'function') {
    await (subscription as any).save();
  }
  return subscription;
}

/**
 * Auto-degrades subscription status dynamically based on current date.
 */
export function resolveSubscriptionStatus(
  subscription: {
    status: SubscriptionStatus;
    startDate: Date;
    endDate: Date;
    trialEndsAt?: Date | null;
    gracePeriodEndsAt?: Date | null;
  },
  currentDate: Date = new Date(),
): SubscriptionStatus {
  return resolveAutoDegradedStatus(subscription, currentDate);
}

/**
 * Bounds checking and sanitization utility for feature limits.
 */
export function sanitizeLimitValue(val: unknown): number | null {
  const res = validateLimitValue(val);
  if (!res.valid) {
    throw new Error(res.error || `Invalid limit value: ${val}`);
  }
  return res.value;
}

// ─── Plan Downgrade Under Utilization Hazard Engine ───────────────
export interface DowngradeHazard {
  featureKey: string;
  currentUsage: number;
  targetLimit: number;
  excess: number;
  severity: 'CRITICAL' | 'WARNING';
  message: string;
}

export interface PlanDowngradeAssessment {
  tenantId: string;
  currentPlanCode: string;
  targetPlanCode: string;
  isOverLimit: boolean;
  dataLossPrevented: boolean;
  canProvisionMore: boolean;
  hazards: DowngradeHazard[];
  actionRecommendation: 'PERMIT_WITH_SOFT_LOCK' | 'SAFE_DOWNGRADE';
  safeStateDetails: {
    existingRecordsIntactCount: number;
    excessFrozenCount: number;
  };
}

/**
 * Assesses and protects tenant data integrity during plan downgrade when utilization exceeds new limits.
 * Guarantees zero data loss, prevents crashes, and applies non-destructive soft-locks to new additions.
 */
export function evaluatePlanDowngrade(params: {
  tenantId: string;
  currentPlanCode: string;
  targetPlanCode: string;
  currentUsage: Record<string, number>;
}): PlanDowngradeAssessment {
  const targetPlan =
    PLAN_TIERS[params.targetPlanCode.toLowerCase()] ||
    PLAN_TIERS.starter!;

  const hazards: DowngradeHazard[] = [];
  let isOverLimit = false;
  let totalExcess = 0;
  let totalUsage = 0;

  for (const [key, usage] of Object.entries(params.currentUsage)) {
    totalUsage += usage;
    const targetLimit = targetPlan.limits[key];

    if (targetLimit !== null && targetLimit !== undefined && usage > targetLimit) {
      isOverLimit = true;
      const excess = usage - targetLimit;
      totalExcess += excess;

      hazards.push({
        featureKey: key,
        currentUsage: usage,
        targetLimit,
        excess,
        severity: 'CRITICAL',
        message: `Current usage of ${usage} for "${key}" exceeds target plan limit of ${targetLimit} by ${excess}.`,
      });
    }
  }

  return {
    tenantId: params.tenantId,
    currentPlanCode: params.currentPlanCode,
    targetPlanCode: params.targetPlanCode,
    isOverLimit,
    dataLossPrevented: true, // Guarantees existing data is NOT deleted or corrupted
    canProvisionMore: !isOverLimit, // Soft-locks new entity creation while preserving existing records
    hazards,
    actionRecommendation: isOverLimit ? 'PERMIT_WITH_SOFT_LOCK' : 'SAFE_DOWNGRADE',
    safeStateDetails: {
      existingRecordsIntactCount: totalUsage,
      excessFrozenCount: totalExcess,
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// ─── GATEWAY, WEBHOOK & PAYMENT RECONCILIATION HARDENING ENGINE ─────
// ═════════════════════════════════════════════════════════════════════

function getAdminModel() {
  const mongoose = require('mongoose');
  if (mongoose.models.Admin) {
    return mongoose.models.Admin;
  }
  const loaded = require('../../../backend/models/Admin');
  return loaded.default || loaded;
}

function getRazorpayInstance() {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
      const Razorpay = require('razorpay');
      return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Constant-time string comparison resistant to timing side-channel attacks.
 * Pre-hashes inputs using SHA-256 so `crypto.timingSafeEqual` always compares
 * identical 32-byte buffers without throwing `RangeError` on length mismatch.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  const hashesMatch = crypto.timingSafeEqual(hashA, hashB);
  return hashesMatch && a.length === b.length;
}

/**
 * Verifies Razorpay webhook HMAC-SHA256 signature timing-safely.
 * Never throws uncaught errors on malformed, truncated, or missing inputs.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined | null,
  secret: string,
): boolean {
  if (!signature || typeof signature !== 'string' || !secret || typeof secret !== 'string') {
    return false;
  }
  const cleanSig = signature.trim();
  if (cleanSig.length === 0) {
    return false;
  }

  // Reject non-hex strings or unexpected formats defensively
  if (!/^[a-fA-F0-9]{64}$/.test(cleanSig)) {
    return false;
  }

  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(bodyBuffer)
    .digest('hex');

  return timingSafeCompare(expectedSignature, cleanSig);
}

/**
 * Verifies Razorpay payment signature for checkout verification (verifyPayment).
 * Supports both order checkout (`${order_id}|${payment_id}`) and recurring
 * subscription (`${payment_id}|${subscription_id}`).
 */
export function verifyPaymentSignature(params: {
  orderId?: string;
  subscriptionId?: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  const { orderId, subscriptionId, paymentId, signature, secret } = params;
  if (!signature || typeof signature !== 'string' || !secret || typeof secret !== 'string' || !paymentId) {
    return false;
  }
  const cleanSig = signature.trim();
  if (!/^[a-fA-F0-9]{64}$/.test(cleanSig)) {
    return false;
  }

  let payload = '';
  if (subscriptionId) {
    payload = `${paymentId}|${subscriptionId}`;
  } else if (orderId) {
    payload = `${orderId}|${paymentId}`;
  } else {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return timingSafeCompare(expectedSignature, cleanSig);
}

export interface FinancialValidationResult {
  valid: boolean;
  code?: number;
  message?: string;
}

/**
 * Strict validation of webhook financial payloads:
 * - Rejects negative amounts (e.g. -50000)
 * - Rejects fractional paise floating-point values (e.g. 49999.99999)
 * - Rejects non-numeric/NaN amounts
 * - Rejects foreign currencies (only INR accepted)
 */
export function validateFinancialPayload(paymentEntity: any): FinancialValidationResult {
  if (!paymentEntity || typeof paymentEntity !== 'object') {
    return { valid: true };
  }

  if ('amount' in paymentEntity) {
    const rawAmount = paymentEntity.amount;
    if (
      typeof rawAmount !== 'number' ||
      !Number.isFinite(rawAmount) ||
      Number.isNaN(rawAmount) ||
      !Number.isInteger(rawAmount) ||
      rawAmount <= 0
    ) {
      return {
        valid: false,
        code: 400,
        message: 'Invalid payment amount: must be a positive integer in paise without fractions',
      };
    }
  }

  if (paymentEntity.currency) {
    const currency = String(paymentEntity.currency).trim().toUpperCase();
    if (currency !== 'INR') {
      return {
        valid: false,
        code: 400,
        message: `Unsupported currency "${currency}": only INR is accepted`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates metadata passed in webhooks (e.g. notes.tenantId):
 * - Confirms valid ObjectId formatting
 * - Confirms tenant exists in the database
 */
export async function validateWebhookMetadata(
  notes: any,
): Promise<{ valid: boolean; code?: number; message?: string; tenant?: any }> {
  if (!notes || typeof notes !== 'object') {
    return { valid: true };
  }

  if (notes.tenantId) {
    const tenantIdStr = String(notes.tenantId).trim();
    if (!Types.ObjectId.isValid(tenantIdStr)) {
      return {
        valid: false,
        code: 400,
        message: 'Invalid tenantId format in payment metadata',
      };
    }

    const Admin = getAdminModel();
    const tenant = await Admin.findById(tenantIdStr).lean();
    if (!tenant) {
      return {
        valid: false,
        code: 404,
        message: `Tenant "${tenantIdStr}" specified in payment metadata does not exist`,
      };
    }

    return { valid: true, tenant };
  }

  return { valid: true };
}

async function waitForPaymentCompletion(
  paymentId: string,
  maxWaitMs: number = 3000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const payment = await SubscriptionPayment.findOne({
      gatewayPaymentId: paymentId,
      paymentStatus: PaymentStatus.COMPLETED,
    }).lean();
    if (payment) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

/**
 * Core processor for Razorpay Webhook events.
 * Fully decoupled from Express request objects for native, high-speed testability.
 */
export async function processRazorpayWebhook(
  rawBody: Buffer | string,
  signature: string | undefined | null,
  eventId?: string,
  customSecret?: string,
): Promise<{ statusCode: number; body: Record<string, any> }> {
  const webhookSecret = customSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return {
      statusCode: 503,
      body: { success: false, message: 'Razorpay webhook secret not configured' },
    };
  }

  // Step 1: Signature Verification (Strict & Timing-Safe)
  if (!signature || typeof signature !== 'string' || signature.trim().length === 0) {
    return {
      statusCode: 400,
      body: { success: false, message: 'Missing or empty X-Razorpay-Signature header' },
    };
  }

  const isValidSignature = verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValidSignature) {
    return {
      statusCode: 400,
      body: { success: false, message: 'Invalid webhook signature' },
    };
  }

  // Step 2: Body Parsing
  let event: any;
  try {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    event = JSON.parse(bodyStr);
  } catch {
    return {
      statusCode: 400,
      body: { success: false, message: 'Malformed webhook JSON payload' },
    };
  }

  const eventName = event.event;
  const paymentEntity = event.payload?.payment?.entity || null;
  const subscriptionEntity = event.payload?.subscription?.entity || null;
  const invoiceEntity = event.payload?.invoice?.entity || null;

  // Step 3: Financial Payload Validation
  if (paymentEntity) {
    const finValidation = validateFinancialPayload(paymentEntity);
    if (!finValidation.valid) {
      return {
        statusCode: finValidation.code || 400,
        body: { success: false, message: finValidation.message },
      };
    }
  }

  // Step 4: Metadata & Tenant Integrity Validation
  const notes =
    paymentEntity?.notes ||
    subscriptionEntity?.notes ||
    event.payload?.order?.entity?.notes;
  if (notes) {
    const metaValidation = await validateWebhookMetadata(notes);
    if (!metaValidation.valid) {
      return {
        statusCode: metaValidation.code || 400,
        body: { success: false, message: metaValidation.message },
      };
    }
  }

  // Step 5: Entity Resolution
  const gatewaySubscriptionId =
    subscriptionEntity?.id ||
    paymentEntity?.subscription_id ||
    invoiceEntity?.subscription_id;
  const gatewayOrderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
  const paymentId = paymentEntity?.id;

  if (!gatewaySubscriptionId && !gatewayOrderId && !paymentId && !notes?.tenantId) {
    return {
      statusCode: 200,
      body: { success: true, ignored: true, reason: 'No actionable gateway identifiers found' },
    };
  }

  // Step 6: Handle Subscription Status Updates (e.g. subscription.cancelled, subscription.halted)
  if (subscriptionEntity && gatewaySubscriptionId) {
    await updateAutoRenewStatus(gatewaySubscriptionId, subscriptionEntity);
    const status = subscriptionEntity.status;
    if (['cancelled', 'completed', 'expired', 'halted'].includes(status)) {
      await SubscriptionPayment.updateMany(
        { gatewaySubscriptionId, paymentStatus: PaymentStatus.PENDING },
        {
          $set: {
            'metadata.gatewaySubscriptionStatus': status,
            'metadata.cancelledAt': new Date(),
          },
        },
      );
    }
  }

  // Step 7: Handle Payment Captured / Charged / Paid Events
  const isPaymentSuccess =
    paymentEntity &&
    ['subscription.charged', 'payment.captured', 'invoice.paid', 'order.paid'].includes(eventName);

  if (isPaymentSuccess && paymentId) {
    // Fast path: already completed and recorded in database
    const existingCompleted = await SubscriptionPayment.findOne({
      gatewayPaymentId: paymentId,
      paymentStatus: PaymentStatus.COMPLETED,
    }).lean();

    if (existingCompleted) {
      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Payment already processed and reconciled',
          idempotent: true,
          paymentId: existingCompleted._id,
        },
      };
    }

    // Acquire distributed lease on the specific payment ID to serialize concurrent deliveries
    const lockKey = `webhook:payment:${paymentId}`;
    const lease = await acquireLease(lockKey, 15000);

    if (!lease.acquired) {
      // Another concurrent worker acquired the lease. Wait for completion.
      const completed = await waitForPaymentCompletion(paymentId, 3000);
      if (completed) {
        return {
          statusCode: 200,
          body: {
            success: true,
            message: 'Payment already processed and reconciled',
            idempotent: true,
          },
        };
      }
      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Payment processing in progress concurrently',
          queued: true,
        },
      };
    }

    try {
      // Re-verify under lease
      const rechecked = await SubscriptionPayment.findOne({
        gatewayPaymentId: paymentId,
        paymentStatus: PaymentStatus.COMPLETED,
      }).lean();

      if (rechecked) {
        return {
          statusCode: 200,
          body: {
            success: true,
            message: 'Payment already processed and reconciled',
            idempotent: true,
            paymentId: rechecked._id,
          },
        };
      }

      // Check for an existing PENDING payment to claim
      const pendingQuery: Record<string, any> = {
        paymentStatus: PaymentStatus.PENDING,
        $or: [
          { gatewayPaymentId: paymentId },
          ...(gatewayOrderId ? [{ gatewayOrderId }] : []),
          ...(gatewaySubscriptionId ? [{ gatewaySubscriptionId }] : []),
        ],
      };

      const pendingPayment = await SubscriptionPayment.findOne(pendingQuery).sort({ createdAt: -1 });

      if (pendingPayment) {
        // Atomically claim the pending payment record via CAS
        const claimed = await SubscriptionPayment.findOneAndUpdate(
          {
            _id: pendingPayment._id,
            paymentStatus: PaymentStatus.PENDING,
          },
          {
            $set: {
              paymentStatus: PaymentStatus.COMPLETED,
              gatewayPaymentId: paymentId,
              gatewayOrderId: gatewayOrderId || pendingPayment.gatewayOrderId,
              gatewaySubscriptionId: gatewaySubscriptionId || pendingPayment.gatewaySubscriptionId,
              gatewayInvoiceId: paymentEntity.invoice_id || pendingPayment.gatewayInvoiceId,
              gatewayEventId: eventId,
              paidAt: paymentEntity.created_at ? new Date(paymentEntity.created_at * 1000) : new Date(),
              'metadata.method': paymentEntity.method,
              'metadata.eventId': eventId,
              'metadata.claimedAt': new Date(),
            },
          },
          { new: true },
        );

        if (!claimed) {
          return {
            statusCode: 200,
            body: {
              success: true,
              message: 'Payment already claimed and processed concurrently',
              idempotent: true,
            },
          };
        }

        const isCancelled =
          subscriptionEntity?.status === 'cancelled' ||
          pendingPayment.metadata?.gatewaySubscriptionStatus === 'cancelled';

        await activateSubscription(
          claimed.tenantId.toString(),
          claimed.planId.toString(),
          claimed.durationMonths,
          claimed._id.toString(),
          {
            autoRenew: isCancelled ? false : claimed.billingMode === 'auto',
            gatewaySubscriptionId: claimed.gatewaySubscriptionId || undefined,
            gatewayCustomerId: subscriptionEntity?.customer_id || paymentEntity.customer_id,
            autoRenewStatus: isCancelled ? 'cancelled' : subscriptionEntity?.status,
          },
        );

        invalidatePlatformDashboardCache();

        return {
          statusCode: 200,
          body: {
            success: true,
            message: 'Subscription payment successfully processed and activated',
            paymentId: claimed._id,
          },
        };
      }

      // If recurring subscription renewal cycle:
      if (gatewaySubscriptionId) {
        const renewalResult = await applyAutoRenewalCycle(
          gatewaySubscriptionId,
          paymentEntity,
          eventId,
          subscriptionEntity,
        );

        invalidatePlatformDashboardCache();

        return {
          statusCode: 200,
          body: {
            success: true,
            message: renewalResult.duplicate
              ? 'Duplicate renewal cycle ignored'
              : 'Auto-renewal cycle applied successfully',
            duplicate: renewalResult.duplicate,
          },
        };
      }

      // Out-of-order delivery self-healing: Payment captured before order recorded, but notes contains tenantId and planId
      if (notes?.tenantId && notes?.planId) {
        const plan = await Plan.findById(notes.planId).lean();
        const durationMonths = parseInt(notes.durationMonths || '1', 10) || 1;
        const baseAmount = (plan?.baseMonthlyPrice || 0) * durationMonths;
        const finalAmount = (paymentEntity.amount || 0) / 100;

        const newPayment = await SubscriptionPayment.create({
          tenantId: new Types.ObjectId(notes.tenantId),
          planId: new Types.ObjectId(notes.planId),
          durationMonths,
          baseAmount,
          discountAmount: Math.max(0, baseAmount - finalAmount),
          finalAmount,
          paymentGateway: PaymentGateway.RAZORPAY,
          gatewayPaymentId: paymentId,
          gatewayOrderId,
          gatewaySubscriptionId,
          paymentStatus: PaymentStatus.COMPLETED,
          billingMode: gatewaySubscriptionId ? 'auto' : 'manual',
          gatewayEventId: eventId,
          paidAt: paymentEntity.created_at ? new Date(paymentEntity.created_at * 1000) : new Date(),
          metadata: {
            selfHealed: true,
            outOfOrder: true,
            eventId,
            method: paymentEntity.method,
          },
        });

        await activateSubscription(
          notes.tenantId,
          notes.planId,
          durationMonths,
          newPayment._id.toString(),
          {
            autoRenew: Boolean(gatewaySubscriptionId),
            gatewaySubscriptionId,
          },
        );

        invalidatePlatformDashboardCache();

        return {
          statusCode: 200,
          body: {
            success: true,
            message: 'Out-of-order payment captured and subscription self-healed',
            paymentId: newPayment._id,
            selfHealed: true,
          },
        };
      }

      return {
        statusCode: 200,
        body: {
          success: true,
          ignored: true,
          reason: 'No matching order or pending payment, and insufficient metadata for self-healing',
        },
      };
    } finally {
      if (lease.ownerToken) {
        await releaseLease(lockKey, lease.ownerToken);
      }
    }
  }

  // Step 8: Handle Payment Failed Event
  if (paymentEntity && eventName === 'payment.failed') {
    await SubscriptionPayment.updateMany(
      {
        paymentStatus: PaymentStatus.PENDING,
        $or: [
          ...(gatewaySubscriptionId ? [{ gatewaySubscriptionId }] : []),
          ...(gatewayOrderId ? [{ gatewayOrderId }] : []),
          ...(paymentId ? [{ gatewayPaymentId: paymentId }] : []),
        ],
      },
      {
        $set: {
          paymentStatus: PaymentStatus.FAILED,
          gatewayPaymentId: paymentId,
          gatewayEventId: eventId,
          'metadata.failureReason': paymentEntity.error_description,
          'metadata.errorCode': paymentEntity.error_code,
        },
      },
    );

    return {
      statusCode: 200,
      body: { success: true, message: 'Payment marked as failed' },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, event: eventName },
  };
}

/**
 * Express middleware wrapper for handling Razorpay webhooks.
 */
export async function handleRazorpayWebhook(
  req: any,
  res: Response,
  next?: NextFunction,
): Promise<void> {
  try {
    const signature = (req.headers['x-razorpay-signature'] ||
      req.headers['X-Razorpay-Signature']) as string | undefined;
    const eventId = (req.headers['x-razorpay-event-id'] ||
      req.headers['X-Razorpay-Event-Id']) as string | undefined;

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

    const result = await processRazorpayWebhook(rawBody, signature, eventId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    if (next) {
      next(error);
    } else {
      res.status(500).json({
        success: false,
        message: (error as any)?.message || 'Internal server error',
      });
    }
  }
}

/**
 * Two-phase gateway payment reconciliation with atomic CAS and cryptographic audit trail.
 */
export async function reconcilePayment(
  paymentId: string,
  reason: string,
  operator?: any,
): Promise<{ success: boolean; statusCode: number; message: string; data?: any }> {
  if (!paymentId || typeof paymentId !== 'string' || paymentId.trim().length === 0) {
    return {
      success: false,
      statusCode: 400,
      message: 'Valid payment ID is required',
    };
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    return {
      success: false,
      statusCode: 400,
      message: 'A valid operational reason (minimum 10 characters) is required',
    };
  }

  const cleanPaymentId = paymentId.trim();

  // Phase 1: Verify Payment Existence & Gateway Status
  const query = Types.ObjectId.isValid(cleanPaymentId)
    ? { $or: [{ _id: new Types.ObjectId(cleanPaymentId) }, { gatewayPaymentId: cleanPaymentId }] }
    : { gatewayPaymentId: cleanPaymentId };

  const existingPayment = await SubscriptionPayment.findOne(query).lean();
  if (!existingPayment) {
    return {
      success: false,
      statusCode: 404,
      message: 'Subscription payment record not found',
    };
  }

  if (existingPayment.paymentStatus === PaymentStatus.COMPLETED) {
    return {
      success: true,
      statusCode: 200,
      message: 'Payment has already been completed and reconciled',
      data: { payment: existingPayment, idempotent: true },
    };
  }

  const razorpay = getRazorpayInstance();
  if (
    existingPayment.paymentGateway === PaymentGateway.RAZORPAY &&
    existingPayment.gatewayPaymentId &&
    razorpay
  ) {
    try {
      const remotePayment = await razorpay.payments.fetch(existingPayment.gatewayPaymentId);
      if (remotePayment.status !== 'captured') {
        return {
          success: false,
          statusCode: 400,
          message: `Gateway payment status is "${remotePayment.status}", not "captured". Cannot reconcile incomplete payment.`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        statusCode: 502,
        message: `Razorpay verification failed: ${err.message || 'Gateway query error'}`,
      };
    }
  }

  // Phase 2: Atomically Claim & Reconcile Payment (CAS pattern)
  const claimedPayment = await SubscriptionPayment.findOneAndUpdate(
    {
      _id: existingPayment._id,
      paymentStatus: { $ne: PaymentStatus.COMPLETED },
    },
    {
      $set: {
        paymentStatus: PaymentStatus.COMPLETED,
        paidAt: new Date(),
        'metadata.reconciledAt': new Date(),
        'metadata.reconciledBy': operator?._id,
        'metadata.reconcileReason': reason,
      },
    },
    { new: true },
  );

  if (!claimedPayment) {
    return {
      success: false,
      statusCode: 409,
      message: 'Payment was already reconciled concurrently by another process',
    };
  }

  const activation = await activateSubscription(
    claimedPayment.tenantId.toString(),
    claimedPayment.planId.toString(),
    claimedPayment.durationMonths,
    claimedPayment._id.toString(),
    { autoRenew: false },
  );

  invalidatePlatformDashboardCache();

  await logPlatformAudit({
    actorId: operator?._id || null,
    actorEmail: operator?.email || 'platform@bharatenterprise.com',
    actorRole: operator?.role || 'PLATFORM_ADMIN',
    action: 'SUBSCRIPTION.PAYMENT_RECONCILED',
    targetType: 'SubscriptionPayment',
    targetId: claimedPayment._id.toString(),
    targetTenantId: claimedPayment.tenantId,
    reason,
    before: { paymentStatus: existingPayment.paymentStatus },
    after: {
      paymentStatus: claimedPayment.paymentStatus,
      subscriptionId: activation.subscription._id,
      paidAt: claimedPayment.paidAt,
    },
    severity: 'WARNING',
  });

  return {
    success: true,
    statusCode: 200,
    message: 'Payment reconciled and subscription activated successfully',
    data: {
      payment: claimedPayment,
      subscription: activation.subscription,
    },
  };
}

