import express from 'express';
const router = express.Router();
import {
  createPurchase,
  getPurchases,
  getPurchase,
  getPurchaseStats,
  updatePurchase,
  deletePurchase
} from '../controllers/purchaseController';
import { completePurchase } from '../controllers/purchaseCompletionController';
import { cancelPurchaseController } from '../controllers/purchaseCancellationController';
import { exportPurchases } from '../controllers/purchaseExportController';

// Using require for CJS modules to avoid TS interop issues
const { protect, requirePermission } = require('../middleware/auth');
const { mongoIdParam } = require('../middleware/validators');
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// Protect all routes with Auth, Tenant, SaaS Subscription, and Feature Entitlement
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.PURCHASES));

router.route('/')
  .get(requirePermission('purchases', 'view'), getPurchases)
  .post(checkWriteAccess, requirePermission('purchases', 'create'), createPurchase);

router.get('/stats', requirePermission('purchases', 'view'), getPurchaseStats);
router.get('/export', requirePermission('purchases', 'view'), exportPurchases);

router.route('/:id')
  .get(requirePermission('purchases', 'view'), mongoIdParam, getPurchase)
  .put(checkWriteAccess, requirePermission('purchases', 'edit'), mongoIdParam, updatePurchase)
  .delete(checkWriteAccess, requirePermission('purchases', 'delete'), mongoIdParam, deletePurchase);

router.post('/:id/complete', checkWriteAccess, requirePermission('purchases', 'edit'), mongoIdParam, completePurchase);
router.post('/:id/cancel', checkWriteAccess, requirePermission('purchases', 'cancel'), mongoIdParam, cancelPurchaseController);

export = router;
