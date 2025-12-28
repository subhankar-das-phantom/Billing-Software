const express = require('express');
const router = express.Router();
const {
  createPayment,
  getPayments,
  getPayment,
  getPaymentsByCustomer,
  getPaymentsByInvoice,
  deletePayment
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Payment routes
router.route('/')
  .get(getPayments)
  .post(createPayment);

router.route('/:id')
  .get(getPayment)
  .delete(deletePayment);

router.get('/customer/:customerId', getPaymentsByCustomer);
router.get('/invoice/:invoiceId', getPaymentsByInvoice);

module.exports = router;
