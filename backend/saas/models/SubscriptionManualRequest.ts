/**
 * Bharat Enterprise Billing System — Subscription Manual Payment Request Model
 * Tenant payment proof queue for offline subscriptions.
 */

import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export type ManualPaymentRequestStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
export type ManualPaymentMode = 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'CHEQUE' | 'CASH';

export interface ISubscriptionManualRequest extends Document {
  tenantId: Types.ObjectId;
  planId: Types.ObjectId;
  durationMonths: number;
  declaredAmount: number;
  paymentMode: ManualPaymentMode;
  utrNumber: string;
  paymentDate: Date;
  bankName?: string;
  proofDocumentUrl?: string;
  notes?: string;
  status: ManualPaymentRequestStatus;
  rejectionReason?: string;
  lockedBy?: Types.ObjectId;
  lockedAt?: Date;
  resolvedPaymentId?: Types.ObjectId;
  resolvedInvoiceId?: Types.ObjectId;
  appliedPromoCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionManualRequestSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Plan ID is required'],
    },
    durationMonths: {
      type: Number,
      required: [true, 'Duration in months is required'],
      enum: [1, 3, 6, 12],
    },
    declaredAmount: {
      type: Number,
      required: [true, 'Declared amount is required'],
      min: [0, 'Declared amount must be positive'],
    },
    paymentMode: {
      type: String,
      enum: ['NEFT', 'RTGS', 'IMPS', 'UPI', 'CHEQUE', 'CASH'],
      required: [true, 'Payment mode is required'],
    },
    utrNumber: {
      type: String,
      required: [true, 'UTR / Reference Number is required'],
      uppercase: true,
      trim: true,
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
    },
    bankName: {
      type: String,
      trim: true,
    },
    proofDocumentUrl: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    lockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
    },
    lockedAt: {
      type: Date,
    },
    resolvedPaymentId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPayment',
    },
    resolvedInvoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformInvoice',
    },
    appliedPromoCode: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// Indexes
subscriptionManualRequestSchema.index({ tenantId: 1, createdAt: -1 });
subscriptionManualRequestSchema.index({ status: 1, createdAt: -1 });
subscriptionManualRequestSchema.index({ utrNumber: 1 });

export const SubscriptionManualRequest: Model<ISubscriptionManualRequest> =
  (mongoose.models.SubscriptionManualRequest as Model<ISubscriptionManualRequest>) ||
  mongoose.model<ISubscriptionManualRequest>('SubscriptionManualRequest', subscriptionManualRequestSchema);

export default SubscriptionManualRequest;
