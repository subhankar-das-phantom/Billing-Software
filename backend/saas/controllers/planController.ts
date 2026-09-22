/**
 * Plan Controller — public plan listing + super-admin CRUD.
 */

import type { Response, NextFunction } from 'express';
import type { SaaSRequest } from '../types';
import Plan from '../models/Plan';
import { getAvailablePlans, invalidatePricingCache } from '../services/pricingService';
import { getDefaultTrialDays } from '../services/settingsService';

// ─── Telemetry Cache ─────────────────────────────────────────────
interface ShowcaseTelemetry {
  productsCount: number;
  batchesCount: number;
  firmName: string;
}

let cachedTelemetry: ShowcaseTelemetry | null = null;
let telemetryExpiresAt = 0;
const TELEMETRY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getShowcaseTelemetry(): Promise<ShowcaseTelemetry> {
  const now = Date.now();
  if (cachedTelemetry && now < telemetryExpiresAt) {
    return cachedTelemetry;
  }

  try {
    const Admin = require('../../models/Admin');
    const Product = require('../../models/Product');
    const Batch = require('../../models/Batch').default || require('../../models/Batch');

    const showcaseTenantId = process.env.SHOWCASE_TENANT_ID?.trim();
    const showcaseEmail = (process.env.SHOWCASE_ADMIN_EMAIL || 'admin@sys.com').toLowerCase().trim();

    let admin = null;
    if (showcaseTenantId) {
      admin = await Admin.findById(showcaseTenantId).lean();
    }
    if (!admin && showcaseEmail) {
      admin = await Admin.findOne({ email: showcaseEmail }).lean();
    }

    if (admin) {
      const [productsCount, batchesCount] = await Promise.all([
        Product.countDocuments({ tenantId: admin._id }),
        Batch.countDocuments({ tenantId: admin._id }),
      ]);

      cachedTelemetry = {
        productsCount: productsCount || 50,
        batchesCount: batchesCount || 112,
        firmName: admin.firmName || 'Bharat Healthcare & Distributors',
      };
      telemetryExpiresAt = now + TELEMETRY_CACHE_TTL_MS;
      return cachedTelemetry;
    }
  } catch (_err) {
    // Non-blocking fallback
  }

  return {
    productsCount: 50,
    batchesCount: 112,
    firmName: 'Bharat Healthcare & Distributors',
  };
}

/**
 * GET /api/saas/plans
 * Public — returns all active plans with pricing for all durations, trial days, starting price, and live platform telemetry.
 */
export async function getPlans(
  _req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const plans = await getAvailablePlans();
    const trialDays = await getDefaultTrialDays();
    const minStartingPrice =
      plans.length > 0
        ? Math.min(...plans.map((p) => p.baseMonthlyPrice))
        : 299;
    const telemetry = await getShowcaseTelemetry();

    res.status(200).json({
      success: true,
      plans,
      trialDays,
      minStartingPrice,
      telemetry,
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
