/**
 * SaaS Plan Seeder
 *
 * Seeds the database with:
 * - 3 Plans (Starter, Business, Professional)
 * - PricingRules for all durations (1, 3, 6, 12 months)
 * - Default SystemSettings
 * - Default ReferralCampaign
 *
 * Usage: npx tsx scripts/seedSaasPlans.ts
 *
 * Safe to run multiple times — uses upsert logic.
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models (these register themselves with Mongoose)
import Plan from '../saas/models/Plan';
import PricingRule from '../saas/models/PricingRule';
import ReferralCampaign from '../saas/models/ReferralCampaign';
import SystemSetting from '../saas/models/SystemSetting';
import {
  PlanCode,
  Feature,
  DiscountType,
  RewardType,
  DEFAULT_PLAN_FEATURES,
  SettingKeys,
  SUPPORTED_DURATIONS,
} from '../saas/shared/features';

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    // ─── 1. Seed Plans ─────────────────────────────────────────
    console.log('\n📦 Seeding Plans...');

    const plans = [
      {
        name: 'Starter',
        code: PlanCode.STARTER,
        description: 'Perfect for small businesses needing only billing and invoicing.',
        baseMonthlyPrice: 299,
        features: DEFAULT_PLAN_FEATURES[PlanCode.STARTER],
        displayOrder: 1,
      },
      {
        name: 'Business',
        code: PlanCode.BUSINESS,
        description: 'For growing businesses needing payments, collections, and ledger tracking.',
        baseMonthlyPrice: 499,
        features: DEFAULT_PLAN_FEATURES[PlanCode.BUSINESS],
        displayOrder: 2,
      },
      {
        name: 'Professional',
        code: PlanCode.PROFESSIONAL,
        description: 'Full suite with employees, analytics, activity logs, and GST reports.',
        baseMonthlyPrice: 699,
        features: DEFAULT_PLAN_FEATURES[PlanCode.PROFESSIONAL],
        displayOrder: 3,
      },
    ];

    const createdPlans: Record<string, any> = {};

    for (const planData of plans) {
      const plan = await Plan.findOneAndUpdate(
        { code: planData.code },
        { $set: planData },
        { upsert: true, new: true },
      );
      createdPlans[planData.code] = plan;
      console.log(`  ✅ ${planData.name} (₹${planData.baseMonthlyPrice}/mo)`);
    }

    // ─── 2. Seed Pricing Rules ─────────────────────────────────
    console.log('\n💰 Seeding Pricing Rules...');

    // Discount schedule (same for all plans):
    // 1 month  → 0% discount
    // 3 months → 5% discount
    // 6 months → 10% discount
    // 12 months → 20% discount
    const discountSchedule: { durationMonths: number; discountValue: number }[] = [
      { durationMonths: 1, discountValue: 0 },
      { durationMonths: 3, discountValue: 5 },
      { durationMonths: 6, discountValue: 10 },
      { durationMonths: 12, discountValue: 20 },
    ];

    for (const planCode of Object.values(PlanCode)) {
      const plan = createdPlans[planCode];

      for (const schedule of discountSchedule) {
        await PricingRule.findOneAndUpdate(
          { planId: plan._id, durationMonths: schedule.durationMonths },
          {
            $set: {
              discountType: DiscountType.PERCENTAGE,
              discountValue: schedule.discountValue,
              active: true,
            },
          },
          { upsert: true },
        );
      }

      // Calculate and display pricing
      const monthly = plan.baseMonthlyPrice;
      console.log(`  ${plan.name}:`);
      for (const s of discountSchedule) {
        const total = monthly * s.durationMonths;
        const discount = Math.round((total * s.discountValue) / 100);
        const final_ = total - discount;
        const perMonth = Math.round(final_ / s.durationMonths);
        console.log(
          `    ${s.durationMonths}mo → ₹${final_} (₹${perMonth}/mo, ${s.discountValue}% off)`,
        );
      }
    }

    // ─── 3. Seed System Settings ───────────────────────────────
    console.log('\n⚙️  Seeding System Settings...');

    const settings = [
      {
        key: SettingKeys.DEFAULT_TRIAL_DAYS,
        value: 30,
        description: 'Number of free trial days for new signups',
      },
      {
        key: SettingKeys.DEFAULT_GRACE_DAYS,
        value: 7,
        description: 'Global grace period after subscription expiry',
      },
      {
        key: SettingKeys.REFERRAL_MAX_FREE_DAYS,
        value: 365,
        description: 'Maximum free days a tenant can accumulate via referrals',
      },
      {
        key: SettingKeys.DEFAULT_TRIAL_PLAN,
        value: PlanCode.PROFESSIONAL,
        description: 'Plan assigned to new tenants during trial',
      },
    ];

    for (const setting of settings) {
      await SystemSetting.findOneAndUpdate(
        { key: setting.key },
        { $set: setting },
        { upsert: true },
      );
      console.log(`  ✅ ${setting.key} = ${setting.value}`);
    }

    // ─── 4. Seed Default Referral Campaign ─────────────────────
    console.log('\n🎯 Seeding Default Referral Campaign...');

    const campaignData = {
      name: 'Launch Referral Program',
      active: true,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      referrerReward: {
        rewardType: RewardType.FREE_DAYS,
        rewardValue: 30, // 30 free days for referrer
      },
      referredReward: {
        rewardType: RewardType.FREE_DAYS,
        rewardValue: 15, // 15 free days for referred user
      },
      maxReferralsPerTenant: 0, // unlimited
    };

    await ReferralCampaign.findOneAndUpdate(
      { name: campaignData.name },
      { $set: campaignData },
      { upsert: true },
    );
    console.log(
      `  ✅ "${campaignData.name}" — Referrer gets ${campaignData.referrerReward.rewardValue} days, Referred gets ${campaignData.referredReward.rewardValue} days`,
    );

    // ─── Done ──────────────────────────────────────────────────
    console.log('\n🎉 SaaS seeding complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
