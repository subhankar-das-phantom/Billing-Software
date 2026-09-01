/**
 * Pricing Service — calculates subscription prices.
 *
 * All pricing is DB-driven via Plan.baseMonthlyPrice + PricingRule discounts.
 * High-performance implementation with batch lookups and in-memory TTL caching.
 */

import Plan from '../models/Plan';
import PricingRule from '../models/PricingRule';
import { SUPPORTED_DURATIONS, DiscountType } from '../shared/features';
import type { PriceCalculation, PlanWithPricing } from '../types';

// ─── In-Memory Cache ─────────────────────────────────────────────
let cachedPlansWithPricing: PlanWithPricing[] | null = null;
let cacheExpiresAt = 0;
const PLANS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidatePricingCache(): void {
  cachedPlansWithPricing = null;
  cacheExpiresAt = 0;
}

/**
 * Pure calculation helper (O(1) memory computation).
 */
function computePrice(
  baseMonthlyPrice: number,
  durationMonths: number,
  rule?: { discountType: string; discountValue: number } | null
): PriceCalculation {
  const basePrice = baseMonthlyPrice * durationMonths;
  let discountAmount = 0;

  if (rule) {
    if (rule.discountType === DiscountType.PERCENTAGE) {
      discountAmount = Math.round((basePrice * rule.discountValue) / 100);
    } else if (rule.discountType === DiscountType.FLAT) {
      discountAmount = Math.min(rule.discountValue, basePrice);
    }
  }

  const finalPrice = Math.max(0, basePrice - discountAmount);
  const effectiveMonthlyPrice =
    durationMonths > 0 ? Math.round(finalPrice / durationMonths) : finalPrice;
  const savingsPercent =
    basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0;

  return {
    basePrice,
    durationMonths,
    discountAmount,
    finalPrice,
    savingsPercent,
    effectiveMonthlyPrice,
  };
}

/**
 * Calculate the price for a specific plan + duration.
 */
export async function calculatePrice(
  planId: string,
  durationMonths: number,
): Promise<PriceCalculation> {
  const plan = await Plan.findById(planId).lean();
  if (!plan) {
    throw new Error('Plan not found');
  }

  const rule = await PricingRule.findOne({
    planId,
    durationMonths,
    active: true,
  }).lean();

  return computePrice(plan.baseMonthlyPrice, durationMonths, rule);
}

/**
 * Get all active plans with pricing for all supported durations.
 * Uses 2 batch queries and in-memory caching for sub-millisecond responses.
 */
export async function getAvailablePlans(): Promise<PlanWithPricing[]> {
  const now = Date.now();
  if (cachedPlansWithPricing && now < cacheExpiresAt) {
    return cachedPlansWithPricing;
  }

  // 1. Fetch all active plans (1 batch query)
  const plans = await Plan.find({ active: true })
    .sort({ displayOrder: 1 })
    .lean();

  if (plans.length === 0) {
    return [];
  }

  const planIds = plans.map(p => p._id);

  // 2. Fetch all active pricing rules for all active plans in one batch query
  const rules = await PricingRule.find({
    planId: { $in: planIds },
    active: true,
  }).lean();

  // Index rules by `planId:duration` for O(1) lookups
  const ruleMap = new Map<string, typeof rules[0]>();
  for (const r of rules) {
    ruleMap.set(`${r.planId.toString()}:${r.durationMonths}`, r);
  }

  // 3. Compute pricing matrix in memory
  const result: PlanWithPricing[] = plans.map(plan => {
    const pricing: PriceCalculation[] = SUPPORTED_DURATIONS.map(duration => {
      const rule = ruleMap.get(`${plan._id.toString()}:${duration}`);
      return computePrice(plan.baseMonthlyPrice, duration, rule);
    });

    return {
      ...plan,
      pricing,
    } as PlanWithPricing;
  });

  // Store in cache
  cachedPlansWithPricing = result;
  cacheExpiresAt = now + PLANS_CACHE_TTL_MS;

  return result;
}

/**
 * Calculate price for a plan by plan code (convenience).
 */
export async function calculatePriceByCode(
  planCode: string,
  durationMonths: number,
): Promise<PriceCalculation> {
  const plan = await Plan.findOne({ code: planCode, active: true }).lean();
  if (!plan) {
    throw new Error(`Active plan with code "${planCode}" not found`);
  }
  return calculatePrice(plan._id.toString(), durationMonths);
}
