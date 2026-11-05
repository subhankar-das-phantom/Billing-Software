/**
 * Bharat Enterprise Billing System — Platform Dashboard Routes
 * High-performance parallel aggregation endpoints for control plane KPIs.
 */

import { Router } from 'express';
import { getOverview } from '../controllers/platformDashboardController';
import { authenticatePlatform } from '../middleware/platformAuthMiddleware';
import { requirePlatformPermission } from '../middleware/platformRbacMiddleware';
import { PlatformPermission } from '../types';

const router = Router();

// Protect all dashboard endpoints with platform authentication
router.use(authenticatePlatform);

// Aggregated KPI overview metrics
router.get(
  '/overview',
  requirePlatformPermission(PlatformPermission.DASHBOARD_VIEW),
  getOverview
);
router.get(
  '/',
  requirePlatformPermission(PlatformPermission.DASHBOARD_VIEW),
  getOverview
);

export default router;
