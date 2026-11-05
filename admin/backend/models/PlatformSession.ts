/**
 * Bharat Enterprise Billing System — Platform Session Model
 * Stateful session tracking, revocation, and concurrency control.
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import { IPlatformSession } from '../types';

export type PlatformSessionDocument = HydratedDocument<IPlatformSession>;
export type PlatformSessionModel = Model<IPlatformSession>;

const platformSessionSchema = new Schema<IPlatformSession, PlatformSessionModel>(
  {
    platformUserId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
      required: [true, 'platformUserId is required'],
      index: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'tokenHash is required'],
      unique: true,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: [true, 'expiresAt is required'],
    },
    isRevoked: {
      type: Boolean,
      default: false,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for active session lookups & revocation sweeps
platformSessionSchema.index({ platformUserId: 1, isRevoked: 1, expiresAt: -1 });

// TTL index to automatically purge expired sessions from MongoDB
platformSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PlatformSession: PlatformSessionModel =
  (mongoose.models.PlatformSession as PlatformSessionModel) ||
  mongoose.model<IPlatformSession, PlatformSessionModel>('PlatformSession', platformSessionSchema);

export default PlatformSession;
