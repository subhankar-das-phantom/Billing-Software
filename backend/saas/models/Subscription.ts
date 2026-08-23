import mongoose, { Schema } from 'mongoose';
import { SubscriptionStatus, PlanCode, Feature } from '../shared/features';

/**
 * Embedded snapshot of the plan/pricing at time of purchase.
 * Ensures historical accuracy even if plan details change later.
 */
const pricingSnapshotSchema = new Schema(
  {
    planName: { type: String, required: true },
    planCode: { type: String, enum: Object.values(PlanCode), required: true },
    baseMonthlyPrice: { type: Number, required: true },
    durationMonths: { type: Number, required: true },
    discountApplied: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },
    features: { type: [String], enum: Object.values(Feature), required: true },
  },
  { _id: false },
);

const subscriptionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Tenant ID is required'],
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Plan ID is required'],
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.TRIAL,
      required: true,
    },
    startedAt: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    graceUntil: {
      type: Date,
      required: [true, 'Grace end date is required'],
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    billingMode: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual',
    },
    gatewaySubscriptionId: {
      type: String,
      trim: true,
      sparse: true,
    },
    gatewayCustomerId: {
      type: String,
      trim: true,
      sparse: true,
    },
    gatewayPlanId: {
      type: String,
      trim: true,
      sparse: true,
    },
    renewalIntervalMonths: {
      type: Number,
      min: 1,
    },
    nextChargeAt: {
      type: Date,
    },
    autoRenewStatus: {
      type: String,
      trim: true,
    },
    gracePeriodDays: {
      type: Number,
      default: 7,
    },
    currentPricingSnapshot: {
      type: pricingSnapshotSchema,
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes
subscriptionSchema.index({ tenantId: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1 });
subscriptionSchema.index({ graceUntil: 1 });
subscriptionSchema.index({ tenantId: 1, createdAt: -1 });


export default mongoose.model('Subscription', subscriptionSchema);
