const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
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
  .post(checkWriteAccess, createManualEntry);

// Customer-specific routes (must be before /:id to avoid conflicts)
router.get('/customer/:customerId', getManualEntriesByCustomer);
router.get('/customer/:customerId/unpaid', getUnpaidOpeningBalances);

// Single entry routes
router.route('/:id')
  .get(getManualEntry)
  .put(adminOnly, checkWriteAccess, updateManualEntry)
  .delete(adminOnly, checkWriteAccess, deleteManualEntry);

// Record payment against an entry
router.post('/:id/payment', checkWriteAccess, recordPaymentAgainstEntry);

module.exports = router;
