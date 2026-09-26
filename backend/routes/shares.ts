import express from 'express';
import { shareController } from '../controllers/shareController';

const router = express.Router();
const { protect, requirePermission } = require('../middleware/auth');
const { checkSubscription } = require('../saas/middleware');

// Apply protection and subscription checks
router.use(protect);
router.use(checkSubscription);

// Create or reuse share link
router.post('/', requirePermission('invoices', 'view'), shareController.createOrGetShare);

// Revoke an active share link
router.post('/:id/revoke', requirePermission('invoices', 'view'), shareController.revokeShare);

export default router;
module.exports = router;
