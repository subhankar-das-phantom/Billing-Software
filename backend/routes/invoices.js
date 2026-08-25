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
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// Apply protection and subscription check to all routes
router.use(protect);
router.use(checkSubscription);

// Export route (before :id route to avoid conflicts)
router.get('/export', requirePermission('invoices', 'view'), exportInvoices);
router.get('/stats', requirePermission('invoices', 'view'), getInvoiceStats);

router.route('/')
  .get(requirePermission('invoices', 'view'), checkFeatureAccess(Feature.INVOICE_HISTORY), getInvoices)
  .post(checkWriteAccess, requirePermission('invoices', 'create'), checkFeatureAccess(Feature.INVOICE_CREATE), createInvoiceValidator, createInvoice);

router.get('/customer/:customerId', requirePermission('invoices', 'view'), getCustomerInvoices);

router.get('/:id/pdf', requirePermission('invoices', 'view'), mongoIdParam, generateSingleInvoicePDF);

router.route('/:id')
  .get(requirePermission('invoices', 'view'), mongoIdParam, getInvoice)
  .put(checkWriteAccess, requirePermission('invoices', 'edit'), mongoIdParam, updateInvoice);

router.put('/:id/status', checkWriteAccess, requirePermission('invoices', 'cancel'), updateInvoiceStatusValidator, updateInvoiceStatus);

module.exports = router;

