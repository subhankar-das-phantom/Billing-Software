/**
 * Admin SaaS Controller — super-admin APIs.
 *
 * Manages tenants, subscriptions, adjustments, campaigns,
 * pricing rules, and system settings.
 */

import type { Response, NextFunction } from 'express';
import type { SaaSRequest } from '../types';
import Subscription from '../models/Subscription';
import SubscriptionPayment from '../models/SubscriptionPayment';
import SubscriptionAdjustment from '../models/SubscriptionAdjustment';
import ReferralCampaign from '../models/ReferralCampaign';
import PricingRule from '../models/PricingRule';
import SystemSetting from '../models/SystemSetting';
import { applyAdjustment } from '../services/subscriptionService';
import { processExpiredSubscriptions } from '../services/subscriptionService';
import { getAllSettings, setSetting, invalidateCache } from '../services/settingsService';

const Admin = require('../../models/Admin');

// ─── Tenant Management ───────────────────────────────────────────

/**
 * GET /api/saas/admin/tenants
 * List all tenants with their subscription info.
 */
export async function listTenants(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      Admin.find({}).select('-password').skip(skip).limit(limit).lean(),
      Admin.countDocuments(),
    ]);

    // Fetch subscriptions for each tenant
    const tenantIds = tenants.map((t: any) => t._id);
    const subscriptions = await Subscription.find({
      tenantId: { $in: tenantIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Map subscriptions to tenants
    const subMap = new Map<string, any>();
    for (const sub of subscriptions) {
      const key = sub.tenantId.toString();
      if (!subMap.has(key)) {
        subMap.set(key, sub);
      }
    }

    const result = tenants.map((tenant: any) => ({
      ...tenant,
      subscription: subMap.get(tenant._id.toString()) || null,
    }));

    res.status(200).json({
      success: true,
      tenants: result,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

// ─── Subscription Management ─────────────────────────────────────

/**
 * GET /api/saas/admin/subscriptions
 * List all subscriptions with pagination.
 */
export async function listSubscriptions(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate('planId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subscription.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      subscriptions,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

// ─── Adjustments ─────────────────────────────────────────────────

/**
 * POST /api/saas/admin/adjustments
 * Add a manual adjustment (bonus days, compensation, etc.)
 *
 * Body: { tenantId, daysToAdd, type, reason }
 */
export async function createAdjustment(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, daysToAdd, type, reason } = req.body;
    const createdBy = req.user?._id?.toString();

    if (!tenantId || daysToAdd === undefined || !type || !reason) {
      res.status(400).json({
        success: false,
        message: 'tenantId, daysToAdd, type, and reason are required',
      });
      return;
    }

    await applyAdjustment(
      tenantId,
      daysToAdd,
      type,
      reason,
      createdBy!,
    );

    res.status(201).json({
      success: true,
      message: `${daysToAdd} days added to tenant subscription`,
    });
  } catch (error) {
    next(error);
  }
}

// ─── Payments ────────────────────────────────────────────────────

/**
 * GET /api/saas/admin/payments
 * List all subscription payments.
 */
export async function listPayments(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      SubscriptionPayment.find({})
        .populate('planId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SubscriptionPayment.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      payments,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

// ─── Referral Campaigns ──────────────────────────────────────────

export async function listCampaigns(
  _req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaigns = await ReferralCampaign.find({})
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, campaigns });
  } catch (error) {
    next(error);
  }
}

export async function createCampaign(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaign = await ReferralCampaign.create(req.body);
    res.status(201).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
}

export async function updateCampaign(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const campaign = await ReferralCampaign.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }
    res.status(200).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
}

// ─── Pricing Rules ───────────────────────────────────────────────

export async function listPricingRules(
  _req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rules = await PricingRule.find({})
      .populate('planId', 'name code')
      .sort({ planId: 1, durationMonths: 1 })
      .lean();
    res.status(200).json({ success: true, rules });
  } catch (error) {
    next(error);
  }
}

export async function upsertPricingRule(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { planId, durationMonths, discountType, discountValue, active } = req.body;

    const rule = await PricingRule.findOneAndUpdate(
      { planId, durationMonths },
      { $set: { discountType, discountValue, active: active !== false } },
      { upsert: true, new: true, runValidators: true },
    );

    res.status(200).json({ success: true, rule });
  } catch (error) {
    next(error);
  }
}

// ─── System Settings ─────────────────────────────────────────────

export async function getSettings(
  _req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const settings = await getAllSettings();
    res.status(200).json({ success: true, settings });
  } catch (error) {
    next(error);
  }
}

export async function updateSetting(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      res.status(400).json({
        success: false,
        message: 'key and value are required',
      });
      return;
    }

    await setSetting(key, value, description);
    invalidateCache(key);

    res.status(200).json({ success: true, message: 'Setting updated' });
  } catch (error) {
    next(error);
  }
}

// ─── Cron Trigger ────────────────────────────────────────────────

/**
 * POST /api/saas/admin/process-expired
 * Manually trigger the expiry cron job.
 */
export async function triggerExpiryCron(
  _req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await processExpiredSubscriptions();

    res.status(200).json({
      success: true,
      message: 'Expiry processing complete',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}
