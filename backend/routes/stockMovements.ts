import express from 'express';
import { getStockMovements, exportStockMovements } from '../controllers/stockMovementController';
const { protect, requirePermission } = require('../middleware/auth');
const { checkSubscription, checkFeatureAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

const router = express.Router();

router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.INVENTORY_LEDGER));

router.get('/export', requirePermission('ledger', 'view', 'inventory'), exportStockMovements);
router.get('/', requirePermission('ledger', 'view', 'inventory'), getStockMovements);

export = router;
