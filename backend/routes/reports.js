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

// All routes require authentication
router.use(protect);

// Credit reports
router.get('/outstanding', getOutstandingReport);
router.get('/ageing', getAgeingReport);
router.get('/credit-stats', getCreditStats);
router.get('/recent-payments', getRecentPayments);

// GST report
router.get('/gst', getGstReport);

module.exports = router;
