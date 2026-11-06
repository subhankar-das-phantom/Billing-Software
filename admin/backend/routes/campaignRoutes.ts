/**
 * Bharat Enterprise Billing System — Platform Campaign Routes
 * Protected platform endpoints for promotional campaigns, broadcast notifications, and offer management.
 */

import { Router } from 'express';
import {
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  broadcastCampaign,
} from '../controllers/platformCampaignController';
import { authenticatePlatform } from '../middleware/platformAuthMiddleware';
import {
  requirePlatformPermission,
  requireReason,
} from '../middleware/platformRbacMiddleware';
import { PlatformPermission } from '../permissions';

const router = Router();

// Protect all campaign routes with platform operator authentication
router.use(authenticatePlatform);

router.get(
  '/',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_VIEW),
  listCampaigns,
);

router.get(
  '/:id',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_VIEW),
  getCampaignById,
);

router.post(
  '/',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  createCampaign,
);

router.put(
  '/:id',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  updateCampaign,
);

router.delete(
  '/:id',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  deleteCampaign,
);

router.post(
  '/:id/broadcast',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  broadcastCampaign,
);

export default router;
