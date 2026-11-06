/**
 * Bharat Enterprise Billing System — Platform Offer Campaign Model
 * Promotional offers, broadcast announcements, discount coupons, and system alerts.
 */

import mongoose, { Schema, Model, Document, Types } from 'mongoose';

export enum CampaignType {
  PROMOTIONAL_OFFER = 'PROMOTIONAL_OFFER',
  BROADCAST_ANNOUNCEMENT = 'BROADCAST_ANNOUNCEMENT',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  DISCOUNT_COUPON = 'DISCOUNT_COUPON',
  FEATURE_RELEASE = 'FEATURE_RELEASE',
}

export enum TargetAudience {
  ALL_TENANTS = 'ALL_TENANTS',
  BY_PLAN = 'BY_PLAN',
  BY_STATUS = 'BY_STATUS',
  SPECIFIC_TENANTS = 'SPECIFIC_TENANTS',
}

export enum CampaignDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
  BONUS_DAYS = 'BONUS_DAYS',
  NONE = 'NONE',
}

export enum BannerStyle {
  EMERALD = 'emerald',
  BLUE = 'blue',
  AMBER = 'amber',
  ROSE = 'rose',
  PURPLE = 'purple',
}

export enum CampaignPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface IPlatformOfferCampaign {
  _id: Types.ObjectId;
  title: string;
  message: string;
  type: CampaignType;
  targetAudience: TargetAudience;
  targetPlanCodes: string[];
  targetStatuses: string[];
  targetTenantIds: Types.ObjectId[];
  promoCode?: string | null;
  discountType: CampaignDiscountType;
  discountValue: number;
  bannerStyle: BannerStyle;
  callToAction?: {
    label?: string;
    url?: string;
    route?: string;
  };
  isDismissible: boolean;
  startsAt: Date;
  expiresAt: Date;
  isActive: boolean;
  priority: CampaignPriority;
  broadcastCount: number;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PlatformOfferCampaignDocument = IPlatformOfferCampaign & Document;

const callToActionSchema = new Schema(
  {
    label: { type: String, trim: true },
    url: { type: String, trim: true },
    route: { type: String, trim: true },
  },
  { _id: false },
);

const platformOfferCampaignSchema = new Schema<IPlatformOfferCampaign>(
  {
    title: {
      type: String,
      required: [true, 'Campaign title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Campaign message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    type: {
      type: String,
      enum: Object.values(CampaignType),
      default: CampaignType.PROMOTIONAL_OFFER,
      required: true,
    },
    targetAudience: {
      type: String,
      enum: Object.values(TargetAudience),
      default: TargetAudience.ALL_TENANTS,
      required: true,
    },
    targetPlanCodes: {
      type: [String],
      default: [],
    },
    targetStatuses: {
      type: [String],
      default: [],
    },
    targetTenantIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Admin',
      },
    ],
    promoCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },
    discountType: {
      type: String,
      enum: Object.values(CampaignDiscountType),
      default: CampaignDiscountType.NONE,
      required: true,
    },
    discountValue: {
      type: Number,
      min: [0, 'Discount value cannot be negative'],
      default: 0,
      required: true,
    },
    bannerStyle: {
      type: String,
      enum: Object.values(BannerStyle),
      default: BannerStyle.BLUE,
      required: true,
    },
    callToAction: {
      type: callToActionSchema,
      default: undefined,
    },
    isDismissible: {
      type: Boolean,
      default: true,
      required: true,
    },
    startsAt: {
      type: Date,
      required: [true, 'Campaign start date is required'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Campaign expiry date is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(CampaignPriority),
      default: CampaignPriority.NORMAL,
      required: true,
    },
    broadcastCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
      default: null,
    },
  },
  { timestamps: true },
);

// ─── Query Performance Indexes ────────────────────────────────────
// Active campaigns within time window
platformOfferCampaignSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1 });

// Target audience filter optimization
platformOfferCampaignSchema.index({ targetAudience: 1, isActive: 1 });

// Administration list sorting
platformOfferCampaignSchema.index({ createdAt: -1 });

export const PlatformOfferCampaign: Model<IPlatformOfferCampaign> =
  (mongoose.models.PlatformOfferCampaign as Model<IPlatformOfferCampaign>) ||
  mongoose.model<IPlatformOfferCampaign>('PlatformOfferCampaign', platformOfferCampaignSchema);

export default PlatformOfferCampaign;
