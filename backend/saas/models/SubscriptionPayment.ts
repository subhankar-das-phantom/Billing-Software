import mongoose, { Schema } from 'mongoose';
import { PaymentStatus, PaymentGateway } from '../shared/features';

const subscriptionPaymentSchema = new Schema(
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
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Plan ID is required'],
    },
    durationMonths: {
      type: Number,
      required: [true, 'Duration is required'],
      min: 1,
    },
    baseAmount: {
      type: Number,
      required: [true, 'Base amount is required'],
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: [true, 'Final amount is required'],
      min: 0,
    },
    paymentGateway: {
      type: String,
      enum: Object.values(PaymentGateway),
      required: [true, 'Payment gateway is required'],
    },
    gatewayOrderId: {
      type: String,
      trim: true,
      sparse: true,
    },
    gatewaySubscriptionId: {
      type: String,
      trim: true,
      sparse: true,
    },
    gatewayInvoiceId: {
      type: String,
      trim: true,
      sparse: true,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
      sparse: true,
    },
    gatewaySignature: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      required: true,
    },
    billingMode: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual',
    },
    gatewayEventId: {
      type: String,
      trim: true,
      sparse: true,
    },
    paidAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

// Indexes
subscriptionPaymentSchema.index({ tenantId: 1, createdAt: -1 });
subscriptionPaymentSchema.index({ paymentStatus: 1 });
subscriptionPaymentSchema.index({ gatewaySubscriptionId: 1 });
subscriptionPaymentSchema.index({ gatewayPaymentId: 1 });
subscriptionPaymentSchema.index({ gatewayEventId: 1 });


export default mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
