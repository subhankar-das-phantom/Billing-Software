import express from 'express';
import {
  getBatchExpiryIntelligence,
  getProductVelocity,
  getStockRiskIndicators,
  getSupplierProcurementActivity
} from '../controllers/inventoryAnalyticsController';

const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Protected by Auth & Reports view permission (Admin / Permitted Employees)
router.use(protect);
router.use(requirePermission('reports', 'view'));

router.get('/expiry-horizon', getBatchExpiryIntelligence);
router.get('/velocity', getProductVelocity);
router.get('/stock-risk', getStockRiskIndicators);
router.get('/procurement', getSupplierProcurementActivity);

export = router;
