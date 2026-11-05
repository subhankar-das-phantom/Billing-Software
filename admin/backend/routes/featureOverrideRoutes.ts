/**
 * Bharat Enterprise Billing System — Platform Feature Override Routes
 * Gated endpoints for managing per-tenant feature overrides and emergency commercial bypasses.
 */

import { Router } from 'express';
import {
  getTenantOverrides,
  createOverride,
  deleteOverride,
  grantEmergencyBypass,
  revokeEmergencyBypass,
} from '../controllers/platformFeatureOverrideController';
import { authenticatePlatform } from '../middleware/platformAuthMiddleware';
import {
  requirePlatformPermission,
  requireReason,
} from '../middleware/platformRbacMiddleware';
import { PlatformPermission } from '../permissions';

const router = Router();

// Protect all feature override routes with platform authentication
router.use(authenticatePlatform);

router.get(
  '/',
  requirePlatformPermission(PlatformPermission.FEATURE_OVERRIDES_VIEW),
  getTenantOverrides,
);

router.get(
  '/tenant/:tenantId',
  requirePlatformPermission(PlatformPermission.FEATURE_OVERRIDES_VIEW),
  getTenantOverrides,
);

router.post(
  '/',
  requirePlatformPermission(PlatformPermission.FEATURE_OVERRIDES_MANAGE),
  requireReason(10),
  createOverride,
);

router.delete(
  '/:id',
  requirePlatformPermission(PlatformPermission.FEATURE_OVERRIDES_MANAGE),
  requireReason(10),
  deleteOverride,
);

router.post(
  '/emergency-bypass',
  requirePlatformPermission(PlatformPermission.EMERGENCY_BYPASS_MANAGE),
  requireReason(10),
  grantEmergencyBypass,
);

router.post(
  '/emergency-bypass/revoke',
  requirePlatformPermission(PlatformPermission.EMERGENCY_BYPASS_MANAGE),
  requireReason(10),
  revokeEmergencyBypass,
);

export default router;
