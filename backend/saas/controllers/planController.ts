/**
 * Plan Controller — public plan listing + super-admin CRUD.
 */

import type { Response, NextFunction } from 'express';
import type { SaaSRequest } from '../types';
import Plan from '../models/Plan';
import { getAvailablePlans, invalidatePricingCache } from '../services/pricingService';

/**
 * GET /api/saas/plans
 * Public — returns all active plans with pricing for all durations.
 */
export async function getPlans(
  _req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const plans = await getAvailablePlans();

    res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/saas/plans/:id
 * Public — returns a single plan with pricing.
 */
export async function getPlan(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const plan = await Plan.findById(req.params.id).lean();

    if (!plan) {
      res.status(404).json({ success: false, message: 'Plan not found' });
      return;
    }

    res.status(200).json({ success: true, plan });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/saas/plans
 * Super-admin only — create a new plan.
 */
export async function createPlan(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const plan = await Plan.create(req.body);
    invalidatePricingCache();
    res.status(201).json({ success: true, plan });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/saas/plans/:id
 * Super-admin only — update a plan.
 */
export async function updatePlan(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );

    if (!plan) {
      res.status(404).json({ success: false, message: 'Plan not found' });
      return;
    }

    invalidatePricingCache();
    res.status(200).json({ success: true, plan });
  } catch (error) {
    next(error);
  }
}
