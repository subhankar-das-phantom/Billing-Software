/**
 * Bharat Enterprise Billing System — SaaS Campaign Model
 * Promotional offers, marketing campaigns, discount announcements, and audience targeting.
 */

import mongoose, { Schema } from 'mongoose';

export enum CampaignBadge {
  SPECIAL_OFFER = 'SPECIAL OFFER',
  ANNOUNCEMENT  = 'ANNOUNCEMENT',
  DISCOUNT      = 'DISCOUNT',
}

export enum TargetAudience {
  ALL_TENANTS      = 'ALL_TENANTS',
  BY_PLAN          = 'BY_PLAN',
  BY_STATUS        = 'BY_STATUS',
  SPECIFIC_TENANTS = 'SPECIFIC_TENANTS',
}

export interface ICampaign {
  _id: mongoose.Types.ObjectId;
  title: string;
  message: string;
  badge: CampaignBadge | string;
  promoCode?: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  ctaText: string;
  ctaUrl: string;
  startsAt: Date;
  expiresAt: Date;
  isActive: boolean;
  targetAudience: TargetAudience | string;
  targetPlans?: string[];
  targetStatuses?: string[];
  targetTenants?: mongoose.Types.ObjectId[];
  broadcastNotification: boolean;
  notificationDelivered: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Campaign title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    message: {
      type: String,
      required: [true, 'Campaign message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    badge: {
      type: String,
      enum: {
        values: ['SPECIAL OFFER', 'ANNOUNCEMENT', 'DISCOUNT'],
        message: 'Badge must be SPECIAL OFFER, ANNOUNCEMENT, or DISCOUNT',
      },
      default: 'SPECIAL OFFER',
    },
    promoCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: [0, 'Discount value cannot be negative'],
      validate: {
        validator: function (val: number) {
          if ((this as any).discountType === 'percentage' && val > 100) {
            return false;
          }
          return true;
        },
        message: 'Percentage discount cannot exceed 100%',
      },
    },
    ctaText: {
      type: String,
      default: 'Claim Offer',
      trim: true,
    },
    ctaUrl: {
      type: String,
      default: '/subscription',
      trim: true,
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
      validate: {
        validator: function (val: Date) {
          const starts = (this as any).startsAt || new Date();
          return val > starts;
        },
        message: 'Expiry date must be strictly after the start date',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    targetAudience: {
      type: String,
      enum: ['ALL_TENANTS', 'BY_PLAN', 'BY_STATUS', 'SPECIFIC_TENANTS'],
      default: 'ALL_TENANTS',
    },
    targetPlans: [
      {
        type: String,
        trim: true,
      },
    ],
    targetStatuses: [
      {
        type: String,
        trim: true,
      },
    ],
    targetTenants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Admin',
      },
    ],
    broadcastNotification: {
      type: Boolean,
      default: false,
    },
    notificationDelivered: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      default: 'SYSTEM',
    },
  },
  { timestamps: true },
);

// Indexes for high-throughput public active lookups and audience targeting
campaignSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1 });
campaignSchema.index({ targetAudience: 1 });

export default mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
