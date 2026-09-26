import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IShare extends Document {
  tenantId: mongoose.Types.ObjectId;
  resourceType: 'invoice' | 'receipt' | 'quotation' | 'credit_note' | 'payment_receipt';
  resourceId: mongoose.Types.ObjectId;
  tokenHash: string; // SHA-256 hash of rawToken for O(1) indexed public lookup
  encryptedToken: string; // AES-256-GCM encrypted rawToken for active link reuse
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  createdBy: mongoose.Types.ObjectId;
  createdByType: 'Admin' | 'Employee';
  lastAccessedAt?: Date;
  accessCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const shareSchema = new Schema<IShare>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['invoice', 'receipt', 'quotation', 'credit_note', 'payment_receipt']
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    encryptedToken: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'createdByType'
    },
    createdByType: {
      type: String,
      required: true,
      enum: ['Admin', 'Employee']
    },
    lastAccessedAt: {
      type: Date
    },
    accessCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Concurrency guard: Partial unique index ensuring strictly one active share per resource per tenant
shareSchema.index(
  { tenantId: 1, resourceType: 1, resourceId: 1 },
  { unique: true, partialFilterExpression: { revokedAt: null } }
);

const Share: Model<IShare> = mongoose.models.Share || mongoose.model<IShare>('Share', shareSchema);

export default Share;
module.exports = Share;
