import express from 'express';
import {
  getPurchaseSummary,
  getPurchaseStatusSummary,
  getSupplierWisePurchases,
  getProductWisePurchases,
  getInventoryFlowSummary
} from '../controllers/purchaseReportController';

const { protect, requirePermission } = require('../middleware/auth');
const { checkSubscription, checkFeatureAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

const router = express.Router();

router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.PURCHASE_REPORTS));
router.use(requirePermission('reports', 'view'));

router.get('/summary', getPurchaseSummary);
router.get('/status', getPurchaseStatusSummary);
router.get('/supplier-wise', getSupplierWisePurchases);
router.get('/product-wise', getProductWisePurchases);
router.get('/inventory-flow', getInventoryFlowSummary);

export = router;
