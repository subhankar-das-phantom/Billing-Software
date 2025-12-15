const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');
const { 
  createCustomerValidator, 
  updateCustomerValidator, 
  mongoIdParam 
} = require('../middleware/validators');

// Apply protection to all routes
router.use(protect);

router.get('/search', searchCustomers);

router.route('/')
  .get(getCustomers)
  .post(createCustomerValidator, createCustomer);

router.route('/:id')
  .get(mongoIdParam, getCustomer)
  .put(updateCustomerValidator, updateCustomer)
  .delete(mongoIdParam, deleteCustomer);

module.exports = router;
