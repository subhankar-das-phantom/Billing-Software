const express = require('express');
const router = express.Router();
const {
  createCreditNote,
  getCreditNotes,
  getCreditNotesByInvoice,
  getCreditNotesByCustomer,
  getCreditNote
} = require('../controllers/creditNoteController');
const { protect, requirePermission } = require('../middleware/auth');
const { mongoIdParam } = require('../middleware/validators');

// Apply protection to all routes
router.use(protect);

router.route('/')
  .get(requirePermission('creditNotes', 'view'), getCreditNotes)
  .post(requirePermission('creditNotes', 'create'), createCreditNote);

router.get('/invoice/:invoiceId', requirePermission('creditNotes', 'view'), getCreditNotesByInvoice);
router.get('/customer/:customerId', requirePermission('creditNotes', 'view'), getCreditNotesByCustomer);
router.get('/:id', requirePermission('creditNotes', 'view'), getCreditNote);

module.exports = router;
