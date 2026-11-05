/**
 * Bharat Enterprise Billing System — Platform Audit Head Model
 * Manages monotonic sequence counters and cryptographic hash chain tips per partition scope.
 */

import mongoose, { Schema, Model } from 'mongoose';
import type { IPlatformAuditHead } from '../types';

export const AUDIT_GENESIS_HASH = 'GENESIS_BHARAT_ENTERPRISE_AUDIT_V1';

const platformAuditHeadSchema = new Schema<IPlatformAuditHead>(
  {
    scope: { type: String, required: true, unique: true, index: true },
    lastSequence: { type: Number, required: true, default: 0 },
    lastHash: { type: String, required: true, default: AUDIT_GENESIS_HASH },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export const PlatformAuditHead: Model<IPlatformAuditHead> =
  (mongoose.models.PlatformAuditHead as Model<IPlatformAuditHead>) ||
  mongoose.model<IPlatformAuditHead>('PlatformAuditHead', platformAuditHeadSchema);
