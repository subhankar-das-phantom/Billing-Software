const express = require('express');
const router = express.Router();
const {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  togglePin
} = require('../controllers/noteController');
const { protect, requirePermission } = require('../middleware/auth');
const { 
  createNoteValidator, 
  updateNoteValidator, 
  mongoIdParam 
} = require('../middleware/validators');
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// Apply protection and subscription check to all routes
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.NOTES));

router.route('/')
  .get(requirePermission('notes', 'view'), getNotes)
  .post(checkWriteAccess, requirePermission('notes', 'create'), createNoteValidator, createNote);

router.route('/:id')
  .get(requirePermission('notes', 'view'), mongoIdParam, getNote)
  .put(checkWriteAccess, requirePermission('notes', 'edit'), updateNoteValidator, updateNote)
  .delete(checkWriteAccess, requirePermission('notes', 'delete'), mongoIdParam, deleteNote);

router.patch('/:id/pin', checkWriteAccess, requirePermission('notes', 'edit'), mongoIdParam, togglePin);

module.exports = router;
