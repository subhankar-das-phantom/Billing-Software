/**
 * Bharat Enterprise Billing System — Platform Invoice Model
 * Statutory B2B GST Tax Invoice conforming to Section 31 CGST Act 2017 & Rule 46.
 */

import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export interface IPlatformInvoiceItem {
  description: string;
  sacCode: string;
  durationMonths: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableAmount: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalAmount: number;
}

export interface IPlatformInvoiceTotals {
  subTotal: number;
  totalDiscount: number;
  taxableValue: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  grandTotalPaise: number;
  amountInWords: string;
}

export interface IPlatformInvoiceIssuer {
  legalName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  state: string;
  stateCode: string;
  address: string;
  supportEmail: string;
  supportPhone: string;
}

export interface IPlatformInvoiceRecipient {
  tenantId: Types.ObjectId;
  firmName: string;
  firmGSTIN?: string;
  firmAddress?: string;
  firmPhone?: string;
  firmEmail?: string;
  state?: string;
  stateCode?: string;
  placeOfSupply?: string;
  isB2B?: boolean;
}

export interface IPlatformInvoicePaymentRef {
  paymentId?: Types.ObjectId;
  paymentMode?: string;
  utrNumber?: string;
  paidAt?: Date;
}

export type TaxTreatmentType = 'INTRA_STATE' | 'INTER_STATE' | 'EXEMPT';
export type PlatformInvoiceStatus = 'ISSUED' | 'CANCELLED';

export interface IPlatformInvoice extends Document {
  invoiceNumber: string;
  invoiceDate: Date;
  financialYear: string;
  issuer: IPlatformInvoiceIssuer;
  recipient: IPlatformInvoiceRecipient;
  items: IPlatformInvoiceItem[];
  totals: IPlatformInvoiceTotals;
  taxTreatment: TaxTreatmentType;
  payment?: IPlatformInvoicePaymentRef;
  subscriptionId?: Types.ObjectId;
  planId?: Types.ObjectId;
  status: PlatformInvoiceStatus;
  issuedBy?: Types.ObjectId;
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const issuerSchema = new Schema(
  {
    legalName: { type: String, required: true },
    tradeName: { type: String, required: true },
    gstin: { type: String, required: true },
    pan: { type: String, required: true },
    state: { type: String, required: true },
    stateCode: { type: String, required: true },
    address: { type: String, required: true },
    supportEmail: { type: String, required: true },
    supportPhone: { type: String, required: true },
  },
  { _id: false },
);

const recipientSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true,
    },
    firmName: { type: String, required: true },
    firmGSTIN: { type: String, default: '', trim: true, uppercase: true },
    firmAddress: { type: String, default: '' },
    firmPhone: { type: String, default: '' },
    firmEmail: { type: String, default: '' },
    state: { type: String, default: '' },
    stateCode: { type: String, default: '' },
    placeOfSupply: { type: String, default: '' },
    isB2B: { type: Boolean, default: false },
  },
  { _id: false },
);

const itemSchema = new Schema(
  {
    description: { type: String, required: true },
    sacCode: { type: String, default: '998313', trim: true },
    durationMonths: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    gstRate: { type: Number, default: 18.0 },
    cgstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstRate: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
  },
  { _id: false },
);

const totalsSchema = new Schema(
  {
    subTotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    taxableValue: { type: Number, required: true },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    grandTotalPaise: { type: Number, required: true },
    amountInWords: { type: String, required: true },
  },
  { _id: false },
);

const paymentRefSchema = new Schema(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPayment' },
    paymentMode: { type: String },
    utrNumber: { type: String, trim: true, uppercase: true },
    paidAt: { type: Date },
  },
  { _id: false },
);

const platformInvoiceSchema = new Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    financialYear: {
      type: String,
      required: true,
      index: true,
    },
    issuer: {
      type: issuerSchema,
      required: true,
    },
    recipient: {
      type: recipientSchema,
      required: true,
    },
    items: {
      type: [itemSchema],
      required: true,
      validate: [(val: any[]) => val.length > 0, 'At least one invoice item is required'],
    },
    totals: {
      type: totalsSchema,
      required: true,
    },
    taxTreatment: {
      type: String,
      enum: ['INTRA_STATE', 'INTER_STATE', 'EXEMPT'],
      required: true,
    },
    payment: {
      type: paymentRefSchema,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
    },
    status: {
      type: String,
      enum: ['ISSUED', 'CANCELLED'],
      default: 'ISSUED',
      required: true,
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
    },
    pdfUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// Compound indexes
platformInvoiceSchema.index({ financialYear: 1, invoiceNumber: 1 });
platformInvoiceSchema.index({ 'recipient.tenantId': 1, createdAt: -1 });
platformInvoiceSchema.index({ status: 1, createdAt: -1 });

export const PlatformInvoice: Model<IPlatformInvoice> =
  (mongoose.models.PlatformInvoice as Model<IPlatformInvoice>) ||
  mongoose.model<IPlatformInvoice>('PlatformInvoice', platformInvoiceSchema);

export default PlatformInvoice;
