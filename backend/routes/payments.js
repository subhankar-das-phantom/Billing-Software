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
const { protect } = require('../middleware/auth');
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// All routes require authentication
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.PAYMENTS));

// Collections route (must be before /:id to avoid param collision)
router.get('/collections', getCollections);

// Payment routes
router.route('/')
  .get(getPayments)
  .post(checkWriteAccess, createPayment);

router.route('/:id')
  .get(getPayment)
  .put(checkWriteAccess, updatePayment)
  .delete(checkWriteAccess, deletePayment);

router.get('/customer/:customerId', getPaymentsByCustomer);
router.get('/invoice/:invoiceId', getPaymentsByInvoice);

module.exports = router;
