/**
 * Subscription Service — lifecycle management.
 *
 * Handles creation, renewal, status transitions, and
 * the daily cron job for expiry processing.
 */

import Subscription from '../models/Subscription';
import SubscriptionPayment from '../models/SubscriptionPayment';
import SubscriptionAdjustment from '../models/SubscriptionAdjustment';
import Plan from '../models/Plan';
import { SubscriptionStatus, PaymentStatus, AdjustmentType } from '../shared/features';
import type { IPricingSnapshot } from '../types';
import { getDefaultGraceDays, getDefaultTrialDays, getDefaultTrialPlan } from './settingsService';
import { calculatePrice } from './pricingService';
import { invalidateSubscriptionCache } from './featureService';
import { scheduleExpiryNotifications } from './notificationService';

type ActivateSubscriptionOptions = {
  autoRenew?: boolean;
  gatewaySubscriptionId?: string;
  gatewayPlanId?: string;
  gatewayCustomerId?: string | null;
  nextChargeAt?: Date | null;
  autoRenewStatus?: string;
};

// ─── Create Trial Subscription ───────────────────────────────────

/**
 * Create a trial subscription for a new tenant.
 * Called during registration.
 */
export async function createTrialSubscription(
  tenantId: string,
): Promise<typeof Subscription.prototype> {
  const trialDays = await getDefaultTrialDays();
  const graceDays = await getDefaultGraceDays();
  const trialPlanCode = await getDefaultTrialPlan();

  const plan = await Plan.findOne({ code: trialPlanCode, active: true }).lean();
  if (!plan) {
    throw new Error(`Trial plan "${trialPlanCode}" not found. Run the seeder first.`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  const graceUntil = new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

  const snapshot: IPricingSnapshot = {
    planName: plan.name,
    planCode: plan.code,
    baseMonthlyPrice: plan.baseMonthlyPrice,
    durationMonths: 0,
    discountApplied: 0,
    finalAmount: 0,
    features: plan.features,
  };

  const subscription = await Subscription.create({
    tenantId,
    planId: plan._id,
    status: SubscriptionStatus.TRIAL,
    startedAt: now,
    expiresAt,
    graceUntil,
    gracePeriodDays: graceDays,
    currentPricingSnapshot: snapshot,
  });

  // Schedule expiry notifications
  await scheduleExpiryNotifications(
    tenantId,
    subscription._id.toString(),
    expiresAt,
  );

  invalidateSubscriptionCache(tenantId);
  return subscription;
}

// ─── Create Paid Subscription ────────────────────────────────────

/**
 * Activate a subscription after successful payment.
 * Called by the payment verification flow.
 */
export async function activateSubscription(
  tenantId: string,
  planId: string,
  durationMonths: number,
  paymentId: string,
  options: ActivateSubscriptionOptions = {},
): Promise<{
  subscription: typeof Subscription.prototype;
  proratedDaysAdded: number;
  isUpgrade: boolean;
}> {
  const graceDays = await getDefaultGraceDays();

  const plan = await Plan.findById(planId).lean();
  if (!plan) throw new Error('Plan not found');

  const pricing = await calculatePrice(planId, durationMonths);

  const now = new Date();

  // Check if there's an active/trial subscription to extend from
  const existing = await Subscription.findOne({
    tenantId,
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.GRACE] },
  }).sort({ expiresAt: -1 }).lean();

  let additionalDays = durationMonths * 30;

  if (existing && new Date(existing.expiresAt) > now) {
    const remainingMs = new Date(existing.expiresAt).getTime() - now.getTime();
    const remainingDays = remainingMs / (1000 * 60 * 60 * 24);

    if (existing.planId.toString() === planId.toString()) {
      // Same plan renewal — just carry over all remaining days
      additionalDays += remainingDays;
    } else {
      // Plan change — prorate remaining days based on the price ratio
      const oldPrice = existing.currentPricingSnapshot.baseMonthlyPrice || 0;
      const newPrice = plan.baseMonthlyPrice || 1; // Prevent div zero

      const ratio = oldPrice / newPrice;
      const proratedDays = remainingDays * ratio;

      additionalDays += proratedDays;
    }
  }

  const expiresAt = new Date(now.getTime() + additionalDays * 24 * 60 * 60 * 1000);
  const graceUntil = new Date(
    expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000,
  );

  const snapshot: IPricingSnapshot = {
    planName: plan.name,
    planCode: plan.code,
    baseMonthlyPrice: plan.baseMonthlyPrice,
    durationMonths,
    discountApplied: pricing.discountAmount,
    finalAmount: pricing.finalPrice,
    features: plan.features,
  };

  // If extending an existing subscription, update it
  if (existing) {
    const recurringFields = buildRecurringFields(options, durationMonths);
    const updated = await Subscription.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          planId: plan._id,
          status: SubscriptionStatus.ACTIVE,
          autoRenew: options.autoRenew === true,
          billingMode: options.autoRenew === true ? 'auto' : 'manual',
          expiresAt,
          graceUntil,
          gracePeriodDays: graceDays,
          currentPricingSnapshot: snapshot,
          ...recurringFields.$set,
        },
        ...(Object.keys(recurringFields.$unset).length > 0
          ? { $unset: recurringFields.$unset }
          : {}),
      },
      { new: true },
    );

    // Link payment to subscription
    await SubscriptionPayment.findByIdAndUpdate(paymentId, {
      $set: { subscriptionId: existing._id },
    });

    // Schedule new expiry notifications
    await scheduleExpiryNotifications(
      tenantId,
      existing._id.toString(),
      expiresAt,
    );

    invalidateSubscriptionCache(tenantId);
    return { subscription: updated!, proratedDaysAdded: additionalDays - (durationMonths * 30), isUpgrade: existing.planId.toString() !== planId.toString() };
  }

  // Create new subscription
  const subscription = await Subscription.create({
    tenantId,
    planId: plan._id,
    status: SubscriptionStatus.ACTIVE,
    startedAt: now,
    expiresAt,
    graceUntil,
    autoRenew: options.autoRenew === true,
    billingMode: options.autoRenew === true ? 'auto' : 'manual',
    ...buildRecurringFields(options, durationMonths).$set,
    gracePeriodDays: graceDays,
    currentPricingSnapshot: snapshot,
  });

  // Link payment
  await SubscriptionPayment.findByIdAndUpdate(paymentId, {
    $set: { subscriptionId: subscription._id },
  });

  await scheduleExpiryNotifications(
    tenantId,
    subscription._id.toString(),
    expiresAt,
  );

  invalidateSubscriptionCache(tenantId);
  return { subscription, proratedDaysAdded: 0, isUpgrade: false };
}

