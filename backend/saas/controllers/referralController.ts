/**
 * Referral Controller
 */

import type { Response, NextFunction } from 'express';
import type { SaaSRequest } from '../types';
import {
  getOrCreateReferralCode,
  applyReferralCode,
  getReferralStats,
} from '../services/referralService';

const getTenantId = require('../../utils/getTenantId');

/**
 * GET /api/saas/referral/code
 * Get or generate referral code for the current tenant.
 */
export async function getReferralCode(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const result = await getOrCreateReferralCode(tenantId.toString());

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'No active referral campaign found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/saas/referral/apply
 * Apply a referral code. Called during signup.
 *
 * Body: { referralCode }
 */
export async function applyCode(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const { referralCode } = req.body;

    if (!referralCode) {
      res.status(400).json({
        success: false,
        message: 'Referral code is required',
      });
      return;
    }

    const result = await applyReferralCode(tenantId.toString(), referralCode);

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/saas/referral/stats
 * Get referral statistics for the current tenant.
 */
export async function getStats(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const stats = await getReferralStats(tenantId.toString());

    res.status(200).json({
      success: true,
      ...stats,
    });
  } catch (error) {
    next(error);
  }
}
