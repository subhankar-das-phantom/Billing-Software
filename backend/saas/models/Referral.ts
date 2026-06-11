import mongoose, { Schema } from 'mongoose';
import { ReferralStatus } from '../shared/features';

const referralSchema = new Schema(
  {
    referralCode: {
      type: String,
      required: [true, 'Referral code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [20, 'Referral code cannot exceed 20 characters'],
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'ReferralCampaign',
      required: [true, 'Campaign reference is required'],
    },
    referrerTenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Referrer tenant is required'],
    },
    referredTenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(ReferralStatus),
      default: ReferralStatus.PENDING,
      required: true,
    },
    referrerRewardGranted: {
      type: Boolean,
      default: false,
    },
    referredRewardGranted: {
      type: Boolean,
      default: false,
    },
    qualifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Indexes
referralSchema.index({ referrerTenantId: 1 });
referralSchema.index({ referredTenantId: 1 }, { sparse: true });
referralSchema.index({ status: 1 });
referralSchema.index({ referralCode: 1 });

export default mongoose.model('Referral', referralSchema);
