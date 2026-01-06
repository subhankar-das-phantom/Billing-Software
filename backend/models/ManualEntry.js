const mongoose = require('mongoose');

const manualEntrySchema = new mongoose.Schema({
  // Customer reference
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },

  // Entry classification
  entryType: {
    type: String,
    enum: ['opening_balance', 'manual_bill', 'payment_adjustment', 'credit_adjustment'],
    required: [true, 'Entry type is required']
  },

  // Payment type - works like invoices (Cash vs Credit)
  paymentType: {
    type: String,
    enum: ['Cash', 'Credit'],
    required: [true, 'Payment type is required']
  },

  // Amount (always positive)
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },

  // For opening_balance entries - track payments made against them
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Entry date
  entryDate: {
    type: Date,
    default: Date.now
  },

  // Required description
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },

  // Optional notes
  notes: {
    type: String,
    trim: true,
    default: ''
  },

  // Payment details (for payment_adjustment entries)
  paymentMethod: {
    type: String,
    default: 'Cash'
  },

  referenceNumber: {
    type: String,
    trim: true
  },

  // Link to parent entry (e.g., payment for an opening balance)
  parentEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ManualEntry'
  },

  // Control flags
  affectInventory: {
    type: Boolean,
    default: false
  },

  excludeFromAnalytics: {
    type: Boolean,
    default: false
  },

  // Customer snapshot at time of entry
  customerSnapshot: {
    customerName: String,
    phone: String,
    outstandingBefore: Number
  },

  // Audit trail
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

// Virtual for remaining balance
manualEntrySchema.virtual('remainingBalance').get(function() {
  if (this.entryType === 'opening_balance' && this.paymentType === 'Credit') {
    return this.amount - (this.paidAmount || 0);
  }
  return 0;
});

// Virtual for payment status
manualEntrySchema.virtual('paymentStatus').get(function() {
  if (this.entryType !== 'opening_balance' || this.paymentType !== 'Credit') {
    return null;
  }
  const remaining = this.amount - (this.paidAmount || 0);
  if (remaining <= 0) return 'Paid';
  if (this.paidAmount > 0) return 'Partial';
  return 'Unpaid';
});

// Include virtuals in JSON output
manualEntrySchema.set('toJSON', { virtuals: true });
manualEntrySchema.set('toObject', { virtuals: true });

// Indexes
manualEntrySchema.index({ customer: 1 });
manualEntrySchema.index({ entryType: 1 });
manualEntrySchema.index({ entryDate: -1 });
manualEntrySchema.index({ createdAt: -1 });

module.exports = mongoose.model('ManualEntry', manualEntrySchema);
