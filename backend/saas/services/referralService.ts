/**
 * Referral Service — handles the full referral lifecycle.
 *
 * Flow:
 * 1. Tenant A gets/generates referral code
 * 2. Tenant B signs up with referral code → applyReferralCode()
 * 3. Tenant B makes first PAID subscription → processReferralReward()
 * 4. Both parties receive rewards from ReferralCampaign config
 *
 * NO reward on signup or trial. Only on first paid subscription.
 */

import Referral from '../models/Referral';
import ReferralCampaign from '../models/ReferralCampaign';
import {
  ReferralStatus,
  RewardType,
  AdjustmentType,
} from '../shared/features';
import { applyAdjustment } from './subscriptionService';
import { getReferralMaxFreeDays } from './settingsService';

// ─── Generate Referral Code ──────────────────────────────────────

/**
 * Get or create a referral code for a tenant.
 * Each tenant gets one code linked to the active campaign.
 */
export async function getOrCreateReferralCode(
  tenantId: string,
): Promise<{ referralCode: string; campaign: string } | null> {
  // Find active campaign
  const campaign = await getActiveCampaign();
  if (!campaign) return null;

  // Check for existing code for this tenant + campaign
  let referral = await Referral.findOne({
    referrerTenantId: tenantId,
    campaignId: campaign._id,
    referredTenantId: null, // Unused code
  }).lean();

  if (referral) {
    return {
      referralCode: referral.referralCode,
      campaign: campaign.name,
    };
  }

  // Generate unique code
  const code = await generateUniqueCode(tenantId);

  referral = await Referral.create({
    referralCode: code,
    campaignId: campaign._id,
    referrerTenantId: tenantId,
    status: ReferralStatus.PENDING,
  });

  return {
    referralCode: code,
    campaign: campaign.name,
  };
}

/**
 * Apply a referral code during signup.
 * Links the referred tenant to the referral record.
 * NO reward is granted at this stage.
 */
export async function applyReferralCode(
  referredTenantId: string,
  referralCode: string,
): Promise<{ success: boolean; message: string }> {
  const referral = await Referral.findOne({
    referralCode: referralCode.toUpperCase(),
    referredTenantId: null,
    status: ReferralStatus.PENDING,
  });

  if (!referral) {
    return { success: false, message: 'Invalid or already used referral code' };
  }

  // Prevent self-referral
  if (referral.referrerTenantId.toString() === referredTenantId) {
    return { success: false, message: 'Cannot use your own referral code' };
  }

  // Check campaign is still active
  const campaign = await ReferralCampaign.findById(referral.campaignId).lean();
  if (!campaign || !campaign.active) {
    return { success: false, message: 'Referral campaign is no longer active' };
  }

  const now = new Date();
  if (now < new Date(campaign.validFrom) || now > new Date(campaign.validUntil)) {
    return { success: false, message: 'Referral campaign has expired' };
  }

  // Check max referrals per tenant
  if (campaign.maxReferralsPerTenant && campaign.maxReferralsPerTenant > 0) {
    const referralCount = await Referral.countDocuments({
      referrerTenantId: referral.referrerTenantId,
      campaignId: campaign._id,
      status: { $in: [ReferralStatus.QUALIFIED, ReferralStatus.REWARDED] },
    });

    if (referralCount >= campaign.maxReferralsPerTenant) {
      return {
        success: false,
        message: 'Referrer has reached the maximum number of referrals',
      };
    }
  }

  // Link referred tenant
  referral.referredTenantId = referredTenantId as any;
  await referral.save();

  return { success: true, message: 'Referral code applied successfully' };
}

/**
 * Process referral reward after first PAID subscription.
 * Called by subscription payment verification flow.
 *
 * Grants rewards to both referrer and referred based on campaign config.
 */
export async function processReferralReward(
  referredTenantId: string,
): Promise<void> {
  // Find the referral for this tenant
  const referral = await Referral.findOne({
    referredTenantId,
    status: ReferralStatus.PENDING,
  });

  if (!referral) return; // No referral to process

  const campaign = await ReferralCampaign.findById(
    referral.campaignId,
  ).lean();
  if (!campaign || !campaign.active) return;

  const maxFreeDays = await getReferralMaxFreeDays();

  // Mark as qualified
  referral.status = ReferralStatus.QUALIFIED;
  referral.qualifiedAt = new Date();
  await referral.save();

  // Grant referrer reward
  try {
    await grantReward(
      referral.referrerTenantId.toString(),
      campaign.referrerReward,
      maxFreeDays,
      `Referral reward: ${referral.referralCode} (you referred a new user)`,
    );
    referral.referrerRewardGranted = true;
  } catch (err) {
    console.error('Failed to grant referrer reward:', err);
  }

  // Grant referred reward
  try {
    await grantReward(
      referredTenantId,
      campaign.referredReward,
      maxFreeDays,
      `Welcome reward: signed up with referral code ${referral.referralCode}`,
    );
    referral.referredRewardGranted = true;
  } catch (err) {
    console.error('Failed to grant referred reward:', err);
  }

  // Mark as rewarded if both succeeded
  if (referral.referrerRewardGranted && referral.referredRewardGranted) {
    referral.status = ReferralStatus.REWARDED;
  }
  await referral.save();
}

/**
 * Get referral stats for a tenant (referrer dashboard).
 */
export async function getReferralStats(tenantId: string) {
  const referrals = await Referral.find({ referrerTenantId: tenantId })
    .sort({ createdAt: -1 })
    .lean();

  const totalReferred = referrals.filter((r) => r.referredTenantId).length;
  const totalRewarded = referrals.filter(
    (r) => r.status === ReferralStatus.REWARDED,
  ).length;
  const pending = referrals.filter(
    (r) =>
      r.referredTenantId && r.status === ReferralStatus.PENDING,
  ).length;

  return {
    totalReferred,
    totalRewarded,
    pending,
    referrals: referrals.map((r) => ({
      referralCode: r.referralCode,
      status: r.status,
      referredTenantId: r.referredTenantId,
      referrerRewardGranted: r.referrerRewardGranted,
      qualifiedAt: r.qualifiedAt,
      createdAt: r.createdAt,
    })),
  };
}

// ─── Internal Helpers ────────────────────────────────────────────

async function getActiveCampaign() {
  const now = new Date();
  return ReferralCampaign.findOne({
    active: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
  })
    .sort({ createdAt: -1 })
    .lean();
}

async function generateUniqueCode(tenantId: string): Promise<string> {
  // Generate a short, readable code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  let code: string;
  let attempts = 0;

  do {
    code = 'BE-'; // Bharat Enterprise prefix
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;

    const exists = await Referral.findOne({ referralCode: code }).lean();
    if (!exists) return code;
  } while (attempts < 10);

  // Fallback: include timestamp
  return `BE-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function grantReward(
  tenantId: string,
  reward: { rewardType: string; rewardValue: number },
  maxFreeDays: number,
  reason: string,
): Promise<void> {
  if (reward.rewardType === RewardType.FREE_DAYS) {
    const days = Math.min(reward.rewardValue, maxFreeDays);
    await applyAdjustment(
      tenantId,
      days,
      AdjustmentType.REFERRAL_REWARD,
      reason,
      tenantId, // Self-attribution for referral rewards
    );
  }

  // PERCENT_DISCOUNT and FLAT_DISCOUNT are applied at checkout time,
  // not as subscription adjustments. They would be stored as a
  // "referral discount" on the tenant and applied in pricingService.
  // For Phase 1, only FREE_DAYS is auto-applied.
}
