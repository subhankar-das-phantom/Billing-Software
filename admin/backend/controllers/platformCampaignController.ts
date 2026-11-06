/**
 * Bharat Enterprise Billing System — Platform Campaign Controller
 * Promotional offers, discount coupons, broadcast notifications, and audience targeting.
 */

import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import PlatformOfferCampaign, {
  CampaignType,
  TargetAudience,
  CampaignDiscountType,
  BannerStyle,
  CampaignPriority,
} from '../models/PlatformOfferCampaign';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import Notification from '../../../backend/saas/models/Notification';
import {
  NotificationType,
  NotificationChannel,
  SubscriptionStatus,
} from '../../../backend/saas/shared/features';
import { logPlatformAudit } from '../services/platformAuditService';
import { PlatformRequest } from '../types';

function getAdminModel() {
  const mongoose = require('mongoose');
  if (mongoose.models.Admin) {
    return mongoose.models.Admin;
  }
  const loaded = require('../../../backend/models/Admin');
  return loaded.default || loaded;
}

/**
 * GET /api/platform/campaigns
 * Paginated listing of campaigns with debounced search and audience filters.
 */
export async function listCampaigns(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const { type, targetAudience, isActive, search } = req.query;
    const filter: Record<string, unknown> = {};

    if (type && Object.values(CampaignType).includes(type as CampaignType)) {
      filter.type = type;
    }

    if (
      targetAudience &&
      Object.values(TargetAudience).includes(targetAudience as TargetAudience)
    ) {
      filter.targetAudience = targetAudience;
    }

    if (isActive !== undefined) {
      if (isActive === 'true') filter.isActive = true;
      else if (isActive === 'false') filter.isActive = false;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { title: searchRegex },
        { message: searchRegex },
        { promoCode: searchRegex },
      ];
    }

    const [campaigns, total] = await Promise.all([
      PlatformOfferCampaign.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', '_id fullName email role')
        .lean(),
      PlatformOfferCampaign.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/platform/campaigns/:id
 * Retrieve a single promotional campaign by ID with creator details.
 */
export async function getCampaignById(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      return;
    }

    const campaign = await PlatformOfferCampaign.findById(id)
      .populate('createdBy', '_id fullName email role')
      .populate('targetTenantIds', '_id firmName email firmGSTIN')
      .lean();

    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/campaigns
 * Create a new promotional campaign or broadcast alert.
 */
export async function createCampaign(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      title,
      message,
      type = CampaignType.PROMOTIONAL_OFFER,
      targetAudience = TargetAudience.ALL_TENANTS,
      targetPlanCodes = [],
      targetStatuses = [],
      targetTenantIds = [],
      promoCode,
      discountType = CampaignDiscountType.NONE,
      discountValue = 0,
      bannerStyle = BannerStyle.BLUE,
      callToAction,
      isDismissible = true,
      startsAt,
      expiresAt,
      isActive = true,
      priority = CampaignPriority.NORMAL,
      reason,
    } = req.body;

    // Validation: Title & Message
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, message: 'Campaign title is required' });
      return;
    }
    if (title.trim().length > 200) {
      res.status(400).json({ success: false, message: 'Campaign title cannot exceed 200 characters' });
      return;
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, message: 'Campaign message is required' });
      return;
    }
    if (message.trim().length > 1000) {
      res.status(400).json({ success: false, message: 'Campaign message cannot exceed 1000 characters' });
      return;
    }

    // Validation: Dates
    if (!startsAt || !expiresAt) {
      res.status(400).json({ success: false, message: 'Both startsAt and expiresAt dates are required' });
      return;
    }
    const startDate = new Date(startsAt);
    const expiryDate = new Date(expiresAt);
    if (isNaN(startDate.getTime()) || isNaN(expiryDate.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid start or expiry date format' });
      return;
    }
    if (expiryDate.getTime() <= startDate.getTime()) {
      res.status(400).json({ success: false, message: 'Expiry date must be strictly after start date' });
      return;
    }

    // Validation: Discount Bounds
    const numDiscountValue = Number(discountValue) || 0;
    if (numDiscountValue < 0) {
      res.status(400).json({ success: false, message: 'Discount value cannot be negative' });
      return;
    }
    if (discountType === CampaignDiscountType.PERCENTAGE && numDiscountValue > 100) {
      res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%' });
      return;
    }

    // Normalize target tenant IDs
    const validTenantIds: Types.ObjectId[] = [];
    if (Array.isArray(targetTenantIds)) {
      for (const tId of targetTenantIds) {
        if (typeof tId === 'string' && Types.ObjectId.isValid(tId)) {
          validTenantIds.push(new Types.ObjectId(tId));
        } else if (tId instanceof Types.ObjectId) {
          validTenantIds.push(tId);
        }
      }
    }

    const operator = req.platformUser;

    const campaign = new PlatformOfferCampaign({
      title: title.trim(),
      message: message.trim(),
      type,
      targetAudience,
      targetPlanCodes: Array.isArray(targetPlanCodes) ? targetPlanCodes : [],
      targetStatuses: Array.isArray(targetStatuses) ? targetStatuses : [],
      targetTenantIds: validTenantIds,
      promoCode: promoCode && typeof promoCode === 'string' ? promoCode.trim().toUpperCase() : null,
      discountType,
      discountValue: numDiscountValue,
      bannerStyle,
      callToAction: callToAction && typeof callToAction === 'object' ? callToAction : undefined,
      isDismissible: Boolean(isDismissible),
      startsAt: startDate,
      expiresAt: expiryDate,
      isActive: Boolean(isActive),
      priority,
      broadcastCount: 0,
      createdBy: operator?._id || null,
    });

    await campaign.save();

    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'CAMPAIGN.CREATE',
      targetType: 'PlatformOfferCampaign',
      targetId: campaign._id.toString(),
      reason: reason || 'Platform campaign created',
      severity: 'INFO',
      after: campaign.toObject() as unknown as Record<string, unknown>,
    });

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/platform/campaigns/:id
 * Full update of campaign configuration, schedule, targeting, and discount rules.
 */
