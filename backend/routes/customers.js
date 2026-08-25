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
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// Apply protection and subscription check to all routes
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.CUSTOMERS));

router.get('/search', requirePermission('customers', 'view'), searchCustomers);

router.route('/')
  .get(requirePermission('customers', 'view'), getCustomers)
  .post(checkWriteAccess, requirePermission('customers', 'create'), createCustomerValidator, createCustomer);

// Ledger route (must be before /:id to avoid param collision)
router.get('/:id/ledger', requirePermission('ledger', 'view'), mongoIdParam, getCustomerLedger);

router.route('/:id')
  .get(requirePermission('customers', 'view'), mongoIdParam, getCustomer)
  .put(checkWriteAccess, requirePermission('customers', 'edit'), updateCustomerValidator, updateCustomer)
  .delete(checkWriteAccess, requirePermission('customers', 'delete'), mongoIdParam, deleteCustomer);

module.exports = router;
