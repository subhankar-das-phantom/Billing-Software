/**
 * Pricing Service — calculates subscription prices.
 *
 * All pricing is DB-driven via Plan.baseMonthlyPrice + PricingRule discounts.
 * Never hardcodes ₹299, ₹499, ₹699, or any discount percentages.
 */

import Plan from '../models/Plan';
import PricingRule from '../models/PricingRule';
import { SUPPORTED_DURATIONS, DiscountType } from '../shared/features';
import type { PriceCalculation, PlanWithPricing } from '../types';

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

  const basePrice = plan.baseMonthlyPrice * durationMonths;

  // Look up pricing rule for this plan + duration
  const rule = await PricingRule.findOne({
    planId,
    durationMonths,
    active: true,
  }).lean();

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
 * Get all active plans with pricing for all supported durations.
 * Used by the frontend pricing page.
 */
export async function getAvailablePlans(): Promise<PlanWithPricing[]> {
  const plans = await Plan.find({ active: true })
    .sort({ displayOrder: 1 })
    .lean();

  const result: PlanWithPricing[] = [];

  for (const plan of plans) {
    const pricing: PriceCalculation[] = [];

    for (const duration of SUPPORTED_DURATIONS) {
      const calc = await calculatePrice(
        plan._id.toString(),
        duration,
      );
      pricing.push(calc);
    }

    result.push({
      ...plan,
      pricing,
    } as PlanWithPricing);
  }

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