export async function updateCampaign(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      return;
    }

    const campaign = await PlatformOfferCampaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const beforeState = campaign.toObject();
    const {
      title,
      message,
      type,
      targetAudience,
      targetPlanCodes,
      targetStatuses,
      targetTenantIds,
      promoCode,
      discountType,
      discountValue,
      bannerStyle,
      callToAction,
      isDismissible,
      startsAt,
      expiresAt,
      isActive,
      priority,
      reason,
    } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ success: false, message: 'Campaign title cannot be empty' });
        return;
      }
      if (title.trim().length > 200) {
        res.status(400).json({ success: false, message: 'Campaign title cannot exceed 200 characters' });
        return;
      }
      campaign.title = title.trim();
    }

    if (message !== undefined) {
      if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ success: false, message: 'Campaign message cannot be empty' });
        return;
      }
      if (message.trim().length > 1000) {
        res.status(400).json({ success: false, message: 'Campaign message cannot exceed 1000 characters' });
        return;
      }
      campaign.message = message.trim();
    }

    if (type !== undefined && Object.values(CampaignType).includes(type)) {
      campaign.type = type;
    }

    if (targetAudience !== undefined && Object.values(TargetAudience).includes(targetAudience)) {
      campaign.targetAudience = targetAudience;
    }

    if (targetPlanCodes !== undefined && Array.isArray(targetPlanCodes)) {
      campaign.targetPlanCodes = targetPlanCodes;
    }

    if (targetStatuses !== undefined && Array.isArray(targetStatuses)) {
      campaign.targetStatuses = targetStatuses;
    }

    if (targetTenantIds !== undefined && Array.isArray(targetTenantIds)) {
      const validTenantIds: Types.ObjectId[] = [];
      for (const tId of targetTenantIds) {
        if (typeof tId === 'string' && Types.ObjectId.isValid(tId)) {
          validTenantIds.push(new Types.ObjectId(tId));
        } else if (tId instanceof Types.ObjectId) {
          validTenantIds.push(tId);
        }
      }
      campaign.targetTenantIds = validTenantIds;
    }

    if (promoCode !== undefined) {
      campaign.promoCode =
        promoCode && typeof promoCode === 'string' ? promoCode.trim().toUpperCase() : null;
    }

    const resolvedDiscountType = discountType !== undefined ? discountType : campaign.discountType;
    if (discountType !== undefined && Object.values(CampaignDiscountType).includes(discountType)) {
      campaign.discountType = discountType;
    }

    if (discountValue !== undefined) {
      const numDiscount = Number(discountValue) || 0;
      if (numDiscount < 0) {
        res.status(400).json({ success: false, message: 'Discount value cannot be negative' });
        return;
      }
      if (resolvedDiscountType === CampaignDiscountType.PERCENTAGE && numDiscount > 100) {
        res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%' });
        return;
      }
      campaign.discountValue = numDiscount;
    }

    if (bannerStyle !== undefined && Object.values(BannerStyle).includes(bannerStyle)) {
      campaign.bannerStyle = bannerStyle;
    }

    if (callToAction !== undefined) {
      campaign.callToAction =
        callToAction && typeof callToAction === 'object' ? callToAction : undefined;
    }

    if (isDismissible !== undefined) {
      campaign.isDismissible = Boolean(isDismissible);
    }

    const newStart = startsAt ? new Date(startsAt) : campaign.startsAt;
    const newExpiry = expiresAt ? new Date(expiresAt) : campaign.expiresAt;

    if (isNaN(newStart.getTime()) || isNaN(newExpiry.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid start or expiry date format' });
      return;
    }
    if (newExpiry.getTime() <= newStart.getTime()) {
      res.status(400).json({ success: false, message: 'Expiry date must be strictly after start date' });
      return;
    }

    if (startsAt) campaign.startsAt = newStart;
    if (expiresAt) campaign.expiresAt = newExpiry;

    if (isActive !== undefined) {
      campaign.isActive = Boolean(isActive);
    }

    if (priority !== undefined && Object.values(CampaignPriority).includes(priority)) {
      campaign.priority = priority;
    }

    await campaign.save();

    const operator = req.platformUser;

    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'CAMPAIGN.UPDATE',
      targetType: 'PlatformOfferCampaign',
      targetId: campaign._id.toString(),
      reason: reason || 'Platform campaign configuration updated',
      severity: 'INFO',
      before: beforeState as unknown as Record<string, unknown>,
      after: campaign.toObject() as unknown as Record<string, unknown>,
    });

    res.status(200).json({
      success: true,
      message: 'Campaign updated successfully',
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/platform/campaigns/:id
 * Deactivates or soft-deletes a promotional campaign.
 */
export async function deleteCampaign(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      return;
    }

    const campaign = await PlatformOfferCampaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const beforeState = campaign.toObject();
    campaign.isActive = false;
    await campaign.save();

    const operator = req.platformUser;

    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'CAMPAIGN.DELETE',
      targetType: 'PlatformOfferCampaign',
      targetId: campaign._id.toString(),
      reason: req.body?.reason || 'Campaign deactivated/deleted by platform operator',
      severity: 'INFO',
      before: beforeState as unknown as Record<string, unknown>,
      after: campaign.toObject() as unknown as Record<string, unknown>,
    });

    res.status(200).json({
      success: true,
      message: 'Campaign deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/campaigns/:id/broadcast
 * Broadcasts campaign announcement or promotional banner to target tenants via in-app notifications.
 */
export async function broadcastCampaign(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      return;
    }

    const campaign = await PlatformOfferCampaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const Admin = getAdminModel();
    let targetTenantIds: Types.ObjectId[] = [];

    switch (campaign.targetAudience) {
      case TargetAudience.ALL_TENANTS: {
        const activeAdmins = await Admin.find({ isActive: true }).select('_id').lean();
        targetTenantIds = activeAdmins.map((a: any) => a._id);
        break;
      }

      case TargetAudience.SPECIFIC_TENANTS: {
        const configuredIds = campaign.targetTenantIds || [];
        if (configuredIds.length > 0) {
          const activeAdmins = await Admin.find({
            _id: { $in: configuredIds },
            isActive: true,
          })
            .select('_id')
            .lean();
          targetTenantIds = activeAdmins.map((a: any) => a._id);
        }
        break;
      }

      case TargetAudience.BY_PLAN: {
        const targetCodes = campaign.targetPlanCodes || [];
        if (targetCodes.length > 0) {
          const matchingPlans = await Plan.find({ code: { $in: targetCodes } })
            .select('_id')
            .lean();
          const planIds = matchingPlans.map((p: any) => p._id);

          const activeSubs = await Subscription.find({
            $or: [
              { 'currentPricingSnapshot.planCode': { $in: targetCodes } },
              { planId: { $in: planIds } },
            ],
            status: {
              $in: [
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.TRIAL,
                SubscriptionStatus.GRACE,
              ],
            },
          })
            .select('tenantId')
            .lean();

          const candidateTenantIds = Array.from(
            new Set(activeSubs.map((s: any) => s.tenantId.toString())),
          ).map((tId) => new Types.ObjectId(tId));

          const activeAdmins = await Admin.find({
            _id: { $in: candidateTenantIds },
            isActive: true,
          })
            .select('_id')
            .lean();
          targetTenantIds = activeAdmins.map((a: any) => a._id);
        }
        break;
      }

      case TargetAudience.BY_STATUS: {
        const targetStatuses = campaign.targetStatuses || [];
        if (targetStatuses.length > 0) {
          const matchingSubs = await Subscription.find({
            status: { $in: targetStatuses },
          })
            .select('tenantId')
            .lean();

          const candidateTenantIds = Array.from(
            new Set(matchingSubs.map((s: any) => s.tenantId.toString())),
          ).map((tId) => new Types.ObjectId(tId));

          const activeAdmins = await Admin.find({
            _id: { $in: candidateTenantIds },
            isActive: true,
          })
            .select('_id')
            .lean();
          targetTenantIds = activeAdmins.map((a: any) => a._id);
        }
        break;
      }
    }

    // Insert in-app notifications in batch
    if (targetTenantIds.length > 0) {
      const notifications = targetTenantIds.map((tId) => ({
        tenantId: tId,
        type: NotificationType.SYSTEM,
        channel: NotificationChannel.IN_APP,
        title: campaign.title,
        message: campaign.message,
        data: {
          campaignId: campaign._id,
          campaignType: campaign.type,
          promoCode: campaign.promoCode || undefined,
          discountType: campaign.discountType,
          discountValue: campaign.discountValue,
          bannerStyle: campaign.bannerStyle,
          callToAction: campaign.callToAction,
          priority: campaign.priority,
        },
        read: false,
        readAt: null,
      }));

      await Notification.insertMany(notifications, { ordered: false });
    }

    // Atomically increment broadcast counter
    const updatedCampaign = await PlatformOfferCampaign.findByIdAndUpdate(
      campaign._id,
      { $inc: { broadcastCount: 1 } },
      { new: true },
    );

    const operator = req.platformUser;

    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'CAMPAIGN.BROADCAST',
      targetType: 'PlatformOfferCampaign',
      targetId: campaign._id.toString(),
      reason: req.body?.reason || 'Campaign broadcast dispatched to matching tenants',
      severity: 'INFO',
      after: {
        targetAudience: campaign.targetAudience,
        recipientCount: targetTenantIds.length,
        broadcastCount: updatedCampaign?.broadcastCount ?? campaign.broadcastCount + 1,
      },
    });

    res.status(200).json({
      success: true,
      message: `Campaign broadcast successfully delivered to ${targetTenantIds.length} tenants`,
      data: {
        recipientCount: targetTenantIds.length,
        broadcastCount: updatedCampaign?.broadcastCount ?? campaign.broadcastCount + 1,
      },
    });
  } catch (error) {
    next(error);
  }
}
