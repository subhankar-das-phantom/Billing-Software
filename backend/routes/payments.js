const express = require('express');
const router = express.Router();
const {
  getCollections,
  createPayment,
  getPayments,
  getPayment,
  getPaymentsByCustomer,
  getPaymentsByInvoice,
  updatePayment,
  deletePayment
} = require('../controllers/paymentController');
const { protect, requirePermission } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Collections route (must be before /:id to avoid param collision)
router.get('/collections', requirePermission('payments', 'view'), getCollections);

// Payment routes
router.route('/')
  .get(requirePermission('payments', 'view'), getPayments)
  .post(requirePermission('payments', 'create'), createPayment);

router.route('/:id')
  .get(requirePermission('payments', 'view'), getPayment)
  .put(requirePermission('payments', 'edit'), updatePayment)
  .delete(requirePermission('payments', 'delete'), deletePayment);

router.get('/customer/:customerId', requirePermission('payments', 'view'), getPaymentsByCustomer);
router.get('/invoice/:invoiceId', requirePermission('payments', 'view'), getPaymentsByInvoice);

module.exports = router;
