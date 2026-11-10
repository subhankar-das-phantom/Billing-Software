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
      unique: true,
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
    taxableAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    gstRate: {
      type: Number,
      default: 18.0,
      min: 0,
    },
    cgstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sgstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    igstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    finalAmountPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    manualDetails: {
      mode: {
        type: String,
        enum: ['NEFT', 'RTGS', 'IMPS', 'UPI', 'CASH', 'CHEQUE', 'COMPLIMENTARY'],
        default: 'UPI',
      },
      utrNumber: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
      depositedToAccount: { type: String, trim: true },
      instrumentDate: { type: Date },
      receiptUrl: { type: String, trim: true },
      clearedAt: { type: Date },
      isComplimentary: { type: Boolean, default: false },
    },
    platformInvoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformInvoice',
    },
    platformInvoiceNumber: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
    },
    operationalReason: {
      type: String,
      trim: true,
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
subscriptionPaymentSchema.index({ 'manualDetails.utrNumber': 1 }, { sparse: true });
subscriptionPaymentSchema.index({ platformInvoiceId: 1 }, { sparse: true });




export default mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
