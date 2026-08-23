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
const { protect } = require('../middleware/auth');
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
  .get(getNotes)
  .post(checkWriteAccess, createNoteValidator, createNote);

router.route('/:id')
  .get(mongoIdParam, getNote)
  .put(checkWriteAccess, updateNoteValidator, updateNote)
  .delete(checkWriteAccess, mongoIdParam, deleteNote);

router.patch('/:id/pin', checkWriteAccess, mongoIdParam, togglePin);

module.exports = router;
