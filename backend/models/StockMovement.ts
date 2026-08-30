import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IStockMovement extends Document {
  tenantId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId | null;
  type: 'PURCHASE' | 'OPENING_STOCK' | 'MANUAL_ADJUSTMENT_IN' | 'MANUAL_ADJUSTMENT_OUT' | 'SALE' | 'SALE_REVERSAL' | 'SALE_RETURN' | 'PURCHASE_RETURN';
  quantity: number;
  rate: number;
  totalValue: number;
  referenceType: string | null;
  referenceId: string | null;
  createdBy: {
    user: mongoose.Types.ObjectId;
    userModel: 'Admin' | 'Employee';
  };
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true
    },
    type: {
      type: String,
      enum: [
        'PURCHASE',
        'OPENING_STOCK',
        'MANUAL_ADJUSTMENT_IN',
        'MANUAL_ADJUSTMENT_OUT',
        'SALE',
        'SALE_REVERSAL',
        'SALE_RETURN',
        'PURCHASE_RETURN'
      ],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    rate: {
      type: Number,
      default: 0
    },
    totalValue: {
      type: Number,
      default: 0
    },
    referenceType: {
      type: String,
      default: null
    },
    referenceId: {
      type: String,
      default: null
    },
    createdBy: {
      user: {
        type: Schema.Types.ObjectId,
        refPath: 'createdBy.userModel'
      },
      userModel: {
        type: String,
        enum: ['Admin', 'Employee']
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes for faster retrieval of history
stockMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, batchId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, referenceType: 1, referenceId: 1 });

const StockMovement: Model<IStockMovement> = mongoose.model<IStockMovement>('StockMovement', stockMovementSchema);
export default StockMovement;
