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
import { applyAdjustment, createTrialSubscription } from './subscriptionService';
import { getReferralMaxFreeDays } from './settingsService';

// ─── Generate Referral Code ──────────────────────────────────────

/**
 * Get or create a referral code for a tenant.
 * Each tenant gets ONE persistent code linked to the active campaign.
 * The code does NOT change when someone uses it.
 */
export async function getOrCreateReferralCode(
  tenantId: string,
): Promise<{ referralCode: string; campaign: string } | null> {
  // Find active campaign
  const campaign = await getActiveCampaign();
  if (!campaign) return null;

  // Find the tenant's FIRST code for this campaign (regardless of usage)
  const existingReferral = await Referral.findOne({
    referrerTenantId: tenantId,
    campaignId: campaign._id,
    referredTenantId: null, // The "master" code document (no referred tenant)
  }).lean();

  if (existingReferral) {
    return {
      referralCode: existingReferral.referralCode,
      campaign: campaign.name,
    };
  }

  // Also check if the tenant has ANY code (even used ones) — return that same code
  const anyReferral = await Referral.findOne({
    referrerTenantId: tenantId,
    campaignId: campaign._id,
  })
    .sort({ createdAt: 1 })
    .lean();

  if (anyReferral) {
    // Re-create the master document so future lookups are fast
    await Referral.create({
      referralCode: anyReferral.referralCode,
      campaignId: campaign._id,
      referrerTenantId: tenantId,
      status: ReferralStatus.PENDING,
    });

    return {
      referralCode: anyReferral.referralCode,
      campaign: campaign.name,
    };
  }

  // No code exists at all — generate a new one
  const code = await generateUniqueCode(tenantId);

  await Referral.create({
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
 * Creates a NEW referral document linking referrer → referred.
 * The original "master" code document stays untouched.
 * NO reward is granted at this stage.
 */
export async function applyReferralCode(
  referredTenantId: string,
  referralCode: string,
): Promise<{ success: boolean; message: string }> {
  // Find any referral with this code to identify the referrer
  const codeOwner = await Referral.findOne({
    referralCode: referralCode.toUpperCase(),
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!codeOwner) {
    return { success: false, message: 'Invalid referral code' };
  }

  // Prevent self-referral
  if (codeOwner.referrerTenantId.toString() === referredTenantId) {
    return { success: false, message: 'Cannot use your own referral code' };
  }

  // Check if this referred tenant already used a referral code
  const alreadyReferred = await Referral.findOne({
    referredTenantId,
  }).lean();

  if (alreadyReferred) {
    return { success: false, message: 'You have already used a referral code' };
  }

  // Check campaign is still active
  const campaign = await ReferralCampaign.findById(codeOwner.campaignId).lean();
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
      referrerTenantId: codeOwner.referrerTenantId,
      campaignId: campaign._id,
      referredTenantId: { $ne: null },
    });

    if (referralCount >= campaign.maxReferralsPerTenant) {
      return {
        success: false,
        message: 'Referrer has reached the maximum number of referrals',
      };
    }
  }

  // Create a NEW referral document for this usage (don't touch the master)
  await Referral.create({
    referralCode: referralCode.toUpperCase(),
    campaignId: codeOwner.campaignId,
    referrerTenantId: codeOwner.referrerTenantId,
    referredTenantId,
    status: ReferralStatus.PENDING,
  });

  return { success: true, message: 'Referral code applied successfully' };
}

/**
 * Process referral reward after first PAID subscription.
 * Called by subscription payment verification flow.
 *
 * Grants rewards to both referrer and referred based on campaign config.
 *
 * Also retries previously failed reward grants: if a referral is already
 * QUALIFIED but one or both rewards were not granted (e.g. the referrer's
 * subscription had expired), this function will re-attempt those grants.
 */
export async function processReferralReward(
  referredTenantId: string,
): Promise<void> {
  // Find a PENDING referral, OR a QUALIFIED referral with ungranted rewards
  const referral = await Referral.findOne({
    referredTenantId,
    $or: [
      { status: ReferralStatus.PENDING },
      {
        status: ReferralStatus.QUALIFIED,
        $or: [
          { referrerRewardGranted: false },
          { referredRewardGranted: false },
        ],
      },
    ],
  });

  if (!referral) return; // No referral to process or retry

  const campaign = await ReferralCampaign.findById(
    referral.campaignId,
  ).lean();
  if (!campaign || !campaign.active) return;

  const maxFreeDays = await getReferralMaxFreeDays();

  // Mark as qualified (if not already)
  if (referral.status === ReferralStatus.PENDING) {
    referral.status = ReferralStatus.QUALIFIED;
    referral.qualifiedAt = new Date();
  }

  // Grant referrer reward (skip if already granted)
  if (!referral.referrerRewardGranted) {
    try {
      await grantReward(
        referral.referrerTenantId.toString(),
        campaign.referrerReward,
        maxFreeDays,
        `Referral reward: ${referral.referralCode} (you referred a new user)`,
      );
      referral.referrerRewardGranted = true;
    } catch (err) {
      console.error(
        `Failed to grant referrer reward for referral ${referral._id} ` +
        `(referrer: ${referral.referrerTenantId}, referred: ${referredTenantId}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Grant referred reward (skip if already granted)
  if (!referral.referredRewardGranted) {
    try {
      await grantReward(
        referredTenantId,
        campaign.referredReward,
        maxFreeDays,
        `Welcome reward: signed up with referral code ${referral.referralCode}`,
      );
      referral.referredRewardGranted = true;
    } catch (err) {
      console.error(
        `Failed to grant referred reward for referral ${referral._id} ` +
        `(referred: ${referredTenantId}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Mark as rewarded only if both succeeded
  if (referral.referrerRewardGranted && referral.referredRewardGranted) {
    referral.status = ReferralStatus.REWARDED;
  }

  // Single save at the end — status + reward flags together
  await referral.save();
}

/**
 * Get referral stats for a tenant (referrer dashboard).
 */
export async function getReferralStats(tenantId: string) {
  // Only fetch actual invite records (exclude the "master" code document)
  const referrals = await Referral.find({
    referrerTenantId: tenantId,
    referredTenantId: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .lean();

  const totalReferred = referrals.length;
  const totalRewarded = referrals.filter(
    (r) => r.status === ReferralStatus.REWARDED,
  ).length;
  const pending = referrals.filter(
    (r) => r.status === ReferralStatus.PENDING,
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

    try {
      await applyAdjustment(
        tenantId,
        days,
        AdjustmentType.REFERRAL_REWARD,
        reason,
        tenantId, // Self-attribution for referral rewards
      );
    } catch (err: any) {
      // If the tenant has no subscription at all (e.g. account created
      // before the SaaS system was added), provision a trial first,
      // then retry the adjustment.
      if (err?.message?.includes('No active subscription found')) {
        console.log(`[REFERRAL] Tenant ${tenantId} has no subscription — provisioning trial first`);
        await createTrialSubscription(tenantId);
        await applyAdjustment(
          tenantId,
          days,
          AdjustmentType.REFERRAL_REWARD,
          reason,
          tenantId,
        );
      } else {
        throw err;
      }
    }
  }

  // PERCENT_DISCOUNT and FLAT_DISCOUNT are applied at checkout time,
  // not as subscription adjustments. They would be stored as a
  // "referral discount" on the tenant and applied in pricingService.
  // For Phase 1, only FREE_DAYS is auto-applied.
}
