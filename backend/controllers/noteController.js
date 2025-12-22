const Note = require('../models/Note');

// @desc    Get all notes
// @route   GET /api/notes
// @access  Private
exports.getNotes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { isActive: true };

    // Search
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { content: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Filter by pinned status if requested
    if (req.query.pinned === 'true') {
      query.isPinned = true;
    }

    const notes = await Note.find(query)
      .sort({ isPinned: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Note.countDocuments(query);

    res.status(200).json({
      success: true,
      count: notes.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      notes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single note
// @route   GET /api/notes/:id
// @access  Private
exports.getNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note || !note.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    res.status(200).json({
      success: true,
      note
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new note
// @route   POST /api/notes
// @access  Private
exports.createNote = async (req, res, next) => {
  try {
    const { title, content, color, isPinned } = req.body;

    const note = await Note.create({
      title,
      content,
      color,
      isPinned
    });

    res.status(201).json({
      success: true,
      note
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update note
// @route   PUT /api/notes/:id
// @access  Private
exports.updateNote = async (req, res, next) => {
  try {
    let note = await Note.findById(req.params.id);

    if (!note || !note.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    const { title, content, color, isPinned } = req.body;

    note = await Note.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content,
        color,
        isPinned
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      note
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete note (soft delete)
// @route   DELETE /api/notes/:id
// @access  Private
exports.deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note || !note.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    note.isActive = false;
    await note.save();

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle pin status
// @route   PATCH /api/notes/:id/pin
// @access  Private
exports.togglePin = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note || !note.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    note.isPinned = !note.isPinned;
    await note.save();

    res.status(200).json({
      success: true,
      note
    });
  } catch (error) {
    next(error);
  }
};
