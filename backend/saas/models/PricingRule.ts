import mongoose, { Schema } from 'mongoose';
import { DiscountType, SUPPORTED_DURATIONS } from '../shared/features';

const pricingRuleSchema = new Schema(
  {
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Plan reference is required'],
    },
    durationMonths: {
      type: Number,
      required: [true, 'Duration is required'],
      enum: {
        values: [...SUPPORTED_DURATIONS],
        message: 'Duration must be 1, 3, 6, or 12 months',
      },
    },
    discountType: {
      type: String,
      enum: Object.values(DiscountType),
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Compound unique: one rule per plan+duration
pricingRuleSchema.index({ planId: 1, durationMonths: 1 }, { unique: true });
pricingRuleSchema.index({ active: 1 });

export default mongoose.model('PricingRule', pricingRuleSchema);
