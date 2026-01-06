const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  createManualEntry,
  getManualEntries,
  getManualEntry,
  getManualEntriesByCustomer,
  getUnpaidOpeningBalances,
  recordPaymentAgainstEntry,
  deleteManualEntry
} = require('../controllers/manualEntryController');

// All routes require authentication
router.use(protect);

// Main routes
router.route('/')
  .get(getManualEntries)
  .post(createManualEntry);

// Customer-specific routes (must be before /:id to avoid conflicts)
router.get('/customer/:customerId', getManualEntriesByCustomer);
router.get('/customer/:customerId/unpaid', getUnpaidOpeningBalances);

// Single entry routes
router.route('/:id')
  .get(getManualEntry)
  .delete(adminOnly, deleteManualEntry);

// Record payment against an entry
router.post('/:id/payment', recordPaymentAgainstEntry);

module.exports = router;
