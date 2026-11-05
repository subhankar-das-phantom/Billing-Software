/**
 * Bharat Enterprise Billing System — Feature Override & Precedence Resolution Engine
 * Governs fine-grained tenant feature entitlements, subtractive/additive overrides,
 * and high-severity emergency bypass grants.
 */

import mongoose, { Types } from 'mongoose';
import TenantFeatureOverride, { EMERGENCY_BYPASS_FEATURE } from '../models/TenantFeatureOverride';
import PlatformUser from '../models/PlatformUser';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import { logPlatformAudit } from './platformAuditService';
import { invalidateSubscriptionCache } from '../../../backend/saas/services/featureService';
import { OverrideType, ITenantFeatureOverride } from '../types';
import { Feature, SubscriptionStatus } from '../../../backend/saas/shared/features';

export { EMERGENCY_BYPASS_FEATURE };

async function safeGetActor(actorId?: Types.ObjectId | null) {
  if (!actorId || mongoose.connection.readyState === 0) {
    return null;
  }
  try {
    return await PlatformUser.findById(actorId).lean();
  } catch {
    return null;
  }
}

async function safeAudit(params: Parameters<typeof logPlatformAudit>[0]) {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  try {
    await logPlatformAudit(params);
  } catch (err) {
    console.error('[PlatformAudit] Failed to log audit:', err);
  }
}

// Defensive retrieval of Admin model
function getAdminModel() {
  const mongoose = require('mongoose');
  if (mongoose.models.Admin) {
    return mongoose.models.Admin;
  }
  const loaded = require('../../../backend/models/Admin');
  return loaded.default || loaded;
}

export interface EffectiveFeaturesResult {
  effectiveFeatures: string[];
  canWrite: boolean;
  overridesApplied: ITenantFeatureOverride[];
  emergencyBypass: {
    active: boolean;
    expiresAt: Date | null;
  };
}

/**
 * Upsert a feature override for a given tenant.
 * Deactivates existing active override for this tenant-feature pair,
 * creates a new active override, invalidates cache, and logs audit record.
 */
export async function upsertFeatureOverride(
  tenantId: Types.ObjectId | string,
  feature: Feature | string,
  type: OverrideType | 'ALLOW' | 'DENY',
  reason: string,
  createdBy: Types.ObjectId | string,
  expiresAt?: Date | null,
): Promise<ITenantFeatureOverride> {
  const tenantObjId = new Types.ObjectId(tenantId.toString());
  const creatorObjId = new Types.ObjectId(createdBy.toString());

  // 1. Look up existing active override to record prior state in audit
  const existingActive = await TenantFeatureOverride.findOne({
    tenantId: tenantObjId,
    feature,
    isActive: true,
  }).lean();

  // 2. Deactivate existing active override
  if (existingActive) {
    await TenantFeatureOverride.updateOne(
      { _id: existingActive._id },
      { $set: { isActive: false } },
    );
  }

  // 3. Create new override document
  const created = await TenantFeatureOverride.create({
    tenantId: tenantObjId,
    feature,
    type: type as OverrideType,
    expiresAt: expiresAt || null,
    reason,
    createdBy: creatorObjId,
    isActive: true,
  });

  // 4. Invalidate cache
  invalidateSubscriptionCache(tenantObjId.toString());

  // 5. Log audit trail
  const actor = await safeGetActor(creatorObjId);
  await safeAudit({
    actorId: creatorObjId,
    actorEmail: actor?.email || 'platform@bharatenterprise.com',
    actorRole: actor?.role || 'PLATFORM_ADMIN',
    action: 'FEATURE_OVERRIDE.UPSERT',
    targetType: 'TenantFeatureOverride',
    targetId: created._id.toString(),
    targetTenantId: tenantObjId,
    reason,
    before: existingActive
      ? {
          _id: existingActive._id,
          feature: existingActive.feature,
          type: existingActive.type,
          expiresAt: existingActive.expiresAt,
        }
      : null,
    after: {
      _id: created._id,
      feature: created.feature,
      type: created.type,
      expiresAt: created.expiresAt,
      isActive: true,
    },
    severity: type === OverrideType.DENY ? 'WARNING' : 'INFO',
  });

  return created.toObject();
}

/**
 * Deactivates an active feature override.
 */
