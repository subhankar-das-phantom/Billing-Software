import express from 'express';
import { getStockMovements } from '../controllers/stockMovementController';
// We use require since middleware/auth.js is in standard JS
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('inventory', 'view'), getStockMovements);

export = router;
