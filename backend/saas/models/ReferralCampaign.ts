import mongoose, { Schema } from 'mongoose';
import { RewardType } from '../shared/features';

const rewardConfigSchema = new Schema(
  {
    rewardType: {
      type: String,
      enum: Object.values(RewardType),
      required: [true, 'Reward type is required'],
    },
    rewardValue: {
      type: Number,
      required: [true, 'Reward value is required'],
      min: [0, 'Reward value cannot be negative'],
    },
  },
  { _id: false },
);

const referralCampaignSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: [200, 'Campaign name cannot exceed 200 characters'],
    },
    active: {
      type: Boolean,
      default: true,
    },
    validFrom: {
      type: Date,
      required: [true, 'Valid from date is required'],
    },
    validUntil: {
      type: Date,
      required: [true, 'Valid until date is required'],
    },
    referrerReward: {
      type: rewardConfigSchema,
      required: [true, 'Referrer reward configuration is required'],
    },
    referredReward: {
      type: rewardConfigSchema,
      required: [true, 'Referred reward configuration is required'],
    },
    maxReferralsPerTenant: {
      type: Number,
      default: 0, // 0 = unlimited
      min: 0,
    },
  },
  { timestamps: true },
);

// Indexes
referralCampaignSchema.index({ active: 1, validFrom: 1, validUntil: 1 });

export default mongoose.model('ReferralCampaign', referralCampaignSchema);
