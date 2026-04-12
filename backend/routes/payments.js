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

// All routes require authentication
router.use(protect);

// Collections route (must be before /:id to avoid param collision)
router.get('/collections', getCollections);

// Payment routes
router.route('/')
  .get(getPayments)
  .post(createPayment);

router.route('/:id')
  .get(getPayment)
  .put(updatePayment)
  .delete(deletePayment);

router.get('/customer/:customerId', getPaymentsByCustomer);
router.get('/invoice/:invoiceId', getPaymentsByInvoice);

module.exports = router;
