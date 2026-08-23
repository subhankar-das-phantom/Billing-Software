const express = require('express');
const router = express.Router();
const {
  getActivityLog,
  getEmployeeAnalytics,
  getEmployeeDetails,
  getEmployeeSessions,
  getEmployeeComparison,
  getSessionSummary
} = require('../controllers/employeeAnalyticsController');
const { protect, adminOnly } = require('../middleware/auth');

// All routes require authentication AND admin privileges
router.use(protect);
router.use(adminOnly);

// Activity log route (detailed session tracking)
router.get('/activity-log', getActivityLog);

// Employee analytics routes
router.get('/employees', getEmployeeAnalytics);
router.get('/employees/comparison', getEmployeeComparison);
router.get('/employees/:id', getEmployeeDetails);
router.get('/employees/:id/sessions', getEmployeeSessions);

// Session analytics routes
router.get('/sessions/summary', getSessionSummary);

module.exports = router;
