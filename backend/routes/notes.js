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

// Apply protection to all routes
router.use(protect);

router.route('/')
  .get(getNotes)
  .post(createNoteValidator, createNote);

router.route('/:id')
  .get(mongoIdParam, getNote)
  .put(updateNoteValidator, updateNote)
  .delete(mongoIdParam, deleteNote);

router.patch('/:id/pin', mongoIdParam, togglePin);

module.exports = router;
