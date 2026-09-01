import express from 'express';
import { getStockMovements, exportStockMovements } from '../controllers/stockMovementController';
// We use require since middleware/auth.js is in standard JS
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/export', requirePermission('inventory', 'view'), exportStockMovements);
router.get('/', requirePermission('inventory', 'view'), getStockMovements);

export = router;
