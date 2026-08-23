const express = require('express');
const router = express.Router();
const { getStats, getLowStock, getInvoiceCount } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { checkSubscription, checkFeatureAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// Apply protection and subscription check to all routes
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.DASHBOARD));

router.get('/stats', getStats);
router.get('/low-stock', getLowStock);
router.get('/invoice-count', getInvoiceCount);

module.exports = router;
