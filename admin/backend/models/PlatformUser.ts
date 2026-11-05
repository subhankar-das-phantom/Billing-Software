/**
 * Bharat Enterprise Billing System — Platform User Model
 * Identity root for Super Admin & Platform Control Plane operators.
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IPlatformUser, PlatformRole, PlatformPermission } from '../types';

export interface IPlatformUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type PlatformUserDocument = HydratedDocument<IPlatformUser, IPlatformUserMethods>;
export type PlatformUserModel = Model<IPlatformUser, {}, IPlatformUserMethods>;

const platformUserSchema = new Schema<IPlatformUser, PlatformUserModel, IPlatformUserMethods>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(PlatformRole),
      default: PlatformRole.READ_ONLY,
      required: true,
    },
    customPermissions: {
      type: [String],
      enum: Object.values(PlatformPermission),
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
      required: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      required: true,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    mfaSecret: {
      type: String,
      select: false,
      default: null,
    },
    mfaBackupCodes: [
      {
        codeHash: { type: String, required: true },
        usedAt: { type: Date, default: null },
      },
    ],
    lastLoginAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
platformUserSchema.index({ isActive: 1, role: 1, createdAt: -1 });

// Pre-save bcrypt hook (12 rounds) on password modification
platformUserSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare candidate password
platformUserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidate, this.password);
};

export const PlatformUser: PlatformUserModel =
  (mongoose.models.PlatformUser as PlatformUserModel) ||
  mongoose.model<IPlatformUser, PlatformUserModel>('PlatformUser', platformUserSchema);

export default PlatformUser;
