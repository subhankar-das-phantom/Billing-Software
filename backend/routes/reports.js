const express = require('express');
const router = express.Router();
const {
  getOutstandingReport,
  getAgeingReport,
  getCreditStats,
  getRecentPayments
} = require('../controllers/reportsController');
const { getGstReport } = require('../controllers/gstReportController');
const { protect, adminOnly, requirePermission } = require('../middleware/auth');
const { checkSubscription, checkFeatureAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// All routes require authentication
router.use(protect);
router.use(adminOnly);
router.use(checkSubscription);

// Credit reports
router.get('/outstanding', requirePermission('reports', 'view'), checkFeatureAccess(Feature.OUTSTANDING_TRACKING), getOutstandingReport);
router.get('/ageing', requirePermission('reports', 'view'), checkFeatureAccess(Feature.OUTSTANDING_TRACKING), getAgeingReport);
router.get('/credit-stats', requirePermission('reports', 'view'), checkFeatureAccess(Feature.OUTSTANDING_TRACKING), getCreditStats);
router.get('/recent-payments', requirePermission('reports', 'view'), checkFeatureAccess(Feature.OUTSTANDING_TRACKING), getRecentPayments);

// GST report
router.get('/gst', requirePermission('reports', 'view'), checkFeatureAccess(Feature.GST_REPORTS), getGstReport);

module.exports = router;
