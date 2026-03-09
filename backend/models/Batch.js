const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product reference is required'],
    index: true
  },
  batchNo: {
    type: String,
    required: [true, 'Batch number is required'],
    trim: true
  },
  expiryDate: {
    type: Date
  },
  purchaseRate: {
    type: Number,
    default: 0,
    min: 0
  },
  mrp: {
    type: Number,
    required: [true, 'MRP is required'],
    min: 0
  },
  gstPercent: {
    type: Number,
    required: [true, 'GST percentage is required'],
    enum: [0, 5, 12, 18, 28],
    default: 12
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'createdBy.userModel'
    },
    userModel: {
      type: String,
      enum: ['Admin', 'Employee']
    }
  }
}, {
  timestamps: true
});

// Compound index for FIFO queries: find batches for a product sorted by earliest expiry
batchSchema.index({ productId: 1, expiryDate: 1 });
// Index for looking up batches with available stock
batchSchema.index({ productId: 1, stock: 1 });

module.exports = mongoose.model('Batch', batchSchema);
