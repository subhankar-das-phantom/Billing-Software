/**
 * SaaS Routes — aggregator.
 *
 * Mounts all SaaS sub-routes under /api/saas:
 *   /api/saas/plans          — Plan listing + admin CRUD
 *   /api/saas/subscription   — Subscription management + Razorpay
 *   /api/saas/referral       — Referral codes + stats
 *   /api/saas/notifications  — In-app notifications
 *   /api/saas/admin          — Super-admin panel APIs
 */

import express from 'express';
import planRoutes from './plans';
import subscriptionRoutes from './subscription';
import referralRoutes from './referral';
import notificationRoutes from './notifications';
import adminSaasRoutes from './adminSaas';

const router = express.Router();

router.use('/plans', planRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/referral', referralRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminSaasRoutes);

module.exports = router;
export default router;
