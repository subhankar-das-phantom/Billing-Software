import express from 'express';
import {
  getPurchaseSummary,
  getSupplierWisePurchases,
  getProductWisePurchases,
  getInventoryFlowSummary
} from '../controllers/purchaseReportController';

const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(requirePermission('reports', 'view'));

router.get('/summary', getPurchaseSummary);
router.get('/supplier-wise', getSupplierWisePurchases);
router.get('/product-wise', getProductWisePurchases);
router.get('/inventory-flow', getInventoryFlowSummary);

export = router;
