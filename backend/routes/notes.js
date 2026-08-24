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

// Apply protection to all routes
router.use(protect);

router.route('/')
  .get(requirePermission('notes', 'view'), getNotes)
  .post(requirePermission('notes', 'create'), createNoteValidator, createNote);

router.route('/:id')
  .get(requirePermission('notes', 'view'), mongoIdParam, getNote)
  .put(requirePermission('notes', 'edit'), updateNoteValidator, updateNote)
  .delete(requirePermission('notes', 'delete'), mongoIdParam, deleteNote);

router.patch('/:id/pin', requirePermission('notes', 'edit'), mongoIdParam, togglePin);

module.exports = router;
