const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Reference to the invoice being paid
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: [true, 'Invoice reference is required']
  },
  // Reference to the customer (denormalized for easier queries)
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer reference is required']
  },
  // Payment amount
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0.01, 'Payment amount must be greater than 0']
  },
  // Payment date
  paymentDate: {
    type: Date,
    default: Date.now
  },
  // Payment method
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT/RTGS'],
    default: 'Cash'
  },
  // Reference number (transaction ID, cheque number, etc.)
  referenceNumber: {
    type: String,
    trim: true,
    default: ''
  },
  // Notes about the payment
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  // Invoice snapshot at time of payment (for reference)
  invoiceSnapshot: {
    invoiceNumber: String,
    invoiceDate: Date,
    netTotal: Number
  },
  // Who recorded this payment
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

// Indexes for quick lookups
paymentSchema.index({ invoice: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
