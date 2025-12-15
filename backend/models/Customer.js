const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: [true, 'Please add customer name'],
    trim: true
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    required: [true, 'Please add phone number'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  gstin: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  dlNo: {
    type: String,
    trim: true,
    default: ''
  },
  customerCode: {
    type: String,
    trim: true,
    default: ''
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  totalPurchases: {
    type: Number,
    default: 0
  },
  invoiceCount: {
    type: Number,
    default: 0
  },
  lastInvoiceDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for search
customerSchema.index({ customerName: 'text', phone: 'text', gstin: 'text' });
customerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Customer', customerSchema);
