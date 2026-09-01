import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPurchaseItem {
  productId: mongoose.Types.ObjectId;
  batchId?: mongoose.Types.ObjectId;
  batchNumber?: string;
  expiryDate?: Date;
  quantity: number;
  freeQuantity: number;
  mrp: number;
  purchaseRate: number;
  sellingRate: number;
  gstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  discount: number;
  taxableAmount: number;
  total: number;
}

export interface IPurchase extends Document {
  tenantId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  purchaseNumber: string;
  purchaseDate: Date;
  supplierInvoiceNumber?: string;
  items: IPurchaseItem[];
  totals: {
    subtotal: number;
    totalDiscount: number;
    totalTaxable: number;
    totalGST: number;
    totalCGST: number;
    totalSGST: number;
    totalIGST: number;
    grandTotal: number;
  };
  notes?: string;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  createdBy: {
    user: mongoose.Types.ObjectId;
    userModel: 'Admin' | 'Employee';
  };
  updatedBy?: {
    user: mongoose.Types.ObjectId;
    userModel: 'Admin' | 'Employee';
  };
  cancelledBy?: {
    user: mongoose.Types.ObjectId;
    userModel: 'Admin' | 'Employee';
  };
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseItemSchema = new Schema<IPurchaseItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  batchId: {
    type: Schema.Types.ObjectId,
    ref: 'Batch'
  },
  batchNumber: {
    type: String
  },
  expiryDate: {
    type: Date
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  freeQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  mrp: {
    type: Number,
    required: true,
    min: 0
  },
  purchaseRate: {
    type: Number,
    required: true,
    min: 0
  },
  sellingRate: {
    type: Number,
    required: true,
    min: 0
  },
  gstPercent: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  cgstAmount: {
    type: Number,
    required: true,
    default: 0
  },
  sgstAmount: {
    type: Number,
    required: true,
    default: 0
  },
  igstAmount: {
    type: Number,
    required: true,
    default: 0
  },
  gstAmount: {
    type: Number,
    required: true,
    default: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  taxableAmount: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
});

const purchaseSchema = new Schema<IPurchase>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  supplierId: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true,
    index: true
  },
  purchaseNumber: {
    type: String,
    required: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  supplierInvoiceNumber: {
    type: String,
    trim: true
  },
  items: [purchaseItemSchema],
  totals: {
    subtotal: {
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
    totalIGST: {
      type: Number,
      required: true
    },
    grandTotal: {
      type: Number,
      required: true
    }
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['DRAFT', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT',
    required: true
  },
  createdBy: {
    user: {
      type: Schema.Types.ObjectId,
      refPath: 'createdBy.userModel',
      required: true
    },
    userModel: {
      type: String,
      enum: ['Admin', 'Employee'],
      required: true
    }
  },
  updatedBy: {
    user: {
      type: Schema.Types.ObjectId,
      refPath: 'updatedBy.userModel'
    },
    userModel: {
      type: String,
      enum: ['Admin', 'Employee']
    }
  },
  cancelledBy: {
    user: {
      type: Schema.Types.ObjectId,
      refPath: 'cancelledBy.userModel'
    },
    userModel: {
      type: String,
      enum: ['Admin', 'Employee']
    }
  },
  cancelledAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
purchaseSchema.index({ tenantId: 1, purchaseNumber: 1 }, { unique: true });
purchaseSchema.index({ tenantId: 1, purchaseDate: -1 });
purchaseSchema.index({ tenantId: 1, supplierId: 1 });
purchaseSchema.index({ tenantId: 1, status: 1 });

const Purchase = mongoose.model<IPurchase>('Purchase', purchaseSchema);

export default Purchase;