function buildRecurringFields(
  options: ActivateSubscriptionOptions,
  durationMonths: number,
): {
  $set: Record<string, unknown>;
  $unset: Record<string, ''>;
} {
  if (options.autoRenew === true) {
    return {
      $set: {
        gatewaySubscriptionId: options.gatewaySubscriptionId,
        gatewayPlanId: options.gatewayPlanId,
        gatewayCustomerId: options.gatewayCustomerId || undefined,
        renewalIntervalMonths: durationMonths,
        nextChargeAt: options.nextChargeAt || undefined,
        autoRenewStatus: options.autoRenewStatus || 'active',
      },
      $unset: {},
    };
  }

  return {
    $set: {},
    $unset: {
      gatewaySubscriptionId: '',
      gatewayPlanId: '',
      gatewayCustomerId: '',
      renewalIntervalMonths: '',
      nextChargeAt: '',
      autoRenewStatus: '',
    },
  };
}

export async function applyAutoRenewalCycle(
  gatewaySubscriptionId: string,
  paymentData: Record<string, any>,
  eventId?: string,
  razorpaySubscription?: Record<string, any>,
): Promise<{
  subscription: typeof Subscription.prototype | null;
  payment: typeof SubscriptionPayment.prototype | null;
  duplicate: boolean;
}> {
  const subscription = await Subscription.findOne({
    gatewaySubscriptionId,
  }).sort({ createdAt: -1 });

  if (!subscription) {
    return { subscription: null, payment: null, duplicate: false };
  }

  if (paymentData?.id) {
    const existingPayment = await SubscriptionPayment.findOne({
      gatewayPaymentId: paymentData.id,
    });
    if (existingPayment) {
      return { subscription, payment: existingPayment, duplicate: true };
    }
  }

  const durationMonths =
    subscription.renewalIntervalMonths ||
    subscription.currentPricingSnapshot?.durationMonths ||
    1;

  const baseAmount =
    (subscription.currentPricingSnapshot?.baseMonthlyPrice || 0) *
    durationMonths;
  const finalAmount =
    typeof paymentData?.amount === 'number'
      ? paymentData.amount / 100
      : subscription.currentPricingSnapshot?.finalAmount || baseAmount;
  const discountAmount = Math.max(0, baseAmount - finalAmount);

  const payment = await SubscriptionPayment.create({
    tenantId: subscription.tenantId,
    subscriptionId: subscription._id,
    planId: subscription.planId,
    durationMonths,
    baseAmount,
    discountAmount,
    finalAmount,
    paymentGateway: 'razorpay',
    gatewaySubscriptionId,
    gatewayInvoiceId: paymentData?.invoice_id,
    gatewayPaymentId: paymentData?.id,
    paymentStatus: PaymentStatus.COMPLETED,
    billingMode: 'auto',
    gatewayEventId: eventId,
    paidAt: paymentData?.created_at
      ? new Date(paymentData.created_at * 1000)
      : new Date(),
    metadata: {
      eventId,
      razorpayStatus: paymentData?.status,
      method: paymentData?.method,
      invoiceId: paymentData?.invoice_id,
    },
  });

  const graceDays = await getDefaultGraceDays();
  const now = new Date();
  const baseDate =
    subscription.expiresAt && subscription.expiresAt > now
      ? subscription.expiresAt
      : now;
  const expiresAt = new Date(
    baseDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000,
  );
  const graceUntil = new Date(
    expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000,
  );

  subscription.status = SubscriptionStatus.ACTIVE;
  subscription.autoRenew = true;
  subscription.billingMode = 'auto';
  subscription.expiresAt = expiresAt;
  subscription.graceUntil = graceUntil;
  subscription.gracePeriodDays = graceDays;
  subscription.nextChargeAt = razorpaySubscription?.charge_at
    ? new Date(razorpaySubscription.charge_at * 1000)
    : undefined;
  subscription.autoRenewStatus =
    razorpaySubscription?.status || subscription.autoRenewStatus || 'active';
  if (razorpaySubscription?.customer_id) {
    subscription.gatewayCustomerId = razorpaySubscription.customer_id;
  }

  await subscription.save();
  await scheduleExpiryNotifications(
    subscription.tenantId.toString(),
    subscription._id.toString(),
    expiresAt,
  );
  invalidateSubscriptionCache(subscription.tenantId.toString());

  return { subscription, payment, duplicate: false };
}

