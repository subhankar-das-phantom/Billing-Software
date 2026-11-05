/**
 * Bharat Enterprise Billing System — Platform Plan Routes
 * SaaS pricing tier and feature entitlement administration endpoints.
 */

import { Router } from 'express';
import {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
} from '../controllers/platformPlanController';
import { authenticatePlatform } from '../middleware/platformAuthMiddleware';
import {
  requirePlatformPermission,
  requireReason,
} from '../middleware/platformRbacMiddleware';
import { PlatformPermission } from '../permissions';

const router = Router();

// Protect all plan administration endpoints with platform authentication
router.use(authenticatePlatform);

router.get(
  '/',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_VIEW),
  listPlans,
);

router.get(
  '/:id',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_VIEW),
  getPlanById,
);

router.post(
  '/',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  createPlan,
);

router.put(
  '/:id',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  updatePlan,
);

export default router;
