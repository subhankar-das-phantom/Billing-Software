/**
 * Bharat Enterprise Billing System — Platform Subscription Controller
 * Full lifecycle administration, manual adjustments, status overrides,
 * and two-phase payment reconciliation for SaaS subscriptions.
 */

import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import SubscriptionPayment from '../../../backend/saas/models/SubscriptionPayment';
import SubscriptionAdjustment from '../../../backend/saas/models/SubscriptionAdjustment';
import TenantFeatureOverride from '../models/TenantFeatureOverride';
import {
  activateSubscription as activateSubscriptionDomain,
  applyAdjustment as applyAdjustmentDomain,
  suspendSubscription as suspendSubscriptionDomain,
  resumeSubscription as resumeSubscriptionDomain,
} from '../../../backend/saas/services/subscriptionService';
import {
  reconcilePayment as reconcilePaymentDomain,
  handleRazorpayWebhook as handleRazorpayWebhookDomain,
  processRazorpayWebhook,
  verifyWebhookSignature,
  verifyPaymentSignature,
  timingSafeCompare,
} from '../services/platformSubscriptionService';
import { resolveEffectiveFeatures } from '../services/featureOverrideService';
export {
  handleRazorpayWebhookDomain as handleRazorpayWebhook,
  processRazorpayWebhook,
  verifyWebhookSignature,
  verifyPaymentSignature,
  timingSafeCompare,
};
import { invalidatePlatformDashboardCache } from '../queries/dashboardQueries';
import { invalidatePricingCache } from '../../../backend/saas/services/pricingService';
import { invalidateSubscriptionCache } from '../../../backend/saas/services/featureService';
import * as auditService from '../services/platformAuditService';
const { logPlatformAudit } = auditService;
import {
  PlatformRequest,
  PlatformPermission,
  PlatformRole,
} from '../types';
import {
  SubscriptionStatus,
  PaymentStatus,
  PaymentGateway,
  AdjustmentType,
} from '../../../backend/saas/shared/features';

function getAdminModel() {
  const mongoose = require('mongoose');
  if (mongoose.models.Admin) {
    return mongoose.models.Admin;
  }
  const loaded = require('../../../backend/models/Admin');
  return loaded.default || loaded;
}

