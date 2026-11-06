/**
 * Bharat Enterprise Billing System — Platform Support Session Routes
 * Guarded routes for initiating, terminating, querying active, and auditing support sessions.
 */

import { Router } from 'express';
import {
  startSession,
  endSession,
  revokeSession,
  getActiveSession,
  listSessions,
} from '../controllers/platformSupportController';
import { authenticatePlatform } from '../middleware/platformAuthMiddleware';
import { requirePlatformPermission } from '../middleware/platformRbacMiddleware';
import { PlatformPermission } from '../types';

const router = Router();

// Protect all support endpoints with platform authentication
router.use(authenticatePlatform);

// Query active session for calling operator
router.get(
  '/active',
  requirePlatformPermission(PlatformPermission.SUPPORT_START),
  getActiveSession
);

// List historical support sessions
router.get(
  '/',
  requirePlatformPermission(PlatformPermission.SUPPORT_START),
  listSessions
);

// Start a new diagnostic support session
router.post(
  '/',
  requirePlatformPermission(PlatformPermission.SUPPORT_START),
  startSession
);
router.post(
  '/start',
  requirePlatformPermission(PlatformPermission.SUPPORT_START),
  startSession
);

// End an active diagnostic support session (supports /:id/end and /sessions/:id/end alias)
router.post(
  '/:id/end',
  requirePlatformPermission(PlatformPermission.SUPPORT_END),
  endSession
);
router.post(
  '/sessions/:id/end',
  requirePlatformPermission(PlatformPermission.SUPPORT_END),
  endSession
);

// Revoke an active diagnostic support session with zero-window tolerance
router.post(
  '/:id/revoke',
  requirePlatformPermission(PlatformPermission.SUPPORT_END),
  revokeSession
);
router.post(
  '/sessions/:id/revoke',
  requirePlatformPermission(PlatformPermission.SUPPORT_END),
  revokeSession
);

export default router;
