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
const { 
  createCreditNoteValidator, 
  mongoIdParam, 
  validateMongoIdParam 
} = require('../middleware/validators');
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// Apply protection and subscription check to all routes
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.CREDIT_NOTES));

router.route('/')
  .get(requirePermission('creditNotes', 'view'), getCreditNotes)
  .post(checkWriteAccess, requirePermission('creditNotes', 'create'), createCreditNoteValidator, createCreditNote);

router.get('/invoice/:invoiceId', requirePermission('creditNotes', 'view'), validateMongoIdParam('invoiceId'), getCreditNotesByInvoice);
router.get('/customer/:customerId', requirePermission('creditNotes', 'view'), validateMongoIdParam('customerId'), getCreditNotesByCustomer);
router.get('/:id', requirePermission('creditNotes', 'view'), mongoIdParam, getCreditNote);

module.exports = router;
