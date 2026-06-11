const express = require('express');
const router = express.Router();
const {
  createCreditNote,
  getCreditNotes,
  getCreditNotesByInvoice,
  getCreditNotesByCustomer,
  getCreditNote
} = require('../controllers/creditNoteController');
const { protect } = require('../middleware/auth');
const { mongoIdParam } = require('../middleware/validators');
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// Apply protection and subscription check to all routes
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.CREDIT_NOTES));

router.route('/')
  .get(getCreditNotes)
  .post(checkWriteAccess, createCreditNote);

router.get('/invoice/:invoiceId', getCreditNotesByInvoice);
router.get('/customer/:customerId', getCreditNotesByCustomer);
router.get('/:id', getCreditNote);

module.exports = router;
