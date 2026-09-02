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
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// All routes require authentication
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.PAYMENTS));

// Collections route (must be before /:id to avoid param collision)
router.get('/collections', requirePermission('payments', 'view'), getCollections);

// Payment routes
router.route('/')
  .get(requirePermission('payments', 'view'), getPayments)
  .post(checkWriteAccess, requirePermission('payments', 'create'), createPayment);

router.route('/:id')
  .get(requirePermission('payments', 'view'), getPayment)
  .put(checkWriteAccess, requirePermission('payments', 'edit'), updatePayment)
  .delete(checkWriteAccess, requirePermission('payments', 'delete'), deletePayment);

router.get('/customer/:customerId', requirePermission('payments', 'view'), getPaymentsByCustomer);
router.get('/invoice/:invoiceId', requirePermission('payments', 'view'), getPaymentsByInvoice);

module.exports = router;
