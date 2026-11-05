/**
 * Bharat Enterprise Billing System — Platform Feature Override Controller
 * Manages fine-grained feature overrides, commercial gating exceptions,
 * and high-severity emergency bypass grants.
 */

import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import TenantFeatureOverride, { EMERGENCY_BYPASS_FEATURE } from '../models/TenantFeatureOverride';
import {
  upsertFeatureOverride,
  deactivateFeatureOverride,
  grantEmergencyBypass as grantEmergencyBypassService,
  revokeEmergencyBypass as revokeEmergencyBypassService,
  resolveEffectiveFeatures,
} from '../services/featureOverrideService';
import { PlatformRequest, OverrideType, PlatformPermission } from '../types';
import { hasPermission } from '../permissions';
import { Feature } from '../../../backend/saas/shared/features';

/**
 * GET /api/platform/feature-overrides
 * GET /api/platform/feature-overrides/tenant/:tenantId
 * List all feature overrides for a specific tenant and compute real-time effective entitlements.
 */
export async function getTenantOverrides(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = String(req.params.tenantId || req.query.tenantId || '').trim();
    const filter: Record<string, unknown> = {};

    if (tenantId) {
      if (!Types.ObjectId.isValid(tenantId)) {
        res.status(400).json({
          success: false,
          message: 'A valid tenant ID is required to retrieve feature overrides',
        });
        return;
      }
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    const overrides = await TenantFeatureOverride.find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'email fullName role')
      .lean();

    const effectiveAccess = tenantId ? await resolveEffectiveFeatures(tenantId) : null;

    res.status(200).json({
      success: true,
      data: {
        overrides,
        effectiveAccess,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/feature-overrides
 * Upsert an active feature override (ALLOW or DENY).
 */
export async function createOverride(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, feature, type, reason, expiresAt } = req.body;
    const operator = req.platformUser;

    if (!operator) {
      res.status(401).json({ success: false, message: 'Platform operator identity required' });
      return;
    }

    if (!tenantId || !Types.ObjectId.isValid(tenantId)) {
      res.status(400).json({ success: false, message: 'Valid tenant ID is required' });
      return;
    }

    const validFeatures = [...Object.values(Feature), EMERGENCY_BYPASS_FEATURE];
    if (!feature || !validFeatures.includes(feature)) {
      res.status(400).json({
        success: false,
        message: `Invalid feature identifier "${feature}". Must be one of: ${validFeatures.join(', ')}`,
      });
      return;
    }

    if (
      feature === EMERGENCY_BYPASS_FEATURE &&
      !hasPermission(operator.role, operator.customPermissions, PlatformPermission.EMERGENCY_BYPASS_MANAGE)
    ) {
      res.status(403).json({
        success: false,
        message: 'Configuring emergency commercial bypass requires the EMERGENCY_BYPASS_MANAGE privilege.',
      });
      return;
    }

    if (type !== OverrideType.ALLOW && type !== OverrideType.DENY) {
      res.status(400).json({
        success: false,
        message: 'Override type must be either "ALLOW" or "DENY"',
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

    let parsedExpiry: Date | null = null;
    if (expiresAt) {
      parsedExpiry = new Date(expiresAt);
      if (isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
        res.status(400).json({
          success: false,
          message: 'Expiry date must be a valid future ISO timestamp',
        });
        return;
      }
    }

    const override = await upsertFeatureOverride(
      tenantId,
      feature,
      type,
      reason.trim(),
      operator._id,
      parsedExpiry,
    );

    res.status(201).json({
      success: true,
      message: 'Feature override applied successfully',
      data: override,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/platform/feature-overrides/:id
 * Deactivates an active feature override.
 */
export async function deleteOverride(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    const { reason } = req.body;
    const operator = req.platformUser;

    if (!operator) {
      res.status(401).json({ success: false, message: 'Platform operator identity required' });
      return;
    }

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Valid override ID is required' });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'A valid operational reason (minimum 10 characters) is required to deactivate an override',
      });
      return;
    }

    const deactivated = await deactivateFeatureOverride(id, reason.trim(), operator._id);

    res.status(200).json({
      success: true,
      message: 'Feature override deactivated successfully',
      data: deactivated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/feature-overrides/emergency-bypass
 * Grants an emergency commercial bypass for up to 72 hours.
 */
export async function grantEmergencyBypass(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, reason, durationHours = 12 } = req.body;
    const operator = req.platformUser;

    if (!operator) {
      res.status(401).json({ success: false, message: 'Platform operator identity required' });
      return;
    }

    if (!tenantId || !Types.ObjectId.isValid(tenantId)) {
      res.status(400).json({ success: false, message: 'Valid tenant ID is required' });
      return;
    }

    const hours = Number(durationHours);
    if (isNaN(hours) || hours <= 0 || hours > 72) {
      res.status(400).json({
        success: false,
        message: 'Emergency bypass duration must be between 1 and 72 hours',
      });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'A valid operational reason (minimum 10 characters) is required to grant an emergency bypass',
      });
      return;
    }

    const bypass = await grantEmergencyBypassService(
      tenantId,
      reason.trim(),
      operator._id,
      hours,
    );

    res.status(201).json({
      success: true,
      message: `Emergency commercial bypass granted for ${hours} hours`,
      data: bypass,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/platform/feature-overrides/emergency-bypass/revoke
 * Immediately revokes active emergency bypass for a tenant.
 */
export async function revokeEmergencyBypass(
  req: PlatformRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { tenantId, reason } = req.body;
    const operator = req.platformUser;

    if (!operator) {
      res.status(401).json({ success: false, message: 'Platform operator identity required' });
      return;
    }

    if (!tenantId || !Types.ObjectId.isValid(tenantId)) {
      res.status(400).json({ success: false, message: 'Valid tenant ID is required' });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'A valid operational reason (minimum 10 characters) is required to revoke emergency bypass',
      });
      return;
    }

    await revokeEmergencyBypassService(tenantId, reason.trim(), operator._id);

    res.status(200).json({
      success: true,
      message: 'Emergency commercial bypass revoked successfully',
    });
  } catch (error) {
    next(error);
  }
}
