const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomer,
  getCustomerLedger,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers
} = require('../controllers/customerController');
const { protect, requirePermission } = require('../middleware/auth');
const { 
  createCustomerValidator, 
  updateCustomerValidator, 
  mongoIdParam 
} = require('../middleware/validators');

// Apply protection to all routes
router.use(protect);

router.get('/search', requirePermission('customers', 'view'), searchCustomers);

router.route('/')
  .get(requirePermission('customers', 'view'), getCustomers)
  .post(requirePermission('customers', 'create'), createCustomerValidator, createCustomer);

// Ledger route (must be before /:id to avoid param collision)
router.get('/:id/ledger', requirePermission('ledger', 'view'), mongoIdParam, getCustomerLedger);

router.route('/:id')
  .get(requirePermission('customers', 'view'), mongoIdParam, getCustomer)
  .put(requirePermission('customers', 'edit'), updateCustomerValidator, updateCustomer)
  .delete(requirePermission('customers', 'delete'), mongoIdParam, deleteCustomer);

module.exports = router;
