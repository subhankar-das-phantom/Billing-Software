import express from 'express';
import {
  getSubscription,
  checkout,
  verifyPayment,
  getHistory,
  getBankDetails,
  submitManualRequest,
  getTenantManualRequests,
  getPendingRequest,
  getTenantInvoices,
  getTenantInvoiceById,
  getTaxInvoices,
  getTaxInvoiceById,
} from '../controllers/subscriptionController';

const { protect, adminOnly } = require('../../middleware/auth');

const router = express.Router();

// All subscription routes require auth
router.use(protect);

router.get('/', getSubscription);
router.get('/bank-details', getBankDetails);
router.post('/checkout', adminOnly, checkout);
router.post('/verify', adminOnly, verifyPayment);
router.get('/history', adminOnly, getHistory);

// Manual offline payment request & queue lookup
router.post('/manual-request', adminOnly, submitManualRequest);
router.get('/manual-requests', adminOnly, getTenantManualRequests);
router.get('/pending-request', adminOnly, getPendingRequest);

// Statutory B2B GST Tax Invoices
router.get('/invoices', adminOnly, getTenantInvoices);
router.get('/invoices/:id', adminOnly, getTenantInvoiceById);

export default router;
