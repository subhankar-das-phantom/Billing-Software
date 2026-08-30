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

// Using require for CJS modules to avoid TS interop issues
const { protect, requirePermission } = require('../middleware/auth');
const { mongoIdParam } = require('../middleware/validators');

// Protect all routes
router.use(protect);

router.route('/')
  .get(requirePermission('purchases', 'view'), getPurchases)
  .post(requirePermission('purchases', 'create'), createPurchase);

router.get('/stats', requirePermission('purchases', 'view'), getPurchaseStats);

router.route('/:id')
  .get(requirePermission('purchases', 'view'), mongoIdParam, getPurchase)
  .put(requirePermission('purchases', 'edit'), mongoIdParam, updatePurchase)
  .delete(requirePermission('purchases', 'delete'), mongoIdParam, deletePurchase);

router.post('/:id/complete', requirePermission('purchases', 'edit'), mongoIdParam, completePurchase);
router.post('/:id/cancel', requirePermission('purchases', 'cancel'), mongoIdParam, cancelPurchaseController);

export = router;
