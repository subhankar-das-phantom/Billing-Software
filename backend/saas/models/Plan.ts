import mongoose, { Schema } from 'mongoose';
import { PlanCode, Feature } from '../shared/features';

const planSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      maxlength: [100, 'Plan name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Plan code is required'],
      enum: Object.values(PlanCode),
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    baseMonthlyPrice: {
      type: Number,
      required: [true, 'Base monthly price is required'],
      min: [0, 'Price cannot be negative'],
    },
    features: {
      type: [String],
      enum: Object.values(Feature),
      required: [true, 'At least one feature is required'],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'Plan must have at least one feature',
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

// Indexes
planSchema.index({ active: 1, displayOrder: 1 });

export default mongoose.model('Plan', planSchema);
