import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBatch extends Document {
  tenantId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  batchNo: string | null;
  expiryDate: Date | null;
  rate: number;
  mrp: number;
  gstPercent: number;
  initialQty: number;
  remainingQty: number;
  isActive: boolean;
  createdBy: {
    user: mongoose.Types.ObjectId;
    userModel: 'Admin' | 'Employee';
  };
  createdAt: Date;
  updatedAt: Date;
}

const batchSchema = new Schema<IBatch>(
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
    batchNo: {
      type: String,
      trim: true,
      default: 'UNNAMED'
    },
    expiryDate: {
      type: Date,
      default: null
    },
    rate: {
      type: Number,
      default: 0,
      min: 0
    },
    mrp: {
      type: Number,
      required: true,
      min: 0
    },
    gstPercent: {
      type: Number,
      required: true,
      enum: [0, 5, 12, 18, 28],
      default: 12
    },
    initialQty: {
      type: Number,
      default: 0,
      min: 0
    },
    remainingQty: {
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

// Tenant-safe indexes
batchSchema.index({ tenantId: 1, productId: 1, remainingQty: 1, expiryDate: 1 });
batchSchema.index({ tenantId: 1, productId: 1 });
batchSchema.index({ tenantId: 1, batchNo: 1 });

const Batch: Model<IBatch> = mongoose.model<IBatch>('Batch', batchSchema);
export default Batch;
