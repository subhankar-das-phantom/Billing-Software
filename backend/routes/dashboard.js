const express = require('express');
const router = express.Router();
const { getStats, getLowStock, getInvoiceCount } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

// Apply protection to all routes
router.use(protect);

router.get('/stats', getStats);
router.get('/low-stock', getLowStock);
router.get('/invoice-count', getInvoiceCount);

module.exports = router;
