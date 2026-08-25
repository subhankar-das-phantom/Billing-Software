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
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// Apply protection and subscription check to all routes
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.CREDIT_NOTES));

router.route('/')
  .get(requirePermission('creditNotes', 'view'), getCreditNotes)
  .post(checkWriteAccess, requirePermission('creditNotes', 'create'), createCreditNote);

router.get('/invoice/:invoiceId', requirePermission('creditNotes', 'view'), getCreditNotesByInvoice);
router.get('/customer/:customerId', requirePermission('creditNotes', 'view'), getCreditNotesByCustomer);
router.get('/:id', requirePermission('creditNotes', 'view'), getCreditNote);

module.exports = router;
