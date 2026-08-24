const express = require('express');
const router = express.Router();
const {
  getInvoices,
  getInvoiceStats,
  getInvoice,
  createInvoice,
  updateInvoice,
  getCustomerInvoices,
  updateInvoiceStatus,
  exportInvoices,
  generateSingleInvoicePDF
} = require('../controllers/invoice');
const { protect, requirePermission } = require('../middleware/auth');
const { 
  createInvoiceValidator, 
  updateInvoiceStatusValidator,
  mongoIdParam 
} = require('../middleware/validators');

// Apply protection to all routes
router.use(protect);

// Export route (before :id route to avoid conflicts)
router.get('/export', requirePermission('invoices', 'view'), exportInvoices);
router.get('/stats', requirePermission('invoices', 'view'), getInvoiceStats);

router.route('/')
  .get(requirePermission('invoices', 'view'), getInvoices)
  .post(requirePermission('invoices', 'create'), createInvoiceValidator, createInvoice);

router.get('/customer/:customerId', requirePermission('invoices', 'view'), getCustomerInvoices);

router.get('/:id/pdf', requirePermission('invoices', 'view'), mongoIdParam, generateSingleInvoicePDF);

router.route('/:id')
  .get(requirePermission('invoices', 'view'), mongoIdParam, getInvoice)
  .put(requirePermission('invoices', 'edit'), mongoIdParam, updateInvoice);

router.put('/:id/status', requirePermission('invoices', 'cancel'), updateInvoiceStatusValidator, updateInvoiceStatus);

module.exports = router;

