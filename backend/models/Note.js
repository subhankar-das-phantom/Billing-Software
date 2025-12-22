const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  content: {
    type: String,
    trim: true,
    maxlength: [5000, 'Content cannot be more than 5000 characters'],
    default: ''
  },
  color: {
    type: String,
    default: '#3B82F6', // Default blue-500
    trim: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for search
noteSchema.index({ title: 'text', content: 'text' });
noteSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
