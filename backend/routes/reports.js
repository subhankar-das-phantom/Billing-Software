const express = require('express');
const router = express.Router();
const {
  getOutstandingReport,
  getAgeingReport,
  getCreditStats,
  getRecentPayments
} = require('../controllers/reportsController');
const { getGstReport } = require('../controllers/gstReportController');
const { protect, requirePermission } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Credit reports
router.get('/outstanding', requirePermission('reports', 'view'), getOutstandingReport);
router.get('/ageing', requirePermission('reports', 'view'), getAgeingReport);
router.get('/credit-stats', requirePermission('reports', 'view'), getCreditStats);
router.get('/recent-payments', requirePermission('reports', 'view'), getRecentPayments);

// GST report
router.get('/gst', requirePermission('reports', 'view'), getGstReport);

module.exports = router;
