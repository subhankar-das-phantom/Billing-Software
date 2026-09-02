const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  resetPassword,
  toggleStatus,
  deleteEmployee,
  updatePermissions
} = require('../controllers/employeeController');
const { protect, adminOnly } = require('../middleware/auth');
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// All routes require authentication AND admin privileges
router.use(protect);
router.use(adminOnly);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.EMPLOYEES));

// Employee CRUD routes
router.route('/')
  .get(getEmployees)
  .post(checkWriteAccess, createEmployee);

router.route('/:id')
  .get(getEmployee)
  .put(checkWriteAccess, updateEmployee)
  .delete(checkWriteAccess, deleteEmployee);

// Special actions
router.put('/:id/password', checkWriteAccess, resetPassword);
router.put('/:id/status', checkWriteAccess, toggleStatus);
router.put('/:id/permissions', checkWriteAccess, updatePermissions);

module.exports = router;
