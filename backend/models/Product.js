const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['invoice', 'adjustment', 'opening'],
    required: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  changeQty: {
    type: Number,
    required: true
  },
  previousQty: {
    type: Number
  },
  newQty: {
    type: Number
  },
  reference: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true
  },
  hsnCode: {
    type: String,
    required: [true, 'Please add HSN code'],
    trim: true
  },
  manufacturer: {
    type: String,
    trim: true,
    default: ''
  },
  batchNo: {
    type: String,
    required: [true, 'Please add batch number'],
    trim: true
  },
  expiryDate: {
    type: Date
  },
  oldMRP: {
    type: Number,
    default: 0
  },
  newMRP: {
    type: Number,
    required: [true, 'Please add MRP'],
    min: 0
  },
  rate: {
    type: Number,
    required: [true, 'Please add rate'],
    min: 0
  },
  gstPercentage: {
    type: Number,
    required: [true, 'Please add GST percentage'],
    enum: [0, 5, 12, 18, 28],
    default: 12
  },
  openingStockQty: {
    type: Number,
    default: 0,
    min: 0
  },
  currentStockQty: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: 'Pieces'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stockHistory: [stockHistorySchema]
}, {
  timestamps: true
});

// Index for search
productSchema.index({ productName: 'text', hsnCode: 'text', manufacturer: 'text' });
productSchema.index({ isActive: 1 });
productSchema.index({ currentStockQty: 1 });

module.exports = mongoose.model('Product', productSchema);
