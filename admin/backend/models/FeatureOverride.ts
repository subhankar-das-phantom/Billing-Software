/**
 * Bharat Enterprise Billing System — Feature Override Model
 *
 * Provides fine-grained tenant-level feature flag overrides and numerical limits
 * with mathematical bounds checking and strict integer sanitization.
 */

import mongoose, { Schema, Model, HydratedDocument, Types } from 'mongoose';

export interface IFeatureOverride {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  featureKey: string;
  isEnabled: boolean;
  limitValue: number | null;
  expiresAt: Date | null;
  reason: string;
  createdBy: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  isExpired(currentDate?: Date): boolean;
}

export type FeatureOverrideDocument = HydratedDocument<IFeatureOverride>;
export type FeatureOverrideModel = Model<IFeatureOverride>;

/**
 * Validates and sanitizes numeric limits against integer bounds, overflow, and nan/infinity hazards.
 */
export function validateLimitValue(val: unknown): {
  valid: boolean;
  value: number | null;
  error?: string;
} {
  if (val === null || val === undefined) {
    return { valid: true, value: null };
  }

  // Reject non-number types (e.g. strings, booleans, objects)
  if (typeof val !== 'number') {
    return {
      valid: false,
      value: null,
      error: `limitValue must be a numeric integer or null; received type ${typeof val} (${JSON.stringify(val)})`,
    };
  }

  // Reject non-finite values (NaN, Infinity, -Infinity)
  if (!Number.isFinite(val) || Number.isNaN(val)) {
    return {
      valid: false,
      value: null,
      error: `limitValue must be a finite number; received ${val}`,
    };
  }

  // Reject negative numbers
  if (val < 0) {
    return {
      valid: false,
      value: null,
      error: `limitValue cannot be negative; received ${val}`,
    };
  }

  // Reject non-integer floating points
  if (!Number.isInteger(val)) {
    return {
      valid: false,
      value: null,
      error: `limitValue must be an integer, not floating point; received ${val}`,
    };
  }

  // Reject values exceeding IEEE 754 safe integer bounds
  if (val > Number.MAX_SAFE_INTEGER) {
    return {
      valid: false,
      value: null,
      error: `limitValue cannot exceed Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); received ${val}`,
    };
  }

  return { valid: true, value: val };
}

const featureOverrideSchema = new Schema<IFeatureOverride, FeatureOverrideModel>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'tenantId is required'],
      index: true,
    },
    featureKey: {
      type: String,
      required: [true, 'featureKey is required'],
      trim: true,
    },
    isEnabled: {
      type: Boolean,
      required: [true, 'isEnabled is required'],
      default: true,
    },
    limitValue: {
      type: Number,
      default: null,
      validate: {
        validator: function (val: any) {
          const check = validateLimitValue(val);
          return check.valid;
        },
        message: function (props: any) {
          const check = validateLimitValue(props.value);
          return check.error || `Invalid limitValue: ${props.value}`;
        },
      },
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      required: [true, 'Reason is required for audit compliance'],
      trim: true,
      minlength: [10, 'Reason must be at least 10 characters long'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
      required: [true, 'createdBy operator ID is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Method: isExpired
featureOverrideSchema.methods.isExpired = function (
  this: IFeatureOverride,
  currentDate: Date = new Date(),
): boolean {
  if (!this.expiresAt) return false;
  return new Date(this.expiresAt).getTime() <= currentDate.getTime();
};

// ─── Partial Unique Index ─────────────────────────────────────────
// At most one ACTIVE override per featureKey per tenant
featureOverrideSchema.index(
  { tenantId: 1, featureKey: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

// Query index for precedence resolution sweeps
featureOverrideSchema.index({ tenantId: 1, isActive: 1, expiresAt: 1 });

export const FeatureOverride: FeatureOverrideModel =
  (mongoose.models.FeatureOverride as FeatureOverrideModel) ||
  mongoose.model<IFeatureOverride, FeatureOverrideModel>('FeatureOverride', featureOverrideSchema);

export default FeatureOverride;
