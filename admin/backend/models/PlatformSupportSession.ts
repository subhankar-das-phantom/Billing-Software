/**
 * Bharat Enterprise Billing System — Platform Support Session Model
 * Scoped, time-bounded, non-impersonating diagnostic session tracking.
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import { IPlatformSupportSession, SupportSessionStatus, PlatformPermission } from '../types';

export type PlatformSupportSessionDocument = HydratedDocument<IPlatformSupportSession>;
export type PlatformSupportSessionModel = Model<IPlatformSupportSession>;

const platformSupportSessionSchema = new Schema<IPlatformSupportSession, PlatformSupportSessionModel>(
  {
    sessionCode: {
      type: String,
      required: [true, 'sessionCode is required'],
      unique: true,
      trim: true,
      match: [/^SUP-\d{8}-[A-Za-z0-9]{4,}$/, 'Invalid sessionCode format (must be SUP-YYYYMMDD-XXXX)'],
    },
    operatorId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
      required: [true, 'operatorId is required'],
      index: true,
    },
    targetTenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'targetTenantId is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'reason is required'],
      minlength: [10, 'Reason must be at least 10 characters'],
      trim: true,
    },
    permissionsSnapshot: {
      type: [String],
      enum: Object.values(PlatformPermission),
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(SupportSessionStatus),
      default: SupportSessionStatus.ACTIVE,
      required: true,
    },
    isReadOnly: {
      type: Boolean,
      default: true,
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'expiresAt is required'],
    },
    endedAt: {
      type: Date,
      default: null,
    },
    endedBy: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
      default: null,
    },
    actionsPerformed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant lookups & lifecycle sweeps
platformSupportSessionSchema.index({ operatorId: 1, status: 1 });
platformSupportSessionSchema.index({ targetTenantId: 1, createdAt: -1 });
platformSupportSessionSchema.index({ status: 1, expiresAt: 1 });

export const PlatformSupportSession: PlatformSupportSessionModel =
  (mongoose.models.PlatformSupportSession as PlatformSupportSessionModel) ||
  mongoose.model<IPlatformSupportSession, PlatformSupportSessionModel>(
    'PlatformSupportSession',
    platformSupportSessionSchema
  );

export default PlatformSupportSession;