function getRazorpayInstance() {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
      const Razorpay = require('razorpay');
      return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * GET /api/platform/subscriptions
 * List all subscriptions with bounded pagination and zero N+1 lookups.
 */
export async function listSubscriptions(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { status, planId, tenantId, search } = req.query;
    const filter: Record<string, unknown> = {};

    if (status && Object.values(SubscriptionStatus).includes(status as any)) {
      filter.status = status;
    }

    if (planId && Types.ObjectId.isValid(planId as string)) {
      filter.planId = new Types.ObjectId(planId as string);
    }

    if (tenantId && Types.ObjectId.isValid(tenantId as string)) {
      filter.tenantId = new Types.ObjectId(tenantId as string);
    }

    // Optional search across tenant firmName or email
    const Admin = getAdminModel();
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingAdmins = await Admin.find({
        $or: [
          { firmName: searchRegex },
          { email: searchRegex },
          { normalizedFirmName: searchRegex },
        ],
      })
        .select('_id')
        .limit(100)
        .lean();

      const matchingTenantIds = matchingAdmins.map((a: any) => a._id);
      if (filter.tenantId) {
        // Intersect if tenantId was already specified
        filter.tenantId = { $in: [filter.tenantId, ...matchingTenantIds] };
      } else {
        filter.tenantId = { $in: matchingTenantIds };
      }
    }

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subscription.countDocuments(filter),
    ]);

    // Batch resolve tenants and plans to eliminate N+1 queries
    const tenantIds = Array.from(new Set(subscriptions.map((s) => s.tenantId.toString()))).map(
      (id) => new Types.ObjectId(id),
    );
    const planIds = Array.from(
      new Set(subscriptions.filter((s) => s.planId).map((s) => s.planId.toString())),
    ).map((id) => new Types.ObjectId(id));

    const [admins, plans] = await Promise.all([
      Admin.find({ _id: { $in: tenantIds } })
        .select('_id firmName email firmGSTIN firmPhone isActive')
        .lean(),
      Plan.find({ _id: { $in: planIds } })
        .select('_id name code baseMonthlyPrice features')
        .lean(),
    ]);

    const adminMap = new Map<string, any>(admins.map((a: any) => [a._id.toString(), a]));
    const planMap = new Map<string, any>(plans.map((p: any) => [p._id.toString(), p]));

    const now = new Date();
    const formatted = subscriptions.map((sub) => {
      const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
      const expiryTime = expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt.getTime() : 0;
      const daysRemaining = expiryTime > 0
        ? Math.max(0, Math.ceil((expiryTime - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const isGrace =
        sub.status === SubscriptionStatus.GRACE ||
        (now.getTime() > expiryTime && sub.graceUntil && new Date(sub.graceUntil) >= now);

      return {
        ...sub,
        tenant: adminMap.get(sub.tenantId.toString()) || null,
        plan: sub.planId ? planMap.get(sub.planId.toString()) || null : null,
        daysRemaining,
        isGrace,
      };
    });

    res.status(200).json({
      success: true,
      data: formatted,
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
 * GET /api/platform/subscriptions/:id
 * Retrieve detailed subscription information including payments, adjustments, and active overrides.
 */
export async function getSubscriptionById(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : (Array.isArray(rawId) ? rawId[0] : '');
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid subscription ID' });
      return;
    }

    const subscription = await Subscription.findById(id).lean();
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Subscription not found' });
      return;
    }

    const Admin = getAdminModel();
    const [tenant, plan, payments, adjustments, activeOverrides, effectiveAccess] =
      await Promise.all([
        Admin.findById(subscription.tenantId)
          .select('_id firmName email firmGSTIN firmPhone firmAddress isActive createdAt')
          .lean(),
        subscription.planId ? Plan.findById(subscription.planId).lean() : null,
        SubscriptionPayment.find({
          $or: [{ subscriptionId: subscription._id }, { tenantId: subscription.tenantId }],
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
        SubscriptionAdjustment.find({
          $or: [{ subscriptionId: subscription._id }, { tenantId: subscription.tenantId }],
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
        TenantFeatureOverride.find({
          tenantId: subscription.tenantId,
          isActive: true,
        })
          .sort({ createdAt: -1 })
          .lean(),
        resolveEffectiveFeatures(subscription.tenantId.toString()),
      ]);

    const now = new Date();
    const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
    const expiryTime = expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt.getTime() : 0;
    const daysRemaining = expiryTime > 0
      ? Math.max(0, Math.ceil((expiryTime - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    res.status(200).json({
      success: true,
      data: {
        subscription: {
          ...subscription,
          tenant,
          plan,
          daysRemaining,
          isGrace:
            subscription.status === SubscriptionStatus.GRACE ||
            (now.getTime() > expiryTime && subscription.graceUntil && new Date(subscription.graceUntil) >= now),
        },
        payments,
        adjustments,
        activeOverrides,
        effectiveAccess,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/subscriptions/activate
 * Manual plan extension or renewal executed by Platform Admin.
 */
export async function activateSubscription(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, planId, durationMonths, reason } = req.body;
    const operator = req.platformUser;

    if (!tenantId || !Types.ObjectId.isValid(tenantId)) {
      res.status(400).json({ success: false, message: 'Valid tenant ID is required' });
      return;
    }

    if (!planId || !Types.ObjectId.isValid(planId)) {
      res.status(400).json({ success: false, message: 'Valid plan ID is required' });
      return;
    }

    const duration = Number(durationMonths);
    if (!duration || duration <= 0) {
      res.status(400).json({ success: false, message: 'Duration in months must be positive' });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'A valid operational reason (minimum 10 characters) is required',
      });
      return;
    }

    const plan = await Plan.findById(planId).lean();
    if (!plan) {
      res.status(404).json({ success: false, message: 'Plan not found' });
      return;
    }

    // Create a manual completed payment record to anchor the audit trail
    const manualPayment = new SubscriptionPayment({
      tenantId: new Types.ObjectId(tenantId),
      planId: plan._id,
      durationMonths: duration,
      baseAmount: (plan.baseMonthlyPrice || 0) * duration,
      discountAmount: 0,
      finalAmount: (plan.baseMonthlyPrice || 0) * duration,
      paymentGateway: PaymentGateway.MANUAL,
      paymentStatus: PaymentStatus.COMPLETED,
      paidAt: new Date(),
      metadata: {
        reason,
        manualActivatedBy: operator?._id,
        operatorEmail: operator?.email,
      },
    });
    await manualPayment.save();

    const activationResult = await activateSubscriptionDomain(
      tenantId.toString(),
      planId.toString(),
      duration,
      manualPayment._id.toString(),
      { autoRenew: false },
    );

    invalidatePlatformDashboardCache();

    // Audit logging
    await auditService.logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'SUBSCRIPTION.MANUAL_ACTIVATION',
      targetType: 'Subscription',
      targetId: activationResult.subscription._id.toString(),
      targetTenantId: tenantId,
      reason,
      after: {
        planId,
        durationMonths: duration,
        paymentId: manualPayment._id,
        expiresAt: activationResult.subscription.expiresAt,
      },
      severity: 'WARNING',
    });

    res.status(200).json({
      success: true,
      message: 'Subscription manually activated successfully',
      data: activationResult,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/subscriptions/adjust
 * Add bonus or compensation days to a tenant subscription.
 */
export async function adjustSubscription(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawTenantId = req.body.tenantId || req.params.id;
    const { daysToAdd, reason, type } = req.body;
    const operator = req.platformUser;

    if (!rawTenantId || !Types.ObjectId.isValid(rawTenantId)) {
      res.status(400).json({ success: false, message: 'Valid tenant ID is required' });
      return;
    }
    const tenantId = rawTenantId;

    const days = parseInt(daysToAdd, 10);
    if (isNaN(days) || days === 0) {
      res.status(400).json({ success: false, message: 'daysToAdd must be a non-zero integer' });
      return;
    }

    // Role-based 14-day ceiling enforcement for Support Admin
    if (operator?.role === PlatformRole.SUPPORT_ADMIN && Math.abs(days) > 14) {
      res.status(403).json({
        success: false,
        message: 'Support Admin role is restricted to a maximum 14-day subscription adjustment ceiling.',
      });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'A valid operational reason (minimum 10 characters) is required',
      });
      return;
    }

    const adjustmentType =
      type && Object.values(AdjustmentType).includes(type)
        ? type
        : AdjustmentType.MANUAL_BONUS;

    await applyAdjustmentDomain(
      tenantId.toString(),
      days,
      adjustmentType,
      reason,
      operator?._id ? operator._id.toString() : tenantId.toString(),
    );

    invalidatePlatformDashboardCache();

    await auditService.logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'SUBSCRIPTION.ADJUSTMENT',
      targetType: 'Tenant',
      targetId: tenantId.toString(),
      targetTenantId: tenantId,
      reason,
      after: { daysAdded: days, adjustmentType },
      severity: 'INFO',
    });

    res.status(200).json({
      success: true,
      message: `Successfully applied adjustment of ${days} days to tenant subscription`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/subscriptions/toggle-status
 * Suspend or resume tenant subscription.
 */
export async function toggleSubscriptionStatus(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, action, reason } = req.body;
    const operator = req.platformUser;

    if (!tenantId || !Types.ObjectId.isValid(tenantId)) {
      res.status(400).json({ success: false, message: 'Valid tenant ID is required' });
      return;
    }

    if (action !== 'suspend' && action !== 'resume') {
      res.status(400).json({
        success: false,
        message: 'Action must be either "suspend" or "resume"',
      });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'A valid operational reason (minimum 10 characters) is required',
      });
      return;
    }

    let updatedSubscription: any;
    if (action === 'suspend') {
      updatedSubscription = await suspendSubscriptionDomain(tenantId.toString(), reason);
      await auditService.logPlatformAudit({
        actorId: operator?._id || null,
        actorEmail: operator?.email || 'platform@bharatenterprise.com',
        actorRole: operator?.role || 'PLATFORM_ADMIN',
        action: 'SUBSCRIPTION.SUSPEND',
        targetType: 'Subscription',
        targetId: updatedSubscription._id.toString(),
        targetTenantId: tenantId,
        reason,
        severity: 'WARNING',
      });
    } else {
      updatedSubscription = await resumeSubscriptionDomain(tenantId.toString(), reason);
      await auditService.logPlatformAudit({
        actorId: operator?._id || null,
        actorEmail: operator?.email || 'platform@bharatenterprise.com',
        actorRole: operator?.role || 'PLATFORM_ADMIN',
        action: 'SUBSCRIPTION.RESUME',
        targetType: 'Subscription',
        targetId: updatedSubscription._id.toString(),
        targetTenantId: tenantId,
        reason,
        severity: 'INFO',
      });
    }

    invalidatePlatformDashboardCache();

    res.status(200).json({
      success: true,
      message: `Subscription ${action}ed successfully`,
      data: updatedSubscription,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/subscriptions/reconcile-payment
 * Two-phase gateway reconciliation checking Razorpay status and atomically claiming payment.
 */
export async function reconcilePayment(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { paymentId, reason } = req.body;
    const operator = req.platformUser;

    const result = await reconcilePaymentDomain(paymentId, reason, operator);
    res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/platform/subscriptions/:id
 * Direct update of tenant subscription: plan tier, custom expiry date, status transitions,
 * auto-renew toggle, grace period days, custom pricing snapshot, with mandatory 10-char reason validation and audit logging.
 */
export async function updateSubscription(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : (Array.isArray(rawId) ? rawId[0] : '');
    const operator = req.platformUser;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid subscription ID' });
      return;
    }

    const {
      planId,
      planCode,
      status,
      expiresAt,
      graceUntil,
      gracePeriodDays,
      graceDays,
      autoRenew,
      customPrice,
      reason,
    } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'A valid operational reason (minimum 10 characters) is required',
      });
      return;
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Subscription not found' });
      return;
    }

    const priorState = subscription.toObject();

    // 1. Plan tier change validation
    let planChanged = false;
    let targetPlan: any = null;
    if (planId !== undefined || planCode !== undefined) {
      if (planId && Types.ObjectId.isValid(planId)) {
        targetPlan = await Plan.findById(planId).lean();
      } else if (planCode) {
        targetPlan = await Plan.findOne({ code: String(planCode).toLowerCase().trim() }).lean();
      }
      if (!targetPlan) {
        res.status(400).json({ success: false, message: 'Specified plan tier not found' });
        return;
      }
      subscription.planId = targetPlan._id;
      planChanged = true;
    }

    // 2. Custom price or plan change updates currentPricingSnapshot
    const numCustomPrice =
      customPrice !== undefined && customPrice !== null ? Number(customPrice) : undefined;
    if (numCustomPrice !== undefined && (isNaN(numCustomPrice) || numCustomPrice < 0)) {
      res.status(400).json({ success: false, message: 'customPrice must be a non-negative number' });
      return;
    }

    if (planChanged && targetPlan) {
      subscription.currentPricingSnapshot = {
        planName: targetPlan.name,
        planCode: targetPlan.code,
        baseMonthlyPrice:
          numCustomPrice !== undefined ? numCustomPrice : targetPlan.baseMonthlyPrice,
        durationMonths: subscription.currentPricingSnapshot?.durationMonths || 1,
        discountApplied: subscription.currentPricingSnapshot?.discountApplied || 0,
        finalAmount:
          numCustomPrice !== undefined ? numCustomPrice : targetPlan.baseMonthlyPrice,
        features: targetPlan.features,
      };
    } else if (numCustomPrice !== undefined && subscription.currentPricingSnapshot) {
      subscription.currentPricingSnapshot.baseMonthlyPrice = numCustomPrice;
      subscription.currentPricingSnapshot.finalAmount = numCustomPrice;
    }

    // 3. Custom expiry date
    if (expiresAt !== undefined) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime())) {
        res.status(400).json({ success: false, message: 'Invalid expiresAt date format' });
        return;
      }
      subscription.expiresAt = expDate;
    }

    // 4. Status transition
    if (status !== undefined) {
      if (!Object.values(SubscriptionStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: `Invalid status: must be one of ${Object.values(SubscriptionStatus).join(', ')}`,
        });
        return;
      }
      subscription.status = status;
    }

    // 5. Auto-renew toggle
    if (autoRenew !== undefined) {
      subscription.autoRenew = Boolean(autoRenew);
    }

    // 6. Grace period adjustment
    const effectiveGraceDays = gracePeriodDays !== undefined ? gracePeriodDays : graceDays;
    if (effectiveGraceDays !== undefined) {
      const days = Number(effectiveGraceDays);
      if (isNaN(days) || days < 0) {
        res.status(400).json({
          success: false,
          message: 'gracePeriodDays must be a non-negative number',
        });
        return;
      }
      subscription.gracePeriodDays = days;
      const baseDate = subscription.expiresAt || new Date();
      subscription.graceUntil = new Date(
        new Date(baseDate).getTime() + days * 24 * 60 * 60 * 1000,
      );
    } else if (graceUntil !== undefined) {
      const gDate = new Date(graceUntil);
      if (isNaN(gDate.getTime())) {
        res.status(400).json({ success: false, message: 'Invalid graceUntil date format' });
        return;
      }
      subscription.graceUntil = gDate;
    }

    await subscription.save();

    // Invalidate caches across platform and tenant boundaries
    invalidatePlatformDashboardCache();
    invalidatePricingCache();
    invalidateSubscriptionCache(subscription.tenantId.toString());

    await auditService.logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'SUBSCRIPTION.UPDATE',
      targetType: 'Subscription',
      targetId: subscription._id.toString(),
      targetTenantId: subscription.tenantId,
      reason,
      before: priorState as unknown as Record<string, unknown>,
      after: subscription.toObject() as unknown as Record<string, unknown>,
      severity: 'WARNING',
    });

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
}
