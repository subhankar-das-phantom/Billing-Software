const express = require('express');
const router = express.Router();
const {
  createCreditNote,
  getCreditNotes,
  getCreditNotesByInvoice,
  getCreditNote
} = require('../controllers/creditNoteController');
const { protect } = require('../middleware/auth');
const { mongoIdParam } = require('../middleware/validators');

// Apply protection to all routes
router.use(protect);

router.route('/')
  .get(getCreditNotes)
  .post(createCreditNote);

router.get('/invoice/:invoiceId', getCreditNotesByInvoice);
router.get('/:id', getCreditNote);

module.exports = router;
