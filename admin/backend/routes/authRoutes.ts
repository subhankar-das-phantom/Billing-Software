/**
 * Bharat Enterprise Billing System — Platform Auth Routes
 * Express router mapping for Super Admin Control Plane authentication.
 */

import { Router } from 'express';
import * as platformAuthController from '../controllers/platformAuthController';
import { requirePlatformAuth, authenticatePlatform } from '../middleware/platformAuthMiddleware';

const router = Router();

// Public auth endpoints
router.post('/login', platformAuthController.login);
router.post('/mfa/verify', platformAuthController.verifyMfa);
router.post('/logout', authenticatePlatform, platformAuthController.logout);

// Protected endpoints requiring active platform session
router.use(requirePlatformAuth);

router.get('/me', platformAuthController.getMe);
router.post('/refresh', platformAuthController.refresh);
router.post('/change-password', platformAuthController.changePassword);
router.post('/mfa/setup', platformAuthController.setupMfa);
router.post('/mfa/enable', platformAuthController.enableMfa);

export default router;
