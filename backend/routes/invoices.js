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
const { protect } = require('../middleware/auth');
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
router.get('/export', exportInvoices);
router.get('/stats', getInvoiceStats);

router.route('/')
  .get(checkFeatureAccess(Feature.INVOICE_HISTORY), getInvoices)
  .post(checkFeatureAccess(Feature.INVOICE_CREATE), checkWriteAccess, createInvoiceValidator, createInvoice);

router.get('/customer/:customerId', getCustomerInvoices);

router.get('/:id/pdf', mongoIdParam, generateSingleInvoicePDF);

router.route('/:id')
  .get(mongoIdParam, getInvoice)
  .put(checkWriteAccess, mongoIdParam, updateInvoice);

router.put('/:id/status', checkWriteAccess, updateInvoiceStatusValidator, updateInvoiceStatus);

module.exports = router;

