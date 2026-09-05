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
const { exportCollections } = require('../controllers/collectionExportController');
const { protect, requirePermission } = require('../middleware/auth');
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// All routes require authentication
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.PAYMENTS));

// Collections routes (must be before /:id to avoid param collision)
router.get('/export', requirePermission('collections', 'view', 'payments'), exportCollections);
router.get('/collections/export', requirePermission('collections', 'view', 'payments'), exportCollections);
router.get('/collections', requirePermission('collections', 'view', 'payments'), getCollections);

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
