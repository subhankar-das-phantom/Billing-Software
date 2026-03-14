const mongoose = require('mongoose');

const creditNoteItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantityReturned: {
    type: Number,
    required: true,
    min: 1
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  gstPercent: {
    type: Number,
    required: true
  },
  // Calculated fields
  taxableAmount: {
    type: Number,
    required: true
  },
  gstAmount: {
    type: Number,
    required: true
  },
  cgstAmount: {
    type: Number,
    required: true
  },
  sgstAmount: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  }
});

const creditNoteSchema = new mongoose.Schema({
  creditNoteNumber: {
    type: String,
    required: true,
    unique: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  // Snapshot of invoice number for display
  invoiceNumber: {
    type: String,
    required: true
  },
  // Customer snapshot
  customer: {
    _id: mongoose.Schema.Types.ObjectId,
    customerName: String,
    phone: String,
    gstin: String
  },
  items: [creditNoteItemSchema],
  // Credit note totals
  totals: {
    totalTaxable: {
      type: Number,
      required: true
    },
    totalGST: {
      type: Number,
      required: true
    },
    totalCGST: {
      type: Number,
      required: true
    },
    totalSGST: {
      type: Number,
      required: true
    },
    netTotal: {
      type: Number,
      required: true
    }
  },
  reason: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'createdBy.userModel'
    },
    userModel: {
      type: String,
      enum: ['Admin', 'Employee'],
      default: 'Admin'
    }
  }
}, {
  timestamps: true
});

// Indexes
creditNoteSchema.index({ invoiceId: 1 });
creditNoteSchema.index({ 'customer._id': 1 });
creditNoteSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CreditNote', creditNoteSchema);
