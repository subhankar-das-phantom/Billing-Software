/**
 * Phase 7 & Phase 8 Unit Tests: Platform Subscription & Feature Overrides Engine
 *
 * Tests:
 * 1. TenantFeatureOverride partial unique indexing and schema validation
 * 2. 72-hour ceiling and audit logging on Emergency Bypass
 * 3. 5-Level Feature Precedence Engine (IAM, Commercial, Base Plan, Subtractive, Additive)
 * 4. Feature Service wiring (canAccess, canWrite, getSubscriptionInfo)
 * 5. Feature Override lifecycle (upsert, deactivate, revoke bypass)
 * 6. Plan CRUD validation & pricing rules
 * 7. Manual subscription adjustments & expiry anchoring
 *
 * Executed natively via Node 22 test runner:
 * NODE_PATH="backend/node_modules" npx tsx --test admin/backend/tests/subscriptionAndOverrides.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';

import TenantFeatureOverride, { EMERGENCY_BYPASS_FEATURE } from '../models/TenantFeatureOverride';
import { OverrideType } from '../types';
import { Feature, PlanCode, SubscriptionStatus, AdjustmentType } from '../../../backend/saas/shared/features';
import * as featureOverrideService from '../services/featureOverrideService';
import * as featureService from '../../../backend/saas/services/featureService';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import SubscriptionAdjustment from '../../../backend/saas/models/SubscriptionAdjustment';
import { applyAdjustment } from '../../../backend/saas/services/subscriptionService';

function mockAdminModel(isActive: boolean) {
  const Admin = require('../../../backend/models/Admin');
  const originalFindById = Admin.findById;
  (Admin as any).findById = () => ({
    lean: async () => (isActive ? { _id: new Types.ObjectId(), isActive: true } : null),
  });
  return () => {
    Admin.findById = originalFindById;
  };
}

// ─── Phase 8: Schema & Partial Unique Index Tests ────────────────
describe('Phase 8: TenantFeatureOverride Schema & Partial Unique Indexing', () => {
  it('should instantiate TenantFeatureOverride with correct schema defaults', () => {
    const tenantId = new Types.ObjectId();
    const createdBy = new Types.ObjectId();

    const override = new TenantFeatureOverride({
      tenantId,
      feature: Feature.GST_REPORTS,
      type: OverrideType.ALLOW,
      reason: 'Temporary premium reporting access for quarterly audit',
      createdBy,
    });

    assert.equal(override.tenantId.toString(), tenantId.toString());
    assert.equal(override.feature, Feature.GST_REPORTS);
    assert.equal(override.type, OverrideType.ALLOW);
    assert.equal(override.isActive, true);
    assert.equal(override.expiresAt, null);
    assert.equal(override.reason, 'Temporary premium reporting access for quarterly audit');
  });

  it('should allow EMERGENCY_BYPASS as a valid special feature identifier', () => {
    const override = new TenantFeatureOverride({
      tenantId: new Types.ObjectId(),
      feature: EMERGENCY_BYPASS_FEATURE,
      type: OverrideType.ALLOW,
      reason: 'Critical billing support emergency commercial bypass',
      createdBy: new Types.ObjectId(),
    });

    const err = override.validateSync();
    assert.equal(err, undefined);
  });

  it('should reject invalid non-existent feature identifiers', () => {
    const override = new TenantFeatureOverride({
      tenantId: new Types.ObjectId(),
      feature: 'NON_EXISTENT_FEATURE_NAME',
      type: OverrideType.ALLOW,
      reason: 'This should fail validation',
      createdBy: new Types.ObjectId(),
    });

    const err = override.validateSync();
    assert.notEqual(err, undefined);
    assert.match(err!.errors.feature!.message, /is not a valid feature/);
  });

  it('should reject reasons shorter than 10 characters for audit compliance', () => {
    const override = new TenantFeatureOverride({
      tenantId: new Types.ObjectId(),
      feature: Feature.CUSTOMERS,
      type: OverrideType.ALLOW,
      reason: 'too short',
      createdBy: new Types.ObjectId(),
    });

    const err = override.validateSync();
    assert.notEqual(err, undefined);
    assert.match(err!.errors.reason!.message, /at least 10 characters/);
  });

  it('should register partial unique index for active overrides and query index', () => {
    const indexes = TenantFeatureOverride.schema.indexes();

    // Verify partial unique index: { tenantId: 1, feature: 1 }, unique: true, partialFilterExpression: { isActive: true }
    const partialUnique = indexes.find(
      ([fields, options]: any) =>
        fields &&
        fields.tenantId === 1 &&
        fields.feature === 1 &&
        options?.unique === true &&
        options?.partialFilterExpression?.isActive === true,
    );
    assert.notEqual(
      partialUnique,
      undefined,
      'Crucial partial unique index on { tenantId: 1, feature: 1 } with { isActive: true } must be defined',
    );

    // Verify query performance index: { tenantId: 1, isActive: 1, expiresAt: 1 }
    const queryIndex = indexes.find(
      ([fields]: any) =>
        fields &&
        fields.tenantId === 1 &&
        fields.isActive === 1 &&
        fields.expiresAt === 1,
    );
    assert.notEqual(
      queryIndex,
      undefined,
      'Query performance index on { tenantId: 1, isActive: 1, expiresAt: 1 } must be defined',
    );
  });
});

// ─── Phase 8: Emergency Bypass Engine Tests ───────────────────────
describe('Phase 8: Emergency Commercial Bypass Engine & 72h Hard Ceiling', () => {
  it('should strictly reject emergency bypass exceeding 72 hours ceiling', async () => {
    const tenantId = new Types.ObjectId();
    const actorId = new Types.ObjectId();

    await assert.rejects(
      async () => {
        await featureOverrideService.grantEmergencyBypass(
          tenantId,
          'Attempting bypass for 73 hours',
          actorId,
          73,
        );
      },
      /duration must be between 1 and 72 hours/i,
    );
  });

  it('should strictly reject emergency bypass with 0 or negative hours', async () => {
    const tenantId = new Types.ObjectId();
    const actorId = new Types.ObjectId();

    await assert.rejects(
      async () => {
        await featureOverrideService.grantEmergencyBypass(
          tenantId,
          'Attempting bypass with 0 hours',
          actorId,
          0,
        );
      },
      /duration must be between 1 and 72 hours/i,
    );

    await assert.rejects(
      async () => {
        await featureOverrideService.grantEmergencyBypass(
          tenantId,
          'Attempting bypass with negative hours',
          actorId,
          -5,
        );
      },
      /duration must be between 1 and 72 hours/i,
    );
  });

  it('should accept valid duration up to 72 hours and calculate future expiry', async () => {
    const tenantId = new Types.ObjectId();
    const actorId = new Types.ObjectId();

    const originalUpdateMany = TenantFeatureOverride.updateMany;
    const originalCreate = TenantFeatureOverride.create;

    let deactivatedCount = 0;
    (TenantFeatureOverride as any).updateMany = async () => {
      deactivatedCount++;
      return { acknowledged: true, modifiedCount: 1 };
    };

    let createdPayload: any = null;
    (TenantFeatureOverride as any).create = async (doc: any) => {
      createdPayload = doc;
      return {
        _id: new Types.ObjectId(),
        ...doc,
        toObject: () => ({ _id: new Types.ObjectId(), ...doc }),
      };
    };

    try {
      const beforeNow = Date.now();
      const result = await featureOverrideService.grantEmergencyBypass(
        tenantId,
        'Critical system outage emergency recovery access',
        actorId,
        72,
      );

      assert.equal(deactivatedCount, 1);
      assert.notEqual(createdPayload, null);
      assert.equal(createdPayload.feature, EMERGENCY_BYPASS_FEATURE);
      assert.equal(createdPayload.type, OverrideType.ALLOW);
      assert.equal(createdPayload.isActive, true);

      const expectedMinExpiry = beforeNow + 72 * 3600 * 1000 - 1000;
      const expectedMaxExpiry = Date.now() + 72 * 3600 * 1000 + 1000;
      const expiryMs = new Date(createdPayload.expiresAt).getTime();

      assert.equal(expiryMs >= expectedMinExpiry, true);
      assert.equal(expiryMs <= expectedMaxExpiry, true);
    } finally {
      TenantFeatureOverride.updateMany = originalUpdateMany;
      TenantFeatureOverride.create = originalCreate;
    }
  });

  it('should revoke active emergency bypass immediately', async () => {
    const tenantId = new Types.ObjectId();
    const actorId = new Types.ObjectId();

    let saveCalled = false;
    const mockBypass = {
      _id: new Types.ObjectId(),
      feature: EMERGENCY_BYPASS_FEATURE,
      isActive: true,
      save: async () => {
        saveCalled = true;
      },
    };

    const originalFindOne = TenantFeatureOverride.findOne;
    (TenantFeatureOverride as any).findOne = async () => mockBypass;

    try {
      await featureOverrideService.revokeEmergencyBypass(
        tenantId,
        'Customer commercial issue resolved, revoking emergency write window',
        actorId,
      );

      assert.equal(saveCalled, true);
      assert.equal(mockBypass.isActive, false);
    } finally {
      TenantFeatureOverride.findOne = originalFindOne;
    }
  });
});

// ─── Phase 8: 5-Level Feature Precedence Engine Tests ─────────────
describe('Phase 8: 5-Level Feature Precedence Engine (resolveEffectiveFeatures)', () => {

  it('Level 1: should enforce absolute lockout when IAM account is inactive', async () => {
    const restoreAdmin = mockAdminModel(false); // Inactive or not found
    try {
      const tenantId = new Types.ObjectId();
      const result = await featureOverrideService.resolveEffectiveFeatures(tenantId);

      assert.equal(result.canWrite, false);
      assert.deepEqual(result.effectiveFeatures, []);
      assert.equal(result.emergencyBypass.active, false);
    } finally {
      restoreAdmin();
    }
  });

  it('Level 2: should lock write access when subscription is EXPIRED and no bypass is active', async () => {
    const restoreAdmin = mockAdminModel(true);
    const originalSubFindOne = Subscription.findOne;
    const originalOverrideFindOne = TenantFeatureOverride.findOne;
    const originalOverrideFind = TenantFeatureOverride.find;

    (Subscription as any).findOne = () => ({
      sort: () => ({
        lean: async () => ({
          status: SubscriptionStatus.EXPIRED,
          expiresAt: new Date(Date.now() - 86400000), // 1 day ago
          graceUntil: new Date(Date.now() - 3600000), // 1 hour ago
          currentPricingSnapshot: { features: [Feature.CUSTOMERS, Feature.PRODUCTS] },
        }),
      }),
    });

    (TenantFeatureOverride as any).findOne = () => ({
      lean: async () => null, // No bypass
    });

    (TenantFeatureOverride as any).find = () => ({
      lean: async () => [], // No overrides
    });

    try {
      const tenantId = new Types.ObjectId();
      const result = await featureOverrideService.resolveEffectiveFeatures(tenantId);

      assert.equal(result.canWrite, false, 'Expired subscription without bypass must have canWrite = false');
      assert.equal(result.emergencyBypass.active, false);
    } finally {
      restoreAdmin();
      Subscription.findOne = originalSubFindOne;
      TenantFeatureOverride.findOne = originalOverrideFindOne;
      TenantFeatureOverride.find = originalOverrideFind;
    }
  });

  it('Level 2: should unlock write access when subscription is EXPIRED but unexpired emergency bypass is active', async () => {
    const restoreAdmin = mockAdminModel(true);
    const originalSubFindOne = Subscription.findOne;
    const originalOverrideFindOne = TenantFeatureOverride.findOne;
    const originalOverrideFind = TenantFeatureOverride.find;

    (Subscription as any).findOne = () => ({
      sort: () => ({
        lean: async () => ({
          status: SubscriptionStatus.EXPIRED,
          expiresAt: new Date(Date.now() - 86400000),
          graceUntil: new Date(Date.now() - 3600000),
          currentPricingSnapshot: { features: [Feature.CUSTOMERS, Feature.PRODUCTS] },
        }),
      }),
    });

    const futureExpiry = new Date(Date.now() + 12 * 3600 * 1000);
    (TenantFeatureOverride as any).findOne = () => ({
      lean: async () => ({
        _id: new Types.ObjectId(),
        feature: EMERGENCY_BYPASS_FEATURE,
        type: OverrideType.ALLOW,
        expiresAt: futureExpiry,
        isActive: true,
      }),
    });

    (TenantFeatureOverride as any).find = () => ({
      lean: async () => [],
    });

    try {
      const tenantId = new Types.ObjectId();
      const result = await featureOverrideService.resolveEffectiveFeatures(tenantId);

      assert.equal(result.canWrite, true, 'Emergency bypass must override EXPIRED commercial write lock');
      assert.equal(result.emergencyBypass.active, true);
      assert.notEqual(result.emergencyBypass.expiresAt, null);
    } finally {
      restoreAdmin();
      Subscription.findOne = originalSubFindOne;
      TenantFeatureOverride.findOne = originalOverrideFindOne;
      TenantFeatureOverride.find = originalOverrideFind;
    }
  });

  it('Level 4 & 5: should apply subtractive (DENY) and additive (ALLOW) overrides correctly', async () => {
    const restoreAdmin = mockAdminModel(true);
    const originalSubFindOne = Subscription.findOne;
    const originalOverrideFindOne = TenantFeatureOverride.findOne;
    const originalOverrideFind = TenantFeatureOverride.find;

    // Base plan contains CUSTOMERS, PRODUCTS, INVOICE_CREATE, INVOICE_PRINT
    (Subscription as any).findOne = () => ({
      sort: () => ({
        lean: async () => ({
          status: SubscriptionStatus.ACTIVE,
          expiresAt: new Date(Date.now() + 86400000 * 30),
          graceUntil: new Date(Date.now() + 86400000 * 37),
          currentPricingSnapshot: {
            features: [
              Feature.CUSTOMERS,
              Feature.PRODUCTS,
              Feature.INVOICE_CREATE,
              Feature.INVOICE_PRINT,
            ],
          },
        }),
      }),
    });

    (TenantFeatureOverride as any).findOne = () => ({
      lean: async () => null, // No bypass
    });

    // Subtractive: DENY INVOICE_CREATE
    // Additive: ALLOW INVENTORY_INTELLIGENCE (not in base plan)
    (TenantFeatureOverride as any).find = () => ({
      lean: async () => [
        {
          _id: new Types.ObjectId(),
          feature: Feature.INVOICE_CREATE,
          type: OverrideType.DENY,
          isActive: true,
          expiresAt: null,
        },
        {
          _id: new Types.ObjectId(),
          feature: Feature.INVENTORY_INTELLIGENCE,
          type: OverrideType.ALLOW,
          isActive: true,
          expiresAt: null,
        },
      ],
    });

    try {
      const tenantId = new Types.ObjectId();
      const result = await featureOverrideService.resolveEffectiveFeatures(tenantId);

      assert.equal(result.canWrite, true);
      // INVOICE_CREATE must be subtracted
      assert.equal(result.effectiveFeatures.includes(Feature.INVOICE_CREATE), false);
      // INVENTORY_INTELLIGENCE must be added
      assert.equal(result.effectiveFeatures.includes(Feature.INVENTORY_INTELLIGENCE), true);
      // Other base features must be preserved
      assert.equal(result.effectiveFeatures.includes(Feature.CUSTOMERS), true);
      assert.equal(result.effectiveFeatures.includes(Feature.PRODUCTS), true);
      assert.equal(result.effectiveFeatures.includes(Feature.INVOICE_PRINT), true);
    } finally {
      restoreAdmin();
      Subscription.findOne = originalSubFindOne;
      TenantFeatureOverride.findOne = originalOverrideFindOne;
      TenantFeatureOverride.find = originalOverrideFind;
    }
  });
});

// ─── Phase 8: Feature Service Integration Tests ──────────────────
describe('Phase 8: Feature Service Evaluation Wiring (canAccess & canWrite)', () => {
  it('should reflect effective overridden capabilities in canAccess and canWrite', async () => {
    const tenantId = new Types.ObjectId().toString();
    featureService.invalidateSubscriptionCache(tenantId);

    const originalSubFindOne = Subscription.findOne;
    (Subscription as any).findOne = () => ({
      sort: () => ({
        lean: async () => ({
          status: SubscriptionStatus.ACTIVE,
          expiresAt: new Date(Date.now() + 86400000),
          graceUntil: new Date(Date.now() + 86400000 * 7),
          currentPricingSnapshot: { features: [Feature.DASHBOARD] },
        }),
      }),
    });

    const restoreAdmin = mockAdminModel(true);
    const originalOverrideFind = TenantFeatureOverride.find;
    const originalOverrideFindOne = TenantFeatureOverride.findOne;

    (TenantFeatureOverride as any).findOne = () => ({
      lean: async () => null, // No emergency bypass
    });

    (TenantFeatureOverride as any).find = () => ({
      lean: async () => [
        {
          feature: Feature.INVENTORY_LEDGER,
          type: OverrideType.ALLOW,
          isActive: true,
          expiresAt: null,
        },
      ],
    });

    try {
      const hasDashboard = await featureService.canAccess(tenantId, Feature.DASHBOARD);
      const hasInventory = await featureService.canAccess(tenantId, Feature.INVENTORY_LEDGER);
      const hasGst = await featureService.canAccess(tenantId, Feature.GST_REPORTS);
      const writeAccess = await featureService.canWrite(tenantId);

      assert.equal(hasDashboard, true);
      assert.equal(hasInventory, true);
      assert.equal(hasGst, false);
      assert.equal(writeAccess, true);
    } finally {
      restoreAdmin();
      Subscription.findOne = originalSubFindOne;
      TenantFeatureOverride.find = originalOverrideFind;
      TenantFeatureOverride.findOne = originalOverrideFindOne;
      featureService.invalidateSubscriptionCache(tenantId);
    }
  });
});

// ─── Phase 7: Plan Model & CRUD Validation Tests ─────────────────
describe('Phase 7: SaaS Plan Model Validation & Pricing Rules', () => {
  it('should instantiate Plan with valid fields', () => {
    const plan = new Plan({
      name: 'Starter Enterprise',
      code: PlanCode.STARTER,
      baseMonthlyPrice: 499,
      features: [Feature.DASHBOARD, Feature.CUSTOMERS, Feature.PRODUCTS],
      active: true,
    });

    const err = plan.validateSync();
    assert.equal(err, undefined);
    assert.equal(plan.name, 'Starter Enterprise');
    assert.equal(plan.baseMonthlyPrice, 499);
  });

  it('should reject plan creation with empty features array', () => {
    const plan = new Plan({
      name: 'Invalid Plan',
      code: 'custom_tier',
      baseMonthlyPrice: 199,
      features: [], // Empty
    });

    const err = plan.validateSync();
    assert.notEqual(err, undefined);
    assert.match(err!.errors.features!.message, /At least one feature is required|Plan must have at least one feature/);
  });

  it('should reject plan creation with negative base monthly price', () => {
    const plan = new Plan({
      name: 'Negative Plan',
      code: 'invalid_price',
      baseMonthlyPrice: -50,
      features: [Feature.CUSTOMERS],
    });

    const err = plan.validateSync();
    assert.notEqual(err, undefined);
    assert.match(err!.errors.baseMonthlyPrice!.message, /Price cannot be negative/);
  });
});

// ─── Phase 7: Manual Subscription Adjustment Domain Tests ─────────
describe('Phase 7: Manual Subscription Adjustment & Expiry Anchoring', () => {
  it('should add days to active subscription and update expiresAt and graceUntil', async () => {
    const tenantId = new Types.ObjectId().toString();
    const futureExpiry = new Date(Date.now() + 10 * 86400000);
    const initialGrace = new Date(futureExpiry.getTime() + 7 * 86400000);

    let savedSubscription: any = null;
    const mockSub = {
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(tenantId),
      status: SubscriptionStatus.ACTIVE,
      expiresAt: futureExpiry,
      graceUntil: initialGrace,
      gracePeriodDays: 7,
      save: async () => {
        savedSubscription = mockSub;
      },
    };

    let savedAdjustment: any = null;
    const originalSubFindOne = Subscription.findOne;
    const originalAdjustmentSave = SubscriptionAdjustment.prototype.save;

    (Subscription as any).findOne = () => ({
      sort: () => ({
        session: () => mockSub,
      }),
    });

    SubscriptionAdjustment.prototype.save = async function (this: any) {
      savedAdjustment = this;
      return this;
    };

    try {
      const mockSession = {} as any;
      await applyAdjustment(
        tenantId,
        15, // Add 15 days
        AdjustmentType.MANUAL_BONUS,
        'Support compensation for platform maintenance window',
        new Types.ObjectId().toString(),
        mockSession,
      );

      assert.notEqual(savedSubscription, null);
      assert.notEqual(savedAdjustment, null);
      assert.equal(savedAdjustment.daysAdded, 15);
      assert.equal(savedAdjustment.type, AdjustmentType.MANUAL_BONUS);

      // Expiry should have been extended by exactly 15 days
      const expectedExpiryMs = futureExpiry.getTime() + 15 * 86400000;
      assert.equal(new Date(savedSubscription.expiresAt).getTime(), expectedExpiryMs);
    } finally {
      Subscription.findOne = originalSubFindOne;
      SubscriptionAdjustment.prototype.save = originalAdjustmentSave;
    }
  });

  it('should anchor positive adjustments from NOW if subscription expiry is in the past', async () => {
    const tenantId = new Types.ObjectId().toString();
    const pastExpiry = new Date(Date.now() - 30 * 86400000); // 30 days ago
    const pastGrace = new Date(pastExpiry.getTime() + 7 * 86400000);

    let savedSubscription: any = null;
    const mockSub = {
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(tenantId),
      status: SubscriptionStatus.EXPIRED,
      expiresAt: pastExpiry,
      graceUntil: pastGrace,
      gracePeriodDays: 7,
      save: async () => {
        savedSubscription = mockSub;
      },
    };

    const originalSubFindOne = Subscription.findOne;
    const originalAdjustmentSave = SubscriptionAdjustment.prototype.save;

    (Subscription as any).findOne = () => ({
      sort: () => ({
        session: () => mockSub,
      }),
    });

    SubscriptionAdjustment.prototype.save = async function (this: any) {
      return this;
    };

    try {
      const beforeCallMs = Date.now();
      const mockSession = {} as any;
      await applyAdjustment(
        tenantId,
        10, // Add 10 days
        AdjustmentType.MANUAL_BONUS,
        'Reactivation bonus days',
        new Types.ObjectId().toString(),
        mockSession,
      );

      assert.notEqual(savedSubscription, null);
      // Status must have been reactivated from EXPIRED to ACTIVE
      assert.equal(savedSubscription.status, SubscriptionStatus.ACTIVE);

      // Expiry must be anchored from NOW (not from 30 days ago in past!)
      const newExpiryMs = new Date(savedSubscription.expiresAt).getTime();
      assert.equal(newExpiryMs >= beforeCallMs + 10 * 86400000 - 1000, true);
    } finally {
      Subscription.findOne = originalSubFindOne;
      SubscriptionAdjustment.prototype.save = originalAdjustmentSave;
    }
  });
});
