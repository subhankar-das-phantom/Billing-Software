/**
 * Bharat Enterprise Billing System — Platform Sequence Model
 * Atomic gapless sequence counter for statutory documents.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPlatformSequence extends Document {
  entity: string;
  financialYear: string;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const platformSequenceSchema = new Schema(
  {
    entity: {
      type: String,
      required: true,
      trim: true,
    },
    financialYear: {
      type: String,
      required: true,
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

// Compound unique index
platformSequenceSchema.index({ entity: 1, financialYear: 1 }, { unique: true });

export const PlatformSequence: Model<IPlatformSequence> =
  (mongoose.models.PlatformSequence as Model<IPlatformSequence>) ||
  mongoose.model<IPlatformSequence>('PlatformSequence', platformSequenceSchema);

export default PlatformSequence;
