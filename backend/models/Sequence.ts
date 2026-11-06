import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISequence extends Document {
  tenantId: mongoose.Types.ObjectId;
  entity: string;
  year: number;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const sequenceSchema = new Schema<ISequence>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },
    entity: {
      type: String,
      required: true,
      trim: true
    },
    year: {
      type: Number,
      required: true
    },
    seq: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Enforce strictly unique counter per tenant, entity, and year
sequenceSchema.index({ tenantId: 1, entity: 1, year: 1 }, { unique: true });

export const Sequence: Model<ISequence> =
  (mongoose.models.Sequence as Model<ISequence>) ||
  mongoose.model<ISequence>('Sequence', sequenceSchema);

export default Sequence;