export async function deactivateFeatureOverride(
  overrideId: Types.ObjectId | string,
  reason: string,
  actorId: Types.ObjectId | string,
): Promise<ITenantFeatureOverride> {
  const overrideObjId = new Types.ObjectId(overrideId.toString());
  const actorObjId = new Types.ObjectId(actorId.toString());

  const override = await TenantFeatureOverride.findById(overrideObjId);
  if (!override) {
    throw new Error('Feature override not found');
  }

  const priorState = {
    _id: override._id,
    feature: override.feature,
    type: override.type,
    isActive: override.isActive,
    expiresAt: override.expiresAt,
  };

  override.isActive = false;
  await override.save();

  // Invalidate cache
  invalidateSubscriptionCache(override.tenantId.toString());

  // Log audit
  const actor = await safeGetActor(actorObjId);
  await safeAudit({
    actorId: actorObjId,
    actorEmail: actor?.email || 'platform@bharatenterprise.com',
    actorRole: actor?.role || 'PLATFORM_ADMIN',
    action: 'FEATURE_OVERRIDE.DEACTIVATE',
    targetType: 'TenantFeatureOverride',
    targetId: override._id.toString(),
    targetTenantId: override.tenantId,
    reason,
    before: priorState,
    after: { ...priorState, isActive: false },
    severity: 'INFO',
  });

  return override.toObject();
}

/**
 * Grants an emergency commercial bypass (up to 72 hours max) overriding
 * the write-lock for EXPIRED/SUSPENDED status.
 */
