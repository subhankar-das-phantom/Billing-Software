import mongoose, { Schema } from 'mongoose';
import { AdjustmentType } from '../shared/features';

const subscriptionAdjustmentSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Tenant ID is required'],
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
    },
    type: {
      type: String,
      enum: Object.values(AdjustmentType),
      required: [true, 'Adjustment type is required'],
    },
    daysAdded: {
      type: Number,
      required: [true, 'Days added is required'],
      // Can be negative for penalties/corrections
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Creator is required'],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Indexes
subscriptionAdjustmentSchema.index({ tenantId: 1, createdAt: -1 });
subscriptionAdjustmentSchema.index({ type: 1 });

export default mongoose.model('SubscriptionAdjustment', subscriptionAdjustmentSchema);
