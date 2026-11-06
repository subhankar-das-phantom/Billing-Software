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