export async function grantEmergencyBypass(
  tenantId: Types.ObjectId | string,
  reason: string,
  actorId: Types.ObjectId | string,
  durationHours: number = 12,
): Promise<ITenantFeatureOverride> {
  const tenantObjId = new Types.ObjectId(tenantId.toString());
  const actorObjId = new Types.ObjectId(actorId.toString());

  // Enforce hard ceiling of 72 hours
  if (!durationHours || durationHours <= 0 || durationHours > 72) {
    throw new Error(
      `Emergency bypass duration must be between 1 and 72 hours. Requested: ${durationHours}h`,
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

  // Deactivate any existing active emergency bypass
  await TenantFeatureOverride.updateMany(
    {
      tenantId: tenantObjId,
      feature: EMERGENCY_BYPASS_FEATURE,
      isActive: true,
    },
    { $set: { isActive: false } },
  );

  // Create active bypass record
  const bypass = await TenantFeatureOverride.create({
    tenantId: tenantObjId,
    feature: EMERGENCY_BYPASS_FEATURE,
    type: OverrideType.ALLOW,
    expiresAt,
    reason,
    createdBy: actorObjId,
    isActive: true,
  });

  // Invalidate cache
  invalidateSubscriptionCache(tenantObjId.toString());

  // Log high-severity audit log
  const actor = await safeGetActor(actorObjId);
  await safeAudit({
    actorId: actorObjId,
    actorEmail: actor?.email || 'platform@bharatenterprise.com',
    actorRole: actor?.role || 'PLATFORM_OWNER',
    action: 'TENANT.EMERGENCY_BYPASS_GRANTED',
    targetType: 'Tenant',
    targetId: tenantObjId.toString(),
    targetTenantId: tenantObjId,
    reason,
    after: {
      bypassId: bypass._id,
      durationHours,
      expiresAt,
      feature: EMERGENCY_BYPASS_FEATURE,
    },
    severity: 'CRITICAL',
  });

  return bypass.toObject();
}

/**
 * Revokes active emergency bypass immediately.
 */
export async function revokeEmergencyBypass(
  tenantId: Types.ObjectId | string,
  reason: string,
  actorId: Types.ObjectId | string,
): Promise<void> {
  const tenantObjId = new Types.ObjectId(tenantId.toString());
  const actorObjId = new Types.ObjectId(actorId.toString());

  const activeBypass = await TenantFeatureOverride.findOne({
    tenantId: tenantObjId,
    feature: EMERGENCY_BYPASS_FEATURE,
    isActive: true,
  });

  if (!activeBypass) {
    return;
  }

  activeBypass.isActive = false;
  await activeBypass.save();

  // Invalidate cache
  invalidateSubscriptionCache(tenantObjId.toString());

  // Log audit
  const actor = await safeGetActor(actorObjId);
  await safeAudit({
    actorId: actorObjId,
    actorEmail: actor?.email || 'platform@bharatenterprise.com',
    actorRole: actor?.role || 'PLATFORM_OWNER',
    action: 'TENANT.EMERGENCY_BYPASS_REVOKED',
    targetType: 'Tenant',
    targetId: tenantObjId.toString(),
    targetTenantId: tenantObjId,
    reason,
    severity: 'WARNING',
  });
}

/**
 * Resolves effective features and write privileges with 5-level precedence:
 * Level 1: IAM Active (Admin.isActive). If false -> canWrite = false, features = [].
 * Level 2: Commercial Status (Subscription.status). If EXPIRED/SUSPENDED, check active emergency bypass.
 * Level 3: Base Plan features (Plan.findById(subscription.planId).features).
 * Level 4: Subtractive overrides (remove active unexpired DENY features).
 * Level 5: Additive overrides (add active unexpired ALLOW features).
 */
export async function resolveEffectiveFeatures(
  tenantId: Types.ObjectId | string,
): Promise<EffectiveFeaturesResult> {
  const tenantObjId = new Types.ObjectId(tenantId.toString());
  const now = new Date();

  // ─── Level 1: IAM Active Verification ──────────────────────────
  const Admin = getAdminModel();
  const tenantAdmin = await Admin.findById(tenantObjId).lean();

  if (!tenantAdmin || tenantAdmin.isActive === false) {
    return {
      effectiveFeatures: [],
      canWrite: false,
      overridesApplied: [],
      emergencyBypass: {
        active: false,
        expiresAt: null,
      },
    };
  }

  // ─── Level 2: Commercial Status & Emergency Bypass ─────────────
  const subscription = await Subscription.findOne({
    tenantId: tenantObjId,
    status: {
      $in: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.GRACE,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.SUSPENDED,
      ],
    },
  })
    .sort({ createdAt: -1 })
    .lean();

  let actualStatus = subscription
    ? (subscription.status as SubscriptionStatus)
    : SubscriptionStatus.EXPIRED;

  if (subscription && actualStatus !== SubscriptionStatus.SUSPENDED) {
    const expiresAt = new Date(subscription.expiresAt);
    const graceUntil = new Date(subscription.graceUntil);
    if (now <= expiresAt) {
      actualStatus =
        subscription.status === SubscriptionStatus.TRIAL ||
        subscription.status === SubscriptionStatus.ACTIVE
          ? subscription.status
          : SubscriptionStatus.ACTIVE;
    } else if (now <= graceUntil) {
      actualStatus = SubscriptionStatus.GRACE;
    } else {
      actualStatus = SubscriptionStatus.EXPIRED;
    }
  }

  // Check active emergency bypass (strictly require ALLOW type and unexpired lease)
  const bypassDoc = await TenantFeatureOverride.findOne({
    tenantId: tenantObjId,
    feature: EMERGENCY_BYPASS_FEATURE,
    type: OverrideType.ALLOW,
    isActive: true,
    expiresAt: { $gt: now },
  }).lean();

  const emergencyBypass = {
    active: !!bypassDoc,
    expiresAt: bypassDoc?.expiresAt ? new Date(bypassDoc.expiresAt) : null,
  };

  let canWrite = false;
  if (
    actualStatus === SubscriptionStatus.ACTIVE ||
    actualStatus === SubscriptionStatus.TRIAL ||
    actualStatus === SubscriptionStatus.GRACE
  ) {
    canWrite = true;
  } else if (
    actualStatus === SubscriptionStatus.EXPIRED ||
    actualStatus === SubscriptionStatus.SUSPENDED
  ) {
    // Overridden by emergency bypass
    canWrite = emergencyBypass.active;
  }

  // ─── Level 3: Base Plan Features ───────────────────────────────
  let baseFeatures: string[] = [];

  if (subscription?.planId) {
    const planDoc = await Plan.findById(subscription.planId).lean();
    if (planDoc && Array.isArray(planDoc.features)) {
      baseFeatures = [...planDoc.features];
    } else if (subscription.currentPricingSnapshot?.features) {
      baseFeatures = [...subscription.currentPricingSnapshot.features];
    }
  } else if (subscription?.currentPricingSnapshot?.features) {
    baseFeatures = [...subscription.currentPricingSnapshot.features];
  }

  // ─── Levels 4 & 5: Active Unexpired Feature Overrides ──────────
  const activeOverrides = await TenantFeatureOverride.find({
    tenantId: tenantObjId,
    feature: { $ne: EMERGENCY_BYPASS_FEATURE },
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();

  const denyFeatures = new Set(
    activeOverrides
      .filter((o) => o.type === OverrideType.DENY)
      .map((o) => o.feature),
  );

  const allowFeatures = activeOverrides
    .filter((o) => o.type === OverrideType.ALLOW)
    .map((o) => o.feature);

  // Level 4: Subtractive overrides (strip DENY features)
  const effectiveSet = new Set(baseFeatures.filter((f) => !denyFeatures.has(f)));

  // Level 5: Additive overrides (add ALLOW features)
  for (const feature of allowFeatures) {
    effectiveSet.add(feature);
  }

  const overridesApplied = bypassDoc
    ? ([...activeOverrides, bypassDoc] as unknown as ITenantFeatureOverride[])
    : (activeOverrides as unknown as ITenantFeatureOverride[]);

  return {
    effectiveFeatures: Array.from(effectiveSet),
    canWrite,
    overridesApplied,
    emergencyBypass,
  };
}
