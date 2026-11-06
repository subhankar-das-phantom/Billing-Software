/**
 * Bharat Enterprise Billing System — SaaS Offer Controller
 * Provides active promotional campaigns, discounts, and system alerts to authenticated tenants.
 */

import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import PlatformOfferCampaign, {
  IPlatformOfferCampaign,
} from '../../../admin/backend/models/PlatformOfferCampaign';
import { getActiveSubscription } from '../services/subscriptionService';
import type { SaaSRequest } from '../types';

const getTenantId = require('../../utils/getTenantId');

const PRIORITY_WEIGHTS: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

/**
 * GET /api/saas/offers/active
 * Retrieve currently active promotional offers and campaigns targeted to the requesting tenant.
 */
export async function getActiveOffers(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to retrieve tenant offers',
        offers: [],
      });
      return;
    }

    const tenantId = getTenantId(req);
    if (!tenantId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to retrieve tenant offers',
        offers: [],
      });
      return;
    }

    const tenantObjId = new Types.ObjectId(tenantId.toString());

    // 1. Resolve tenant's active subscription (plan code and status)
    const subscription = await getActiveSubscription(tenantId.toString());
    const planCode =
      subscription?.currentPricingSnapshot?.planCode ||
      (subscription?.planId as any)?.code ||
      null;
    const status = subscription?.status || null;

    const now = new Date();

    // 2. Build audience match condition
    const audienceConditions: Record<string, unknown>[] = [
      { targetAudience: 'ALL_TENANTS' },
      { targetAudience: 'SPECIFIC_TENANTS', targetTenantIds: tenantObjId },
    ];

    if (planCode) {
      audienceConditions.push({
        targetAudience: 'BY_PLAN',
        targetPlanCodes: planCode,
      });
    }

    if (status) {
      audienceConditions.push({
        targetAudience: 'BY_STATUS',
        targetStatuses: status,
      });
    }

    // 3. Query active campaigns within valid time window
    const campaigns = await PlatformOfferCampaign.find({
      isActive: true,
      startsAt: { $lte: now },
      expiresAt: { $gte: now },
      $or: audienceConditions,
    })
      .sort({ createdAt: -1 })
      .lean();

    // 4. Stable sort by priority (URGENT > HIGH > NORMAL > LOW) then recency
    campaigns.sort((a: IPlatformOfferCampaign, b: IPlatformOfferCampaign) => {
      const pA = PRIORITY_WEIGHTS[a.priority] ?? 2;
      const pB = PRIORITY_WEIGHTS[b.priority] ?? 2;
      if (pB !== pA) return pB - pA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 5. Transform to clean client DTO (Zero Data Leakage: no internal admin IDs or counters)
    const offers = campaigns.map((camp: IPlatformOfferCampaign) => ({
      _id: camp._id,
      title: camp.title,
      message: camp.message,
      type: camp.type,
      promoCode: camp.promoCode || '',
      discountType: camp.discountType,
      discountValue: camp.discountValue,
      bannerStyle: camp.bannerStyle,
      callToAction: camp.callToAction,
      isDismissible: camp.isDismissible,
      startsAt: camp.startsAt,
      expiresAt: camp.expiresAt,
      priority: camp.priority,
    }));

    res.status(200).json({
      success: true,
      offers,
      data: offers,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/saas/offers/validate
 * POST /api/saas/offers/validate-promo
 * Validate a promotional voucher / coupon code for the requesting tenant.
 */
export async function validatePromoCode(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        valid: false,
        message: 'Authentication required to validate promotional voucher',
      });
      return;
    }

    const tenantId = getTenantId(req);
    if (!tenantId) {
      res.status(401).json({
        success: false,
        valid: false,
        message: 'Authentication required to validate promotional voucher',
      });
      return;
    }

    const { promoCode, planCode: requestedPlanCode, durationMonths } = req.body || {};

    if (!promoCode || typeof promoCode !== 'string' || !promoCode.trim()) {
      res.status(400).json({
        success: false,
        valid: false,
        message: 'Please enter a promotional voucher code.',
      });
      return;
    }

    const cleanedCode = promoCode.trim();
    const tenantObjId = new Types.ObjectId(tenantId.toString());

    // 1. Resolve tenant's active subscription (plan code and status)
    const subscription = await getActiveSubscription(tenantId.toString());
    const currentPlanCode =
      subscription?.currentPricingSnapshot?.planCode ||
      (subscription?.planId as any)?.code ||
      null;
    const status = subscription?.status || null;

    const now = new Date();

    // 2. Build audience match condition
    const audienceConditions: Record<string, unknown>[] = [
      { targetAudience: 'ALL_TENANTS' },
      { targetAudience: 'SPECIFIC_TENANTS', targetTenantIds: tenantObjId },
    ];

    const planCodesToCheck = Array.from(
      new Set(
        [requestedPlanCode, currentPlanCode].filter(
          (c): c is string => typeof c === 'string' && Boolean(c),
        ),
      ),
    );

    if (planCodesToCheck.length > 0) {
      audienceConditions.push({
        targetAudience: 'BY_PLAN',
        targetPlanCodes: { $in: planCodesToCheck },
      });
    }

    if (status) {
      audienceConditions.push({
        targetAudience: 'BY_STATUS',
        targetStatuses: status,
      });
    }

    // 3. Resolve active campaign with matching promoCode
    const escapedCode = cleanedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const campaign = await PlatformOfferCampaign.findOne({
      isActive: true,
      startsAt: { $lte: now },
      expiresAt: { $gte: now },
      promoCode: new RegExp('^' + escapedCode + '$', 'i'),
      $or: audienceConditions,
    }).lean();

    if (!campaign) {
      res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid or expired promotional voucher code.',
      });
      return;
    }

    // 4. Calculate discount details based on discountType & discountValue
    let discountDescription = '';
    switch (campaign.discountType) {
      case 'PERCENTAGE':
        discountDescription = `${campaign.discountValue}% OFF`;
        break;
      case 'FLAT':
        discountDescription = `₹${campaign.discountValue} FLAT OFF`;
        break;
      case 'BONUS_DAYS':
        discountDescription = `+${campaign.discountValue} Extra Days Free`;
        break;
      case 'NONE':
      default:
        discountDescription = 'Promotional Offer';
        break;
    }

    res.status(200).json({
      success: true,
      valid: true,
      campaign: {
        _id: campaign._id,
        title: campaign.title,
        promoCode: campaign.promoCode || cleanedCode.toUpperCase(),
        discountType: campaign.discountType,
        discountValue: campaign.discountValue,
        discountDescription,
        message: campaign.message,
        bannerStyle: campaign.bannerStyle,
        expiresAt: campaign.expiresAt,
      },
      message: 'Promo code applied successfully!',
    });
  } catch (error) {
    next(error);
  }
}
