require('dotenv').config();
const mongoose = require('mongoose');
import Subscription from '../saas/models/Subscription';
import Plan from '../saas/models/Plan';
import { PlanCode, SubscriptionStatus } from '../saas/shared/features';
const Admin = require('../models/Admin');

async function assignTierToAccount(email: string, planCode: PlanCode) {
  const admin = await Admin.findOne({ email }).lean();
  if (!admin) {
    console.log(`⚠️ Admin ${email} not found`);
    return;
  }

  const plan = await Plan.findOne({ code: planCode }).lean();
  if (!plan) {
    console.error(`Plan ${planCode} not found`);
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const graceUntil = new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const snapshot = {
    planName: plan.name,
    planCode: plan.code,
    baseMonthlyPrice: plan.baseMonthlyPrice,
    durationMonths: 1,
    discountApplied: 0,
    finalAmount: plan.baseMonthlyPrice,
    features: plan.features,
  };

  await Subscription.findOneAndUpdate(
    { tenantId: admin._id },
    {
      $set: {
        planId: plan._id,
        status: SubscriptionStatus.ACTIVE,
        startedAt: now,
        expiresAt,
        graceUntil,
        gracePeriodDays: 7,
        currentPricingSnapshot: snapshot,
      },
    },
    { upsert: true, new: true }
  );

  console.log(`✅ [${email}] assigned to ${plan.name} (${plan.code.toUpperCase()}) — ${plan.features.length} features enabled.`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected\n');

  // Assign distinct tiers to pre-existing accounts
  await assignTierToAccount('test@test.com', PlanCode.PROFESSIONAL);
  await assignTierToAccount('test1@test.com', PlanCode.STARTER);
  await assignTierToAccount('test2@test.com', PlanCode.BUSINESS);

  console.log('\n🎉 Test accounts setup complete:');
  console.log('  • test1@test.com ➔ STARTER (₹299/mo)');
  console.log('  • test2@test.com ➔ BUSINESS (₹499/mo)');
  console.log('  • test@test.com  ➔ PROFESSIONAL (₹699/mo)');

  process.exit(0);
}

run();
