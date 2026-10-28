const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { 
  createManualEntryValidator, 
  updateManualEntryValidator, 
  mongoIdParam, 
  validateMongoIdParam 
} = require('../middleware/validators');
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');
const {
  createManualEntry,
  getManualEntries,
  getManualEntry,
  getManualEntriesByCustomer,
  getUnpaidOpeningBalances,
  recordPaymentAgainstEntry,
  updateManualEntry,
  deleteManualEntry
} = require('../controllers/manualEntryController');

// All routes require authentication
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.MANUAL_ENTRIES));

// Main routes
router.route('/')
  .get(getManualEntries)
  .post(checkWriteAccess, createManualEntryValidator, createManualEntry);

// Customer-specific routes (must be before /:id to avoid conflicts)
router.get('/customer/:customerId', validateMongoIdParam('customerId'), getManualEntriesByCustomer);
router.get('/customer/:customerId/unpaid', validateMongoIdParam('customerId'), getUnpaidOpeningBalances);

// Single entry routes
router.route('/:id')
  .get(mongoIdParam, getManualEntry)
  .put(adminOnly, checkWriteAccess, updateManualEntryValidator, updateManualEntry)
  .delete(adminOnly, checkWriteAccess, mongoIdParam, deleteManualEntry);

// Record payment against an entry
router.post('/:id/payment', checkWriteAccess, mongoIdParam, recordPaymentAgainstEntry);

module.exports = router;
