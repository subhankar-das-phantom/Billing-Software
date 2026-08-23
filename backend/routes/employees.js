const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  resetPassword,
  toggleStatus,
  deleteEmployee
} = require('../controllers/employeeController');
const { protect, adminOnly } = require('../middleware/auth');

// All routes require authentication AND admin privileges
router.use(protect);
router.use(adminOnly);

// Employee CRUD routes
router.route('/')
  .get(getEmployees)
  .post(createEmployee);

router.route('/:id')
  .get(getEmployee)
  .put(updateEmployee)
  .delete(deleteEmployee);

// Special actions
router.put('/:id/password', resetPassword);
router.put('/:id/status', toggleStatus);

module.exports = router;
