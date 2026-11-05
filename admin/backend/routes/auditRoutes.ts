/**
 * Bharat Enterprise Billing System — Platform Audit Routes
 * Cryptographically verified partitioned audit trail routes guarded by RBAC permissions.
 */

import { Router } from 'express';
import { getAuditLogs, verifyAuditScope } from '../controllers/platformAuditController';
import { requirePlatformAuth } from '../middleware/platformAuthMiddleware';
import { requirePlatformPermission } from '../middleware/platformRbacMiddleware';
import { PlatformPermission } from '../permissions';

const router = Router();

// Protect all audit trail endpoints with platform session authentication
router.use(requirePlatformAuth);

router.get('/', requirePlatformPermission(PlatformPermission.AUDIT_VIEW), getAuditLogs);
router.get('/verify', requirePlatformPermission(PlatformPermission.AUDIT_VIEW), verifyAuditScope);

export default router;
