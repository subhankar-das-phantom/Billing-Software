/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * Target Tenant Resolution Middleware
 *
 * Validates the tenantId route parameter, verifies tenant existence in the DB,
 * and attaches targetTenant & targetTenantId to the request context.
 */

import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Admin from '../../../backend/models/Admin';
import type { PlatformRequest } from '../types';

const OBJECT_ID_HEX_REGEX = /^[0-9a-fA-F]{24}$/;

export async function resolveTargetTenant(
  req: PlatformRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { tenantId } = req.params;

  if (!tenantId || typeof tenantId !== 'string' || !OBJECT_ID_HEX_REGEX.test(tenantId) || !mongoose.isValidObjectId(tenantId)) {
    res.status(400).json({
      success: false,
      message: 'Invalid tenantId parameter',
    });
    return;
  }

  try {
    const tenant = await Admin.findById(tenantId).select('-password').lean();

    if (!tenant) {
      res.status(404).json({
        success: false,
        message: 'Target tenant does not exist',
      });
      return;
    }

    req.targetTenant = tenant as unknown as Record<string, unknown>;
    req.targetTenantId = tenant._id;
    next();
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to resolve target tenant',
      error: err.message,
    });
  }
}

export default resolveTargetTenant;
