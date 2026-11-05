/**
 * Bharat Enterprise Billing System — Platform Subscription Routes
 * Protected platform endpoints for subscription lifecycle, adjustments, and payment reconciliation.
 */

import { Router } from 'express';
import {
  listSubscriptions,
  getSubscriptionById,
  activateSubscription,
  adjustSubscription,
  toggleSubscriptionStatus,
  reconcilePayment,
} from '../controllers/platformSubscriptionController';
import { authenticatePlatform } from '../middleware/platformAuthMiddleware';
import {
  requirePlatformPermission,
  requireReason,
} from '../middleware/platformRbacMiddleware';
import { PlatformPermission } from '../permissions';

const router = Router();

// Protect all subscription management routes with platform authentication
router.use(authenticatePlatform);

router.get(
  '/',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_VIEW),
  listSubscriptions,
);

router.get(
  '/:id',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_VIEW),
  getSubscriptionById,
);

router.post(
  '/activate',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  activateSubscription,
);

router.post(
  '/adjust',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  adjustSubscription,
);

router.post(
  '/:id/adjust',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  adjustSubscription,
);

router.post(
  '/toggle-status',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  toggleSubscriptionStatus,
);

router.post(
  '/reconcile',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  reconcilePayment,
);

router.post(
  '/reconcile-payment',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  reconcilePayment,
);

export default router;
