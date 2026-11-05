/**
 * Bharat Enterprise Billing System — Platform Audit Log Model
 * Immutable, tamper-evident, append-only partitioned ledger with SHA-256 hash chaining.
 */

import mongoose, { Schema, Model } from 'mongoose';
import type { IPlatformAuditLog } from '../types';

const platformAuditLogSchema = new Schema<IPlatformAuditLog>(
  {
    scope: { type: String, required: true, index: true },
    sequence: { type: Number, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'PlatformUser', default: null },
    actorEmail: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    targetTenantId: { type: Schema.Types.ObjectId, ref: 'Admin', default: null, index: true },
    supportSessionId: { type: String, default: null },
    reason: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL', 'SECURITY_ALERT'],
      default: 'INFO',
    },
    previousHash: { type: String, required: true },
    hash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

// Compound indexes for performant partitioned cursor lookups
platformAuditLogSchema.index({ scope: 1, sequence: -1 });
platformAuditLogSchema.index({ createdAt: -1, _id: -1 });
platformAuditLogSchema.index({ targetTenantId: 1, createdAt: -1, _id: -1 });

// Strictly append-only hooks: block all modifications and deletions
const blockMutation = function (this: unknown, next?: (err?: Error) => void) {
  const err = new Error('PlatformAuditLog is strictly append-only. Updates and deletions are forbidden.');
  if (typeof next === 'function') {
    return next(err);
  }
  throw err;
};

platformAuditLogSchema.pre('updateOne' as any, blockMutation);
platformAuditLogSchema.pre('updateMany' as any, blockMutation);
platformAuditLogSchema.pre('replaceOne' as any, blockMutation);
platformAuditLogSchema.pre('findOneAndUpdate' as any, blockMutation);
platformAuditLogSchema.pre('deleteOne' as any, blockMutation);
platformAuditLogSchema.pre('deleteMany' as any, blockMutation);
platformAuditLogSchema.pre('findOneAndDelete' as any, blockMutation);
platformAuditLogSchema.pre('findOneAndRemove' as any, blockMutation);

platformAuditLogSchema.pre('save' as any, function (this: any, next?: (err?: Error) => void) {
  if (!this.isNew) {
    const err = new Error('PlatformAuditLog is strictly append-only. Updates and deletions are forbidden.');
    if (typeof next === 'function') {
      return next(err);
    }
    throw err;
  }
  if (typeof next === 'function') {
    next();
  }
});

export const PlatformAuditLog: Model<IPlatformAuditLog> =
  (mongoose.models.PlatformAuditLog as Model<IPlatformAuditLog>) ||
  mongoose.model<IPlatformAuditLog>('PlatformAuditLog', platformAuditLogSchema);
