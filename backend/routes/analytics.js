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
const { checkSubscription, checkFeatureAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// All routes require authentication AND admin privileges
router.use(protect);
router.use(adminOnly);
router.use(checkSubscription);

// Activity log route (detailed session tracking)
router.get('/activity-log', checkFeatureAccess(Feature.ACTIVITY_LOGS), getActivityLog);

// Employee analytics routes
router.get('/employees', checkFeatureAccess(Feature.EMPLOYEE_ANALYTICS), getEmployeeAnalytics);
router.get('/employees/comparison', checkFeatureAccess(Feature.EMPLOYEE_ANALYTICS), getEmployeeComparison);
router.get('/employees/:id', checkFeatureAccess(Feature.EMPLOYEE_ANALYTICS), getEmployeeDetails);
router.get('/employees/:id/sessions', checkFeatureAccess(Feature.EMPLOYEE_ANALYTICS), getEmployeeSessions);

// Session analytics routes
router.get('/sessions/summary', getSessionSummary);

module.exports = router;
