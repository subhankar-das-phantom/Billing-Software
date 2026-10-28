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
const { protect, adminOnly, requirePermission } = require('../middleware/auth');
const { 
  createPaymentValidator, 
  updatePaymentValidator, 
  mongoIdParam, 
  validateMongoIdParam,
  paginationQuery
} = require('../middleware/validators');
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
  .get(requirePermission('payments', 'view'), paginationQuery, getPayments)
  .post(checkWriteAccess, requirePermission('payments', 'create'), createPaymentValidator, createPayment);

router.route('/:id')
  .get(requirePermission('payments', 'view'), mongoIdParam, getPayment)
  .put(checkWriteAccess, requirePermission('payments', 'edit'), updatePaymentValidator, updatePayment)
  .delete(checkWriteAccess, adminOnly, mongoIdParam, deletePayment);

router.get('/customer/:customerId', requirePermission('payments', 'view'), validateMongoIdParam('customerId'), getPaymentsByCustomer);
router.get('/invoice/:invoiceId', requirePermission('payments', 'view'), validateMongoIdParam('invoiceId'), getPaymentsByInvoice);

module.exports = router;
