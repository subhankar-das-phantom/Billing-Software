const express = require('express');
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  getCustomerInvoices,
  updateInvoiceStatus,
  exportInvoices
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');
const { 
  createInvoiceValidator, 
  updateInvoiceStatusValidator,
  mongoIdParam 
} = require('../middleware/validators');

// Apply protection to all routes
router.use(protect);

// Export route (before :id route to avoid conflicts)
router.get('/export', exportInvoices);

router.route('/')
  .get(getInvoices)
  .post(createInvoiceValidator, createInvoice);

router.get('/customer/:customerId', getCustomerInvoices);

router.route('/:id')
  .get(mongoIdParam, getInvoice)
  .put(mongoIdParam, updateInvoice);

router.put('/:id/status', updateInvoiceStatusValidator, updateInvoiceStatus);

module.exports = router;

