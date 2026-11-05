/**
 * Bharat Enterprise Billing System — Platform User Routes
 * Operator lifecycle management routes guarded with granular RBAC and audit reason enforcement.
 */

import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
} from '../controllers/platformUserController';
import { requirePlatformAuth } from '../middleware/platformAuthMiddleware';
import {
  requirePlatformPermission,
  requireReason,
} from '../middleware/platformRbacMiddleware';
import { PlatformPermission } from '../permissions';

const router = Router();

// Protect all platform user routes with active platform authentication
router.use(requirePlatformAuth);

router.get('/', requirePlatformPermission(PlatformPermission.USERS_VIEW), getUsers);
router.get('/:id', requirePlatformPermission(PlatformPermission.USERS_VIEW), getUserById);
router.post(
  '/',
  requirePlatformPermission(PlatformPermission.USERS_MANAGE),
  requireReason(10),
  createUser,
);
router.put(
  '/:id',
  requirePlatformPermission(PlatformPermission.USERS_MANAGE),
  requireReason(10),
  updateUser,
);

export default router;
