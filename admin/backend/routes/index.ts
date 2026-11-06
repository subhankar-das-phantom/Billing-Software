/**
 * Bharat Enterprise Billing System — Platform Control Plane Root Router
 * Mounts all sub-routers under /api/platform with strict isolation from the business plane.
 */

import { Router } from 'express';
import authRoutes from './authRoutes';
import tenantRoutes from './tenantRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import planRoutes from './planRoutes';
import featureOverrideRoutes from './featureOverrideRoutes';
import supportRoutes from './supportRoutes';
import auditRoutes from './auditRoutes';
import userRoutes from './userRoutes';
import dashboardRoutes from './dashboardRoutes';
import { authenticatePlatform, requirePasswordChanged } from '../middleware/platformAuthMiddleware';
import { enforceSupportSessionBounds } from '../middleware/supportSessionMiddleware';

const platformRouter = Router();

// Platform Health Check (Public within control plane)
platformRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    plane: 'CONTROL_PLANE',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// 1. Authentication module (public login/verifyMfa + protected credential management)
platformRouter.use('/auth', authRoutes);

// 2. Control Plane Gate: All non-auth modules require verified session & resolved temporary password
platformRouter.use(authenticatePlatform);
platformRouter.use(requirePasswordChanged);
platformRouter.use(enforceSupportSessionBounds);

// 3. Mount platform business modules
platformRouter.use('/tenants', tenantRoutes);
platformRouter.use('/subscriptions', subscriptionRoutes);
platformRouter.use('/plans', planRoutes);
platformRouter.use('/feature-overrides', featureOverrideRoutes);
platformRouter.use('/overrides', featureOverrideRoutes); // convenience alias
platformRouter.use('/support', supportRoutes);
platformRouter.use('/audit', auditRoutes);
platformRouter.use('/users', userRoutes);
platformRouter.use('/dashboard', dashboardRoutes);

module.exports = platformRouter;
export default platformRouter;