export async function updateAutoRenewStatus(
  gatewaySubscriptionId: string,
  razorpaySubscription: Record<string, any>,
): Promise<void> {
  const status = razorpaySubscription?.status;
  const shouldDisable = [
    'cancelled',
    'completed',
    'expired',
    'halted',
  ].includes(status);

  const set: Record<string, unknown> = {
    autoRenewStatus: status,
    gatewayCustomerId: razorpaySubscription?.customer_id || undefined,
    nextChargeAt: razorpaySubscription?.charge_at
      ? new Date(razorpaySubscription.charge_at * 1000)
      : undefined,
  };

  if (shouldDisable) {
    set.autoRenew = false;
    set.billingMode = 'manual';
  }

  await Subscription.findOneAndUpdate(
    { gatewaySubscriptionId },
    { $set: set },
  );
}

// ─── Apply Adjustment ────────────────────────────────────────────

/**
 * Add/remove days from a subscription (referral reward, bonus, etc.)
 */
export async function applyAdjustment(
  tenantId: string,
  daysToAdd: number,
  type: AdjustmentType,
  reason: string,
  createdBy: string,
): Promise<void> {
  // Include EXPIRED so referral rewards can revive an expired subscription.
  // The reactivation logic below handles status transition back to ACTIVE.
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
  }).sort({ createdAt: -1 });

  if (!subscription) {
    throw new Error('No active subscription found for this tenant');
  }

  // Extend expiry
  const msToAdd = daysToAdd * 24 * 60 * 60 * 1000;
  const newExpiresAt = new Date(subscription.expiresAt.getTime() + msToAdd);
  const newGraceUntil = new Date(
    newExpiresAt.getTime() +
    subscription.gracePeriodDays * 24 * 60 * 60 * 1000,
  );

  subscription.expiresAt = newExpiresAt;
  subscription.graceUntil = newGraceUntil;

  // If subscription was in grace/expired but days were added, reactivate
  if (
    newExpiresAt > new Date() &&
    (subscription.status === SubscriptionStatus.GRACE ||
      subscription.status === SubscriptionStatus.EXPIRED)
  ) {
    subscription.status = SubscriptionStatus.ACTIVE;
  }

  await subscription.save();

  // Record the adjustment
  await SubscriptionAdjustment.create({
    tenantId,
    subscriptionId: subscription._id,
    type,
    daysAdded: daysToAdd,
    reason,
    createdBy,
  });

  invalidateSubscriptionCache(tenantId);
}

// ─── Get Subscription for Tenant ─────────────────────────────────

export async function getActiveSubscription(tenantId: string) {
  return Subscription.findOne({
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
    .populate('planId')
    .lean();
}

export async function getPaymentHistory(tenantId: string) {
  return SubscriptionPayment.find({ tenantId })
    .sort({ createdAt: -1 })
    .populate('planId', 'name code')
    .lean();
}

export async function getAdjustmentHistory(tenantId: string) {
  return SubscriptionAdjustment.find({ tenantId })
    .sort({ createdAt: -1 })
    .lean();
}

// ─── Daily Cron: Process Expired Subscriptions ───────────────────

/**
 * Run once daily to transition subscription statuses.
 * Simple cron — no overengineered scheduler.
 */
export async function processExpiredSubscriptions(): Promise<{
  expired: number;
  suspended: number;
}> {
  const now = new Date();

  // Active/Trial → check if expired
  const expiredResult = await Subscription.updateMany(
    {
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      expiresAt: { $lt: now },
      graceUntil: { $gte: now },
    },
    { $set: { status: SubscriptionStatus.GRACE } },
  );

  // Grace → Expired (past grace period)
  const suspendedResult = await Subscription.updateMany(
    {
      status: SubscriptionStatus.GRACE,
      graceUntil: { $lt: now },
    },
    { $set: { status: SubscriptionStatus.EXPIRED } },
  );

  // Clear caches for affected tenants
  invalidateSubscriptionCache();

  return {
    expired: expiredResult.modifiedCount,
    suspended: suspendedResult.modifiedCount,
  };
}
