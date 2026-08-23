const express = require('express');
const router = express.Router();
const {
  getOutstandingReport,
  getAgeingReport,
  getCreditStats,
  getRecentPayments
} = require('../controllers/reportsController');
const { getGstReport } = require('../controllers/gstReportController');
const { protect } = require('../middleware/auth');
const { checkSubscription, checkFeatureAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// All routes require authentication
router.use(protect);
router.use(checkSubscription);

// Credit reports
router.get('/outstanding', checkFeatureAccess(Feature.OUTSTANDING_TRACKING), getOutstandingReport);
router.get('/ageing', checkFeatureAccess(Feature.OUTSTANDING_TRACKING), getAgeingReport);
router.get('/credit-stats', checkFeatureAccess(Feature.OUTSTANDING_TRACKING), getCreditStats);
router.get('/recent-payments', checkFeatureAccess(Feature.OUTSTANDING_TRACKING), getRecentPayments);

// GST report
router.get('/gst', checkFeatureAccess(Feature.GST_REPORTS), getGstReport);

module.exports = router;
