/**
 * Bharat Enterprise Billing System — Platform Plan Administration Controller
 * CRUD management for SaaS subscription tiers, pricing baselines, and feature entitlements.
 */

import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Plan from '../../../backend/saas/models/Plan';
import { invalidatePricingCache } from '../../../backend/saas/services/pricingService';
import { logPlatformAudit } from '../services/platformAuditService';
import { PlatformRequest } from '../types';
import { Feature } from '../../../backend/saas/shared/features';

/**
 * GET /api/platform/plans
 * List all SaaS plans (optionally filtered by active state).
 */
export async function listPlans(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { active } = req.query;
    const filter: Record<string, unknown> = {};

    if (active === 'true') {
      filter.active = true;
    } else if (active === 'false') {
      filter.active = false;
    }

    const plans = await Plan.find(filter)
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: plans,
      count: plans.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/platform/plans/:id
 * Retrieve a single plan by ID.
 */
export async function getPlanById(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid plan ID' });
      return;
    }

    const plan = await Plan.findById(id).lean();
    if (!plan) {
      res.status(404).json({ success: false, message: 'Plan not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/plans
 * Create a new SaaS plan tier.
 */
export async function createPlan(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      name,
      code,
      description,
      baseMonthlyPrice,
      features,
      active = true,
      displayOrder = 0,
      metadata = {},
      reason,
    } = req.body;
    const operator = req.platformUser;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Plan name is required' });
      return;
    }

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Plan code is required' });
      return;
    }

    const normalizedCode = code.toLowerCase().trim();

    if (baseMonthlyPrice === undefined || isNaN(Number(baseMonthlyPrice)) || Number(baseMonthlyPrice) < 0) {
      res.status(400).json({
        success: false,
        message: 'baseMonthlyPrice must be a non-negative number',
      });
      return;
    }

    if (!Array.isArray(features) || features.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Plan must contain at least one feature entitlement',
      });
      return;
    }

    // Validate feature strings against canonical Feature enum
    const validFeatures = Object.values(Feature);
    const invalidFeatures = features.filter((f) => !validFeatures.includes(f));
    if (invalidFeatures.length > 0) {
      res.status(400).json({
        success: false,
        message: `Invalid features specified: ${invalidFeatures.join(', ')}`,
      });
      return;
    }

    // Check code uniqueness
    const existing = await Plan.findOne({ code: normalizedCode }).lean();
    if (existing) {
      res.status(400).json({
        success: false,
        message: `Plan with code "${normalizedCode}" already exists`,
      });
      return;
    }

    const plan = await Plan.create({
      name: name.trim(),
      code: normalizedCode,
      description: (description || '').trim(),
      baseMonthlyPrice: Number(baseMonthlyPrice),
      features,
      active: Boolean(active),
      displayOrder: Number(displayOrder) || 0,
      metadata: metadata || {},
    });

    invalidatePricingCache();

    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'PLAN.CREATE',
      targetType: 'Plan',
      targetId: plan._id.toString(),
      reason: reason || 'Created new subscription plan',
      after: {
        name: plan.name,
        code: plan.code,
        baseMonthlyPrice: plan.baseMonthlyPrice,
        features: plan.features,
      },
      severity: 'INFO',
    });

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      data: plan,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/platform/plans/:id
 * Update an existing SaaS plan tier.
 */
export async function updatePlan(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    const operator = req.platformUser;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid plan ID' });
      return;
    }

    const plan = await Plan.findById(id);
    if (!plan) {
      res.status(404).json({ success: false, message: 'Plan not found' });
      return;
    }

    const {
      name,
      description,
      baseMonthlyPrice,
      features,
      active,
      displayOrder,
      metadata,
      reason,
    } = req.body;

    const priorState = plan.toObject();

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ success: false, message: 'Plan name cannot be empty' });
        return;
      }
      plan.name = name.trim();
    }

    if (description !== undefined) {
      plan.description = String(description).trim();
    }

    if (baseMonthlyPrice !== undefined) {
      const price = Number(baseMonthlyPrice);
      if (isNaN(price) || price < 0) {
        res.status(400).json({
          success: false,
          message: 'baseMonthlyPrice must be a non-negative number',
        });
        return;
      }
      plan.baseMonthlyPrice = price;
    }

    if (features !== undefined) {
      if (!Array.isArray(features) || features.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Plan must contain at least one feature entitlement',
        });
        return;
      }
      const validFeatures = Object.values(Feature);
      const invalidFeatures = features.filter((f) => !validFeatures.includes(f));
      if (invalidFeatures.length > 0) {
        res.status(400).json({
          success: false,
          message: `Invalid features specified: ${invalidFeatures.join(', ')}`,
        });
        return;
      }
      plan.features = features;
    }

    if (active !== undefined) {
      plan.active = Boolean(active);
    }

    if (displayOrder !== undefined) {
      plan.displayOrder = Number(displayOrder) || 0;
    }

    if (metadata !== undefined) {
      plan.metadata = metadata;
    }

    await plan.save();
    invalidatePricingCache();

    await logPlatformAudit({
      actorId: operator?._id || null,
      actorEmail: operator?.email || 'platform@bharatenterprise.com',
      actorRole: operator?.role || 'PLATFORM_ADMIN',
      action: 'PLAN.UPDATE',
      targetType: 'Plan',
      targetId: plan._id.toString(),
      reason: reason || 'Updated subscription plan attributes',
      before: {
        name: priorState.name,
        baseMonthlyPrice: priorState.baseMonthlyPrice,
        features: priorState.features,
        active: priorState.active,
      },
      after: {
        name: plan.name,
        baseMonthlyPrice: plan.baseMonthlyPrice,
        features: plan.features,
        active: plan.active,
      },
      severity: 'INFO',
    });

    res.status(200).json({
      success: true,
      message: 'Plan updated successfully',
      data: plan,
    });
  } catch (error) {
    next(error);
  }
}
