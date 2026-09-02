/**
 * Feature Service — determines what a tenant can access.
 *
 * Reads the tenant's active subscription and checks plan features.
 * Used by middleware and also directly by controllers when needed.
 */

import Subscription from '../models/Subscription';
import Plan from '../models/Plan';
import {
  Feature,
  SubscriptionStatus,
  PlanCode,
  DEFAULT_PLAN_FEATURES,
} from '../shared/features';
import type { SubscriptionInfo } from '../types';

// ─── In-Memory Cache ─────────────────────────────────────────────
interface SubCacheEntry {
  info: SubscriptionInfo;
  expiresAt: number;
}

const subCache = new Map<string, SubCacheEntry>();
const SUB_CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getCached(tenantId: string): SubscriptionInfo | undefined {
  const entry = subCache.get(tenantId);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.info;
  }
  subCache.delete(tenantId);
  return undefined;
}

function setCache(tenantId: string, info: SubscriptionInfo): void {
  subCache.set(tenantId, { info, expiresAt: Date.now() + SUB_CACHE_TTL_MS });
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get the full subscription info for a tenant.
 * This is what gets attached to req.subscription by middleware.
 */
export async function getSubscriptionInfo(
  tenantId: string,
): Promise<SubscriptionInfo> {
  // Check cache
  const cached = getCached(tenantId);
  if (cached) return cached;

  // Find the most recent active/trial/grace subscription
  const now = new Date();

  const subscription = await Subscription.findOne({
    tenantId,
    status: {
      $in: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.GRACE,
        SubscriptionStatus.EXPIRED,
      ],
    },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!subscription) {
    // No subscription at all — treat as expired with no features
    const info = buildNoSubscriptionInfo();
    setCache(tenantId, info);
    return info;
  }

  // Recalculate actual status based on dates
  const actualStatus = resolveStatus(subscription, now);

  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (new Date(subscription.expiresAt).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  const isGrace =
    actualStatus === SubscriptionStatus.GRACE;

  const canWrite =
    actualStatus === SubscriptionStatus.ACTIVE ||
    actualStatus === SubscriptionStatus.TRIAL ||
    actualStatus === SubscriptionStatus.GRACE;

  // Resolve plan document to ensure features include any newly added capabilities for this tier
  let resolvedFeatures = (subscription.currentPricingSnapshot?.features || []) as Feature[];
  let planName = subscription.currentPricingSnapshot?.planName || 'Starter';
  let planCode = (subscription.currentPricingSnapshot?.planCode || PlanCode.STARTER) as PlanCode;

  if (subscription.planId) {
    const planDoc = await Plan.findById(subscription.planId).lean();
    if (planDoc) {
      resolvedFeatures = (planDoc.features || resolvedFeatures) as Feature[];
      planName = planDoc.name || planName;
      planCode = (planDoc.code || planCode) as PlanCode;
    }
  }

  const info: SubscriptionInfo = {
    status: actualStatus,
    plan: {
      code: planCode,
      name: planName,
      features: resolvedFeatures,
    },
    canWrite,
    expiresAt: new Date(subscription.expiresAt),
    daysRemaining,
    isGrace,
    subscriptionId: subscription._id,
  };

  setCache(tenantId, info);
  return info;
}

/**
 * Check if a tenant has access to a specific feature.
 */
export async function canAccess(
  tenantId: string,
  feature: Feature,
): Promise<boolean> {
  const info = await getSubscriptionInfo(tenantId);
  return info.plan.features.includes(feature);
}

/**
 * Check if a tenant can perform write operations.
 */
export async function canWrite(tenantId: string): Promise<boolean> {
  const info = await getSubscriptionInfo(tenantId);
  return info.canWrite;
}

/**
 * Get all accessible features for a tenant.
 */
export async function getAccessibleFeatures(
  tenantId: string,
): Promise<Feature[]> {
  const info = await getSubscriptionInfo(tenantId);
  return info.plan.features;
}

/**
 * Invalidate the subscription cache for a tenant.
 * Call this after subscription changes (payment, upgrade, adjustment).
 */
export function invalidateSubscriptionCache(tenantId?: string): void {
  if (tenantId) {
    subCache.delete(tenantId);
  } else {
    subCache.clear();
  }
}

// ─── Internal Helpers ────────────────────────────────────────────

function resolveStatus(
  sub: Record<string, unknown>,
  now: Date,
): SubscriptionStatus {
  const expiresAt = new Date(sub.expiresAt as string | Date);
  const graceUntil = new Date(sub.graceUntil as string | Date);
  const currentStatus = sub.status as SubscriptionStatus;

  // If explicitly suspended, keep it
  if (currentStatus === SubscriptionStatus.SUSPENDED) {
    return SubscriptionStatus.SUSPENDED;
  }

  // Trial or Active and not expired yet
  if (now <= expiresAt) {
    if (
      currentStatus === SubscriptionStatus.TRIAL ||
      currentStatus === SubscriptionStatus.ACTIVE
    ) {
      return currentStatus;
    }
    // Subscription was re-activated (edge case)
    return SubscriptionStatus.ACTIVE;
  }

  // Past expiry but within grace
  if (now <= graceUntil) {
    return SubscriptionStatus.GRACE;
  }

  // Past grace period
  return SubscriptionStatus.EXPIRED;
}

function buildNoSubscriptionInfo(): SubscriptionInfo {
  return {
    status: SubscriptionStatus.EXPIRED,
    plan: {
      code: PlanCode.STARTER,
      name: 'No Plan',
      features: [],
    },
    canWrite: false,
    expiresAt: new Date(0),
    daysRemaining: 0,
    isGrace: false,
  };
}
