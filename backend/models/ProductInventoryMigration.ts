import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IProductInventoryMigration extends Document {
  tenantId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  generation: number;
  direction: 'FREE_TO_BATCH' | 'BATCH_TO_FREE';
  status: 'MIGRATING' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const migrationSchema = new Schema<IProductInventoryMigration>(
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
    generation: {
      type: Number,
      required: true
    },
    direction: {
      type: String,
      enum: ['FREE_TO_BATCH', 'BATCH_TO_FREE'],
      required: true
    },
    status: {
      type: String,
      enum: ['MIGRATING', 'COMPLETED', 'FAILED'],
      required: true,
      default: 'MIGRATING'
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    completedAt: {
      type: Date
    },
    error: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast lookup
migrationSchema.index({ tenantId: 1, productId: 1, generation: 1, direction: 1 }, { unique: true });
migrationSchema.index({ tenantId: 1, productId: 1, status: 1 });
migrationSchema.index({ status: 1 });

const ProductInventoryMigration: Model<IProductInventoryMigration> = mongoose.model<IProductInventoryMigration>('ProductInventoryMigration', migrationSchema);

export default ProductInventoryMigration;
