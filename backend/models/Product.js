const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['invoice', 'invoice_edit', 'invoice_edit_reversal', 'invoice_cancelled', 'adjustment', 'opening'],
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
  },
  // Who made this stock adjustment
  adjustedBy: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'stockHistory.adjustedBy.userModel'
    },
    userModel: {
      type: String,
      enum: ['Admin', 'Employee']
    }
  }
});

const productSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
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
  // Attribution - who created/updated this product
  createdBy: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'createdBy.userModel'
    },
    userModel: {
      type: String,
      enum: ['Admin', 'Employee']
    }
  },
  lastUpdatedBy: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'lastUpdatedBy.userModel'
    },
    userModel: {
      type: String,
      enum: ['Admin', 'Employee']
    }
  },
  stockHistory: [stockHistorySchema]
}, {
  timestamps: true
});

// Index for search
productSchema.index({ productName: 'text', hsnCode: 'text', manufacturer: 'text' });
productSchema.index({ tenantId: 1 });
productSchema.index({ tenantId: 1, productName: 1 });
productSchema.index({ tenantId: 1, isActive: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ currentStockQty: 1 });

module.exports = mongoose.model('Product', productSchema);
