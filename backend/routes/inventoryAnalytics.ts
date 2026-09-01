import express from 'express';
import {
  getBatchExpiryIntelligence,
  getProductVelocity,
  getStockRiskIndicators,
  getSupplierProcurementActivity
} from '../controllers/inventoryAnalyticsController';

const { protect, requirePermission } = require('../middleware/auth');
const { checkSubscription, checkFeatureAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

const router = express.Router();

// Protected by Auth -> Subscription -> Feature (Professional) -> RBAC
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.INVENTORY_INTELLIGENCE));
router.use(requirePermission('reports', 'view'));

router.get('/expiry-horizon', getBatchExpiryIntelligence);
router.get('/velocity', getProductVelocity);
router.get('/stock-risk', getStockRiskIndicators);
router.get('/procurement', getSupplierProcurementActivity);

export = router;
