const mongoose = require('mongoose');

// Embedded product snapshot for invoice items
const invoiceItemSchema = new mongoose.Schema({
  product: {
    _id: mongoose.Schema.Types.ObjectId,
    productName: String,
    hsnCode: String,
    pack: String,
    batchNo: String,
    expiryDate: Date,
    newMRP: Number,
    gstPercentage: Number
  },
  quantitySold: {
    type: Number,
    required: true,
    min: 1
  },
  freeQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  ratePerUnit: {
    type: Number,
    required: true,
    min: 0
  },
  schemeDiscount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // Calculated fields
  baseAmount: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    default: 0
  },
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

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  // Customer snapshot
  customer: {
    _id: mongoose.Schema.Types.ObjectId,
    customerName: String,
    address: String,
    phone: String,
    gstin: String,
    dlNo: String
  },
  // Distributor/Firm snapshot
  distributor: {
    firmName: String,
    firmAddress: String,
    firmPhone: String,
    firmGSTIN: String
  },
  // Invoice items
  items: [invoiceItemSchema],
  // Invoice totals
  totals: {
    baseAmount: {
      type: Number,
      required: true
    },
    totalDiscount: {
      type: Number,
      default: 0
    },
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
    },
    amountInWords: {
      type: String
    }
  },
  paymentType: {
    type: String,
    enum: ['Cash', 'Credit'],
    default: 'Credit'
  },
  status: {
    type: String,
    enum: ['Created', 'Printed', 'Cancelled'],
    default: 'Created'
  },
  notes: {
    type: String,
    default: ''
  },
  // Payment tracking fields
  paidAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Partial', 'Paid'],
    default: 'Unpaid'
  },
  dueDate: {
    type: Date
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
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ 'customer._id': 1 });
invoiceSchema.index({ status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
