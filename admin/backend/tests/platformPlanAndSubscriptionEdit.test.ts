/**
 * Bharat Enterprise Billing System — Platform Plan & Subscription Edit Test Suite
 *
 * Test Coverage:
 * 1. Plan CRUD: creation with feature checklist, editing price/description/features,
 *    displayOrder sorting, and audit log emission with before/after state.
 * 2. Subscription direct update: updating plan tier, custom expiry date, status transitions,
 *    auto-renew toggle, grace period days, and 10-character reason validation.
 *
 * Executed natively via tsx / node:test:
 * npx tsx admin/backend/tests/platformPlanAndSubscriptionEdit.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import Plan from '../../../backend/saas/models/Plan';
import Subscription from '../../../backend/saas/models/Subscription';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformAuditHead } from '../models/PlatformAuditHead';
import { Feature, SubscriptionStatus } from '../../../backend/saas/shared/features';
import * as platformPlanController from '../controllers/platformPlanController';
import * as platformSubscriptionController from '../controllers/platformSubscriptionController';

// Helper mock response
function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

let capturedAuditLogs: any[] = [];

describe('Platform Plan & Subscription Edit Test Suite', () => {
  beforeEach(() => {
    capturedAuditLogs = [];

    // Mock Audit Service Head & Log DB calls to execute synchronously with zero network latency
    PlatformAuditHead.findOne = (() => ({
      session: async () => ({ lastSequence: 10, lastHash: 'prev_hash_10' }),
      lean: async () => ({ lastSequence: 10, lastHash: 'prev_hash_10' }),
    })) as any;

    PlatformAuditHead.findOneAndUpdate = (() => ({
      session: async () => ({ lastSequence: 11, lastHash: 'new_hash_11' }),
    })) as any;

    PlatformAuditLog.create = (async (docs: any) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      capturedAuditLogs.push(...arr);
      return arr.map((d: any) => ({ ...d, _id: new Types.ObjectId() })) as any;
    }) as any;
  });

  // ═════════════════════════════════════════════════════════════════════
  // 1. Plan CRUD & Validation
  // ═════════════════════════════════════════════════════════════════════
  describe('1. Plan CRUD & Feature Checklist Administration', () => {
    it('1.1 should create a new plan with valid features and emit audit log', async () => {
      const origPlanFindOne = Plan.findOne;
      const origPlanCreate = Plan.create;

      (Plan as any).findOne = () => ({
        lean: async () => null, // Code not taken
      });

      const mockCreatedPlan = {
        _id: new Types.ObjectId(),
        name: 'Enterprise Growth Tier',
        code: 'growth',
        description: 'Advanced enterprise capabilities with real-time analytics',
        baseMonthlyPrice: 2499,
        features: [Feature.DASHBOARD, Feature.CUSTOMERS, Feature.PRODUCTS, Feature.INVENTORY_INTELLIGENCE],
        active: true,
        displayOrder: 4,
        metadata: { badge: 'POPULAR' },
      };

      (Plan as any).create = async (doc: any) => ({
        ...mockCreatedPlan,
        ...doc,
      });

      const req: any = {
        platformUser: {
          _id: new Types.ObjectId().toString(),
          email: 'admin@bharatenterprise.com',
          role: 'PLATFORM_OWNER',
        },
        body: {
          name: 'Enterprise Growth Tier',
          code: 'growth',
          description: 'Advanced enterprise capabilities with real-time analytics',
          baseMonthlyPrice: 2499,
          features: [Feature.DASHBOARD, Feature.CUSTOMERS, Feature.PRODUCTS, Feature.INVENTORY_INTELLIGENCE],
          displayOrder: 4,
          reason: 'Introducing Q3 Growth SaaS Tier for mid-market retail distributors',
        },
      };

      const res = createMockRes();
      let nextError: any = null;
      await platformPlanController.createPlan(req, res, (err) => {
        nextError = err;
      });

      assert.equal(nextError, null);
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.code, 'growth');
      assert.equal(res.body.data.baseMonthlyPrice, 2499);
      assert.equal(res.body.data.features.length, 4);

      // Verify Audit Log Emission
      assert.ok(capturedAuditLogs.length >= 1);
      const auditLog = capturedAuditLogs.find((l) => l.action === 'PLAN.CREATE');
      assert.ok(auditLog);
      assert.equal(auditLog.targetType, 'Plan');
      assert.equal(auditLog.after.code, 'growth');

      Plan.findOne = origPlanFindOne;
      Plan.create = origPlanCreate;
    });

    it('1.2 should reject invalid features not in the canonical Feature checklist enum', async () => {
      const req: any = {
        platformUser: { role: 'PLATFORM_ADMIN' },
        body: {
          name: 'Illegal Plan',
          code: 'illegal',
          baseMonthlyPrice: 999,
          features: [Feature.DASHBOARD, 'INVALID_UNKNOWN_FEATURE_KEY'],
          reason: 'Testing feature validation rules',
        },
      };

      const res = createMockRes();
      await platformPlanController.createPlan(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid features specified/i);
    });

    it('1.3 should reject negative pricing or non-numeric baseMonthlyPrice', async () => {
      const req: any = {
        platformUser: { role: 'PLATFORM_ADMIN' },
        body: {
          name: 'Negative Plan',
          code: 'negative',
          baseMonthlyPrice: -500,
          features: [Feature.DASHBOARD],
          reason: 'Testing negative price validation',
        },
      };

      const res = createMockRes();
      await platformPlanController.createPlan(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /baseMonthlyPrice must be a non-negative number/i);
    });

    it('1.4 should update an existing plan, update pricing/features, and log before/after diff', async () => {
      const planId = new Types.ObjectId();
      const mockPlanInstance: any = {
        _id: planId,
        name: 'Starter Tier Old',
        code: 'starter',
        description: 'Old desc',
        baseMonthlyPrice: 499,
        features: [Feature.DASHBOARD, Feature.CUSTOMERS],
        active: true,
        displayOrder: 1,
        toObject() {
          return {
            name: this.name,
            code: this.code,
            baseMonthlyPrice: this.baseMonthlyPrice,
            features: [...this.features],
            active: this.active,
          };
        },
        save: async () => mockPlanInstance,
      };

      const origFindById = Plan.findById;
      (Plan as any).findById = async () => mockPlanInstance;

      const req: any = {
        params: { id: planId.toString() },
        platformUser: {
          _id: new Types.ObjectId().toString(),
          email: 'admin@bharatenterprise.com',
          role: 'PLATFORM_OWNER',
        },
        body: {
          name: 'Starter Tier 2026',
          baseMonthlyPrice: 599,
          features: [Feature.DASHBOARD, Feature.CUSTOMERS, Feature.PRODUCTS],
          displayOrder: 2,
          reason: 'Annual inflation adjustment and added catalog module',
        },
      };

      const res = createMockRes();
      let nextError: any = null;
      await platformPlanController.updatePlan(req, res, (err) => {
        nextError = err;
      });

      assert.equal(nextError, null);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(mockPlanInstance.name, 'Starter Tier 2026');
      assert.equal(mockPlanInstance.baseMonthlyPrice, 599);
      assert.equal(mockPlanInstance.features.length, 3);

      // Verify Audit Log Before / After diff
      assert.ok(capturedAuditLogs.length >= 1);
      const auditLog = capturedAuditLogs.find((l) => l.action === 'PLAN.UPDATE');
      assert.ok(auditLog);
      assert.equal(auditLog.before.baseMonthlyPrice, 499);
      assert.equal(auditLog.after.baseMonthlyPrice, 599);

      Plan.findById = origFindById;
    });

    it('1.5 should sort plans by displayOrder ascending', async () => {
      const origFind = Plan.find;
      (Plan as any).find = () => ({
        sort: (sortObj: any) => {
          assert.equal(sortObj.displayOrder, 1);
          return {
            lean: async () => [
              { code: 'starter', displayOrder: 1 },
              { code: 'business', displayOrder: 2 },
              { code: 'professional', displayOrder: 3 },
            ],
          };
        },
      });

      const req: any = { query: {} };
      const res = createMockRes();
      await platformPlanController.listPlans(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 3);
      assert.equal(res.body.data[0].code, 'starter');
      assert.equal(res.body.data[2].code, 'professional');

      Plan.find = origFind;
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  // 2. Subscription Direct Update
  // ═════════════════════════════════════════════════════════════════════
  describe('2. Subscription Direct Update & Operational Governance', () => {
    it('2.1 should reject subscription updates lacking a 10-char operational justification reason', async () => {
      const req: any = {
        params: { id: new Types.ObjectId().toString() },
        platformUser: { role: 'PLATFORM_ADMIN' },
        body: {
          status: SubscriptionStatus.ACTIVE,
          reason: 'Too short', // < 10 chars
        },
      };

      const res = createMockRes();
      await platformSubscriptionController.updateSubscription(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /minimum 10 characters/i);
    });

    it('2.2 should update subscription plan tier, expiry date, status, auto-renew, and grace period', async () => {
      const subId = new Types.ObjectId();
      const tenantId = new Types.ObjectId();
      const oldPlanId = new Types.ObjectId();
      const newPlanId = new Types.ObjectId();

      const origSubFindById = Subscription.findById;
      const origPlanFindOne = Plan.findOne;

      (Plan as any).findOne = () => ({
        lean: async () => ({
          _id: newPlanId,
          code: 'professional',
          name: 'Professional Tier',
        }),
      });

      const now = new Date();
      const initialExpires = new Date(now.getTime() + 5 * 86400000);
      const targetExpires = new Date(now.getTime() + 60 * 86400000);

      const mockSubInstance: any = {
        _id: subId,
        tenantId,
        planId: oldPlanId,
        status: SubscriptionStatus.TRIAL,
        expiresAt: initialExpires,
        graceUntil: null,
        autoRenew: false,
        toObject() {
          return {
            planId: this.planId,
            status: this.status,
            expiresAt: this.expiresAt,
            graceUntil: this.graceUntil,
            autoRenew: this.autoRenew,
          };
        },
        save: async () => mockSubInstance,
      };

      (Subscription as any).findById = async () => mockSubInstance;

      const req: any = {
        params: { id: subId.toString() },
        platformUser: {
          _id: new Types.ObjectId().toString(),
          email: 'support@bharatenterprise.com',
          role: 'SUPPORT_ADMIN',
        },
        body: {
          planCode: 'professional',
          status: SubscriptionStatus.ACTIVE,
          expiresAt: targetExpires.toISOString(),
          autoRenew: true,
          graceDays: 14,
          reason: 'Manual enterprise upgrade approved under contract #ENT-2026-99',
        },
      };

      const res = createMockRes();
      let nextError: any = null;
      await platformSubscriptionController.updateSubscription(req, res, (err) => {
        nextError = err;
      });

      assert.equal(nextError, null);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(mockSubInstance.planId.toString(), newPlanId.toString());
      assert.equal(mockSubInstance.status, SubscriptionStatus.ACTIVE);
      assert.equal(mockSubInstance.autoRenew, true);
      assert.equal(mockSubInstance.expiresAt.getTime(), targetExpires.getTime());
      assert.ok(mockSubInstance.graceUntil instanceof Date);

      // Verify Audit Log
      assert.ok(capturedAuditLogs.length >= 1);
      const auditLog = capturedAuditLogs.find((l) => l.action === 'SUBSCRIPTION.UPDATE');
      assert.ok(auditLog);
      assert.equal(auditLog.targetType, 'Subscription');
      assert.equal(auditLog.targetId, subId.toString());
      assert.equal(auditLog.before.status, SubscriptionStatus.TRIAL);
      assert.equal(auditLog.after.status, SubscriptionStatus.ACTIVE);
      assert.equal(auditLog.reason, 'Manual enterprise upgrade approved under contract #ENT-2026-99');

      Subscription.findById = origSubFindById;
      Plan.findOne = origPlanFindOne;
    });

    it('2.3 should reject invalid subscription status transitions', async () => {
      const origSubFindById = Subscription.findById;
      (Subscription as any).findById = async () => ({
        _id: new Types.ObjectId(),
        toObject: () => ({}),
      });

      const req: any = {
        params: { id: new Types.ObjectId().toString() },
        platformUser: { role: 'PLATFORM_ADMIN' },
        body: {
          status: 'NON_EXISTENT_STATUS_VAL',
          reason: 'Attempting invalid status transition test',
        },
      };

      const res = createMockRes();
      await platformSubscriptionController.updateSubscription(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid status/i);

      Subscription.findById = origSubFindById;
    });
  });
});
