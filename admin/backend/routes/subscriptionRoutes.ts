/**
 * Bharat Enterprise Billing System — Platform Subscription Routes
 * Protected platform endpoints for subscription lifecycle, adjustments, offline billing,
 * payment verification queue, and statutory B2B GST tax invoice issuance.
 */

import { Router } from 'express';
import {
  listSubscriptions,
  getSubscriptionById,
  activateSubscription,
  adjustSubscription,
  toggleSubscriptionStatus,
  reconcilePayment,
  updateSubscription,
  allocateSubscription,
  recordManualPayment,
  getManualPaymentRequests,
  approveManualPaymentRequest,
  rejectManualPaymentRequest,
  listPlatformInvoices,
  getPlatformInvoiceById,
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

// ─── Manual Payment Requests Queue ──────────────────────────────
router.get(
  '/manual-requests',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_VIEW),
  getManualPaymentRequests,
);

router.post(
  '/manual-requests/:id/approve',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  approveManualPaymentRequest,
);

router.post(
  '/manual-requests/:id/reject',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  rejectManualPaymentRequest,
);

// ─── Statutory B2B GST Invoices ──────────────────────────────────
router.get(
  '/invoices',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_VIEW),
  listPlatformInvoices,
);

router.get(
  '/invoices/:id',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_VIEW),
  getPlatformInvoiceById,
);

// ─── Manual Subscription Provisioning ───────────────────────────
router.post(
  '/allocate',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  allocateSubscription,
);

// ─── Subscriptions Listing & Detail ──────────────────────────────
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

router.put(
  '/:id',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  updateSubscription,
);

router.post(
  '/:id/record-payment',
  requirePlatformPermission(PlatformPermission.SUBSCRIPTIONS_MANAGE),
  requireReason(10),
  recordManualPayment,
);

// ─── Adjustments & Actions ───────────────────────────────────────
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
