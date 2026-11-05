/**
 * Bharat Enterprise Billing System — Tenant Feature Override Model
 * Fine-grained per-tenant feature gating & temporary capability overrides.
 *
 * Enforces partial unique indexing so at most one ACTIVE override exists
 * per feature per tenant, while preserving an immutable historical audit trail
 * of deactivated and expired overrides.
 */

import mongoose, { Schema } from 'mongoose';
import { Feature } from '../../../backend/saas/shared/features';
import { OverrideType, ITenantFeatureOverride } from '../types';

export const EMERGENCY_BYPASS_FEATURE = 'EMERGENCY_BYPASS';

const validFeatures = [...Object.values(Feature), EMERGENCY_BYPASS_FEATURE];

const tenantFeatureOverrideSchema = new Schema<ITenantFeatureOverride>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    feature: {
      type: String,
      required: [true, 'Feature identifier is required'],
      validate: {
        validator: (val: string) => validFeatures.includes(val as any),
        message: (props: { value: string }) => `"${props.value}" is not a valid feature or bypass identifier`,
      },
    },
    type: {
      type: String,
      enum: Object.values(OverrideType),
      required: [true, 'Override type is required (ALLOW | DENY)'],
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      required: [true, 'Operational reason is required'],
      trim: true,
      minlength: [10, 'Reason must be at least 10 characters long'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
      required: [true, 'Creator operator ID is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// ─── Crucial Partial Unique Index ─────────────────────────────────
// Allows unlimited historical inactive overrides while strictly enforcing
// at most ONE active override per feature per tenant.
tenantFeatureOverrideSchema.index(
  { tenantId: 1, feature: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

// ─── Query Performance Index for Precedence Resolution ────────────
tenantFeatureOverrideSchema.index({ tenantId: 1, isActive: 1, expiresAt: 1 });

export const TenantFeatureOverride = mongoose.models.TenantFeatureOverride ||
  mongoose.model<ITenantFeatureOverride>('TenantFeatureOverride', tenantFeatureOverrideSchema);

export default TenantFeatureOverride;
