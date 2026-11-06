/**
 * Bharat Enterprise Billing System — Platform Offer Campaigns Test Suite
 *
 * Test Coverage:
 * 1. Campaign model validation: title/message limits, dates (expiresAt > startsAt), discount bounds.
 * 2. Campaign CRUD endpoints: list, get, create, update, delete/deactivate.
 * 3. Audience targeting logic (ALL_TENANTS, BY_PLAN, BY_STATUS, SPECIFIC_TENANTS).
 * 4. Broadcast notification delivery into Notification collection.
 *
 * Executed natively via tsx / node:test:
 * npx tsx admin/backend/tests/platformOfferCampaigns.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import PlatformOfferCampaign, {
  CampaignType,
  TargetAudience,
  CampaignDiscountType,
  BannerStyle,
  CampaignPriority,
} from '../models/PlatformOfferCampaign';
import Campaign, { CampaignBadge } from '../../../backend/saas/models/Campaign';
import Notification from '../../../backend/saas/models/Notification';
import Plan from '../../../backend/saas/models/Plan';
import Subscription from '../../../backend/saas/models/Subscription';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformAuditHead } from '../models/PlatformAuditHead';
import * as platformCampaignController from '../controllers/platformCampaignController';

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

describe('Platform Offer Campaigns Test Suite', () => {
  beforeEach(() => {
    capturedAuditLogs = [];

    // Mock Audit Service Head & Log DB calls
    PlatformAuditHead.findOne = (() => ({
      session: async () => ({ lastSequence: 50, lastHash: 'prev_hash_50' }),
      lean: async () => ({ lastSequence: 50, lastHash: 'prev_hash_50' }),
    })) as any;

    PlatformAuditHead.findOneAndUpdate = (() => ({
      session: async () => ({ lastSequence: 51, lastHash: 'new_hash_51' }),
    })) as any;

    PlatformAuditLog.create = (async (docs: any) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      capturedAuditLogs.push(...arr);
      return arr.map((d: any) => ({ ...d, _id: new Types.ObjectId() })) as any;
    }) as any;
  });

  // ═════════════════════════════════════════════════════════════════════
  // 1. Campaign Model Validation
  // ═════════════════════════════════════════════════════════════════════
  describe('1. Campaign Model Validation Rules', () => {
    it('1.1 should instantiate a valid PlatformOfferCampaign with defaults', () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 7 * 86400000);

      const campaign = new PlatformOfferCampaign({
        title: 'Diwali Special Offer 2026',
        message: 'Get 40% discount on all annual enterprise plans with GST filing.',
        promoCode: 'DIWALI40',
        discountType: CampaignDiscountType.PERCENTAGE,
        discountValue: 40,
        startsAt: now,
        expiresAt: expires,
        targetAudience: TargetAudience.ALL_TENANTS,
      });

      const err = campaign.validateSync();
      assert.equal(err, undefined);
      assert.equal(campaign.type, CampaignType.PROMOTIONAL_OFFER);
      assert.equal(campaign.targetAudience, 'ALL_TENANTS');
      assert.equal(campaign.isActive, true);
      assert.equal(campaign.bannerStyle, BannerStyle.BLUE);
      assert.equal(campaign.priority, CampaignPriority.NORMAL);
    });

    it('1.2 should reject campaign when title exceeds 200 characters or message exceeds 1000 characters', () => {
      const longTitle = 'A'.repeat(205);
      const longMessage = 'B'.repeat(1005);

      const campaign = new PlatformOfferCampaign({
        title: longTitle,
        message: longMessage,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const err = campaign.validateSync();
      assert.ok(err);
      assert.ok(err.errors['title']);
      assert.ok(err.errors['message']);
      assert.match(err.errors['title'].message, /cannot exceed 200 characters/i);
      assert.match(err.errors['message'].message, /cannot exceed 1000 characters/i);
    });

    it('1.3 should reject negative discounts via schema validation', () => {
      const negCampaign = new PlatformOfferCampaign({
        title: 'Negative Discount',
        message: 'Invalid negative value',
        discountType: CampaignDiscountType.PERCENTAGE,
        discountValue: -10,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const negErr = negCampaign.validateSync();
      assert.ok(negErr);
      assert.ok(negErr.errors['discountValue']);
      assert.match(negErr.errors['discountValue'].message, /cannot be negative/i);
    });

    it('1.4 should validate SaaS Campaign model validation rules', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000);

      const timeTravelCampaign = new Campaign({
        title: 'Time Traveler Offer',
        message: 'This campaign expires before it starts',
        badge: CampaignBadge.SPECIAL_OFFER,
        startsAt: now,
        expiresAt: past,
      });

      const err = timeTravelCampaign.validateSync();
      assert.ok(err);
      assert.ok(err.errors['expiresAt']);
      assert.match(err.errors['expiresAt'].message, /strictly after the start date/i);

      // Percentage > 100%
      const excessiveCampaign = new Campaign({
        title: 'Excessive Discount',
        message: 'Invalid 150% value',
        discountType: 'percentage',
        discountValue: 150,
        startsAt: now,
        expiresAt: new Date(now.getTime() + 86400000),
      });

      const overErr = excessiveCampaign.validateSync();
      assert.ok(overErr);
      assert.ok(overErr.errors['discountValue']);
      assert.match(overErr.errors['discountValue'].message, /cannot exceed 100%/i);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  // 2. Campaign CRUD Controller Endpoints
  // ═════════════════════════════════════════════════════════════════════
  describe('2. Campaign CRUD Operations & Audit Logging', () => {
    it('2.1 should validate dates (expiresAt > startsAt) and discount bounds on creation', async () => {
      const now = new Date();

      // Missing dates
      const reqMissingDates: any = {
        platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
        body: { title: 'Test', message: 'Test message' },
      };
      const resMissing = createMockRes();
      await platformCampaignController.createCampaign(reqMissingDates, resMissing, () => {});
      assert.equal(resMissing.statusCode, 400);
      assert.match(resMissing.body.message, /Both startsAt and expiresAt dates are required/i);

      // Expiry <= Start
      const reqExpired: any = {
        platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
        body: {
          title: 'Expired Sale',
          message: 'Starts now, ends yesterday',
          startsAt: now.toISOString(),
          expiresAt: new Date(now.getTime() - 86400000).toISOString(),
        },
      };
      const resExpired = createMockRes();
      await platformCampaignController.createCampaign(reqExpired, resExpired, () => {});
      assert.equal(resExpired.statusCode, 400);
      assert.match(resExpired.body.message, /Expiry date must be strictly after start date/i);

      // Percentage discount > 100
      const reqOverDiscount: any = {
        platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
        body: {
          title: 'Too generous',
          message: '150% off everything',
          startsAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 86400000).toISOString(),
          discountType: 'PERCENTAGE',
          discountValue: 150,
        },
      };
      const resOver = createMockRes();
      await platformCampaignController.createCampaign(reqOverDiscount, resOver, () => {});
      assert.equal(resOver.statusCode, 400);
      assert.match(resOver.body.message, /Percentage discount cannot exceed 100%/i);
    });

    it('2.2 should create a new promotional campaign and emit CAMPAIGN.CREATE audit log', async () => {
      const origSave = PlatformOfferCampaign.prototype.save;
      (PlatformOfferCampaign.prototype as any).save = async function () {
        this._id = this._id || new Types.ObjectId();
        return this;
      };

      const now = new Date();
      const startsAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + 14 * 86400000).toISOString();

      const req: any = {
        platformUser: {
          _id: new Types.ObjectId(),
          email: 'marketer@bharatenterprise.com',
          role: 'PLATFORM_ADMIN',
        },
        body: {
          title: 'Spring Festival Flash Sale',
          message: 'Upgrade to Business Suite and get 3 free months of inventory intelligence.',
          type: 'PROMOTIONAL_OFFER',
          bannerStyle: 'emerald',
          promoCode: 'SPRING2026',
          discountType: 'PERCENTAGE',
          discountValue: 25,
          callToAction: {
            label: 'Claim 25% Off',
            url: '/subscription',
          },
          startsAt,
          expiresAt,
          targetAudience: 'ALL_TENANTS',
          reason: 'Authorized Q1 seasonal flash sale campaign',
        },
      };

      const res = createMockRes();
      let nextError: any = null;
      await platformCampaignController.createCampaign(req, res, (err) => {
        nextError = err;
      });

      assert.equal(nextError, null);
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.promoCode, 'SPRING2026');
      assert.equal(res.body.data.discountValue, 25);

      // Verify Audit Log
      assert.ok(capturedAuditLogs.length >= 1);
      const audit = capturedAuditLogs.find((l) => l.action === 'CAMPAIGN.CREATE');
      assert.ok(audit);
      assert.equal(audit.targetType, 'PlatformOfferCampaign');
      assert.equal(audit.after.promoCode, 'SPRING2026');

      PlatformOfferCampaign.prototype.save = origSave;
    });

    it('2.3 should retrieve a campaign by ID and list campaigns with pagination', async () => {
      const campaignId = new Types.ObjectId();
      const mockCampaign = {
        _id: campaignId,
        title: 'Targeted Starter Upgrade',
        type: 'PROMOTIONAL_OFFER',
        promoCode: 'STARTER50',
        isActive: true,
        createdAt: new Date(),
      };

      const origFindById = PlatformOfferCampaign.findById;
      const origFind = PlatformOfferCampaign.find;
      const origCount = PlatformOfferCampaign.countDocuments;

      (PlatformOfferCampaign as any).findById = () => ({
        populate: () => ({
          populate: () => ({
            lean: async () => mockCampaign,
          }),
        }),
      });

      (PlatformOfferCampaign as any).find = () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              populate: () => ({
                lean: async () => [mockCampaign],
              }),
            }),
          }),
        }),
      });

      (PlatformOfferCampaign as any).countDocuments = async () => 1;

      // Test get by ID
      const getReq: any = { params: { id: campaignId.toString() } };
      const getRes = createMockRes();
      await platformCampaignController.getCampaignById(getReq, getRes, () => {});

      assert.equal(getRes.statusCode, 200);
      assert.equal(getRes.body.data.promoCode, 'STARTER50');

      // Test list
      const listReq: any = { query: { isActive: 'true', page: '1', limit: '10' } };
      const listRes = createMockRes();
      await platformCampaignController.listCampaigns(listReq, listRes, () => {});

      assert.equal(listRes.statusCode, 200);
      assert.equal(listRes.body.data.length, 1);
      assert.equal(listRes.body.data[0].title, 'Targeted Starter Upgrade');
      assert.equal(listRes.body.pagination.total, 1);

      PlatformOfferCampaign.findById = origFindById;
      PlatformOfferCampaign.find = origFind;
      PlatformOfferCampaign.countDocuments = origCount;
    });

    it('2.4 should update campaign attributes and log before/after diff', async () => {
      const campaignId = new Types.ObjectId();
      const mockCampaignInstance: any = {
        _id: campaignId,
        title: 'Original Title',
        message: 'Original Message',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        isActive: true,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000 * 10),
        toObject() {
          return {
            title: this.title,
            isActive: this.isActive,
            discountValue: this.discountValue,
            expiresAt: this.expiresAt,
          };
        },
        save: async () => mockCampaignInstance,
      };

      const origFindById = PlatformOfferCampaign.findById;
      (PlatformOfferCampaign as any).findById = async () => mockCampaignInstance;

      const req: any = {
        params: { id: campaignId.toString() },
        platformUser: {
          _id: new Types.ObjectId(),
          email: 'admin@bharatenterprise.com',
          role: 'PLATFORM_ADMIN',
        },
        body: {
          title: 'Boosted Title Discount',
          discountValue: 30,
          reason: 'Doubled discount due to positive conversion surge',
        },
      };

      const res = createMockRes();
      let nextError: any = null;
      await platformCampaignController.updateCampaign(req, res, (err) => {
        nextError = err;
      });

      assert.equal(nextError, null);
      assert.equal(res.statusCode, 200);
      assert.equal(mockCampaignInstance.title, 'Boosted Title Discount');
      assert.equal(mockCampaignInstance.discountValue, 30);

      // Verify Audit Log
      assert.ok(capturedAuditLogs.length >= 1);
      const audit = capturedAuditLogs.find((l) => l.action === 'CAMPAIGN.UPDATE');
      assert.ok(audit);
      assert.equal(audit.before.discountValue, 15);
      assert.equal(audit.after.discountValue, 30);

      PlatformOfferCampaign.findById = origFindById;
    });

    it('2.5 should deactivate a campaign and log CAMPAIGN.DELETE', async () => {
      const campaignId = new Types.ObjectId();
      const mockCampaignInstance: any = {
        _id: campaignId,
        title: 'Retiring Campaign',
        isActive: true,
        toObject() {
          return { _id: this._id, title: this.title, isActive: this.isActive };
        },
        save: async () => mockCampaignInstance,
      };

      const origFindById = PlatformOfferCampaign.findById;
      (PlatformOfferCampaign as any).findById = async () => mockCampaignInstance;

      const req: any = {
        params: { id: campaignId.toString() },
        platformUser: {
          _id: new Types.ObjectId(),
          email: 'admin@bharatenterprise.com',
          role: 'PLATFORM_OWNER',
        },
        body: {
          reason: 'Emergency early closure due to coupon budget ceiling reached',
        },
      };

      const res = createMockRes();
      await platformCampaignController.deleteCampaign(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(mockCampaignInstance.isActive, false);

      assert.ok(capturedAuditLogs.length >= 1);
      const audit = capturedAuditLogs.find((l) => l.action === 'CAMPAIGN.DELETE');
      assert.ok(audit);
      assert.equal(audit.targetId, campaignId.toString());

      PlatformOfferCampaign.findById = origFindById;
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  // 3. Audience Targeting & Broadcast Notification Delivery
  // ═════════════════════════════════════════════════════════════════════
  describe('3. Audience Targeting & Broadcast Notification Delivery', () => {
    it('3.1 should target ALL_TENANTS and insert notifications for all active admins', async () => {
      const deliveredNotifications: any[] = [];
      const origInsertMany = Notification.insertMany;
      (Notification as any).insertMany = async (docs: any[]) => {
        deliveredNotifications.push(...docs);
        return docs;
      };

      const tenant1 = new Types.ObjectId();
      const tenant2 = new Types.ObjectId();

      const MockAdmin = {
        find: () => ({
          select: () => ({
            lean: async () => [{ _id: tenant1 }, { _id: tenant2 }],
          }),
        }),
      };
      (mongoose.models as any).Admin = MockAdmin;

      const campaignId = new Types.ObjectId();
      const mockCampaign = {
        _id: campaignId,
        title: 'Platform-wide Security Notice',
        message: 'All tenants please review MFA authentication settings.',
        type: 'SYSTEM_ALERT',
        targetAudience: 'ALL_TENANTS',
        bannerStyle: 'rose',
        priority: 'URGENT',
        discountType: 'NONE',
        discountValue: 0,
        broadcastCount: 0,
      };

      const origFindById = PlatformOfferCampaign.findById;
      const origFindByIdAndUpdate = PlatformOfferCampaign.findByIdAndUpdate;

      (PlatformOfferCampaign as any).findById = async () => mockCampaign;
      (PlatformOfferCampaign as any).findByIdAndUpdate = async (id: any, update: any) => ({
        ...mockCampaign,
        broadcastCount: mockCampaign.broadcastCount + 1,
      });

      const req: any = {
        params: { id: campaignId.toString() },
        platformUser: { _id: new Types.ObjectId(), email: 'ops@bharat.com', role: 'PLATFORM_ADMIN' },
        body: { reason: 'Critical platform security update broadcast' },
      };
      const res = createMockRes();

      await platformCampaignController.broadcastCampaign(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.recipientCount, 2);
      assert.equal(res.body.data.broadcastCount, 1);

      assert.equal(deliveredNotifications.length, 2);
      assert.equal(deliveredNotifications[0].tenantId.toString(), tenant1.toString());
      assert.equal(deliveredNotifications[1].tenantId.toString(), tenant2.toString());
      assert.equal(deliveredNotifications[0].title, 'Platform-wide Security Notice');
      assert.equal(deliveredNotifications[0].channel, 'in_app');

      // Verify Audit Log
      const audit = capturedAuditLogs.find((l) => l.action === 'CAMPAIGN.BROADCAST');
      assert.ok(audit);
      assert.equal(audit.after.recipientCount, 2);

      Notification.insertMany = origInsertMany;
      PlatformOfferCampaign.findById = origFindById;
      PlatformOfferCampaign.findByIdAndUpdate = origFindByIdAndUpdate;
    });

    it('3.2 should target BY_PLAN and insert notifications only for matching active subscriptions', async () => {
      const deliveredNotifications: any[] = [];
      const origInsertMany = Notification.insertMany;
      (Notification as any).insertMany = async (docs: any[]) => {
        deliveredNotifications.push(...docs);
        return docs;
      };

      const planStarterId = new Types.ObjectId();
      const tenantOnStarter = new Types.ObjectId();

      const origPlanFind = Plan.find;
      (Plan as any).find = () => ({
        select: () => ({
          lean: async () => [{ _id: planStarterId, code: 'starter' }],
        }),
      });

      const origSubFind = Subscription.find;
      (Subscription as any).find = (query: any) => {
        return {
          select: () => ({
            lean: async () => [{ tenantId: tenantOnStarter }],
          }),
        };
      };

      const MockAdmin = {
        find: (query: any) => {
          assert.deepEqual(query._id.$in, [tenantOnStarter]);
          return {
            select: () => ({
              lean: async () => [{ _id: tenantOnStarter }],
            }),
          };
        },
      };
      (mongoose.models as any).Admin = MockAdmin;

      const campaignId = new Types.ObjectId();
      const mockCampaign = {
        _id: campaignId,
        title: 'Upgrade from Starter to Business',
        message: 'Get 30% off Business plan today!',
        type: 'PROMOTIONAL_OFFER',
        promoCode: 'GROW30',
        targetAudience: 'BY_PLAN',
        targetPlanCodes: ['starter'],
        discountType: 'PERCENTAGE',
        discountValue: 30,
        bannerStyle: 'emerald',
        priority: 'HIGH',
        broadcastCount: 2,
      };

      const origFindById = PlatformOfferCampaign.findById;
      const origFindByIdAndUpdate = PlatformOfferCampaign.findByIdAndUpdate;

      (PlatformOfferCampaign as any).findById = async () => mockCampaign;
      (PlatformOfferCampaign as any).findByIdAndUpdate = async () => ({
        ...mockCampaign,
        broadcastCount: mockCampaign.broadcastCount + 1,
      });

      const req: any = {
        params: { id: campaignId.toString() },
        platformUser: { _id: new Types.ObjectId(), email: 'growth@bharat.com', role: 'PLATFORM_ADMIN' },
        body: {},
      };
      const res = createMockRes();

      await platformCampaignController.broadcastCampaign(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.recipientCount, 1);
      assert.equal(deliveredNotifications.length, 1);
      assert.equal(deliveredNotifications[0].tenantId.toString(), tenantOnStarter.toString());
      assert.equal(deliveredNotifications[0].data.promoCode, 'GROW30');

      Notification.insertMany = origInsertMany;
      Plan.find = origPlanFind;
      Subscription.find = origSubFind;
      PlatformOfferCampaign.findById = origFindById;
      PlatformOfferCampaign.findByIdAndUpdate = origFindByIdAndUpdate;
    });

    it('3.3 should target BY_STATUS and deduplicate tenant notifications', async () => {
      const deliveredNotifications: any[] = [];
      const origInsertMany = Notification.insertMany;
      (Notification as any).insertMany = async (docs: any[]) => {
        deliveredNotifications.push(...docs);
        return docs;
      };

      const expiredTenantId = new Types.ObjectId();

      const origSubFind = Subscription.find;
      (Subscription as any).find = (query: any) => {
        assert.ok(query.status);
        return {
          select: () => ({
            // Return duplicate tenant occurrences to test deduplication
            lean: async () => [{ tenantId: expiredTenantId }, { tenantId: expiredTenantId }],
          }),
        };
      };

      const MockAdmin = {
        find: (query: any) => ({
          select: () => ({
            lean: async () => [{ _id: expiredTenantId }],
          }),
        }),
      };
      (mongoose.models as any).Admin = MockAdmin;

      const campaignId = new Types.ObjectId();
      const statusCampaign = {
        _id: campaignId,
        title: 'Win-back Offer: 50% Off Renewal',
        message: 'Reactivate your account with instant 50% waiver.',
        type: 'PROMOTIONAL_OFFER',
        promoCode: 'COMEBACK50',
        targetAudience: 'BY_STATUS',
        targetStatuses: ['expired'],
        discountType: 'PERCENTAGE',
        discountValue: 50,
        bannerStyle: 'amber',
        priority: 'HIGH',
        broadcastCount: 0,
      };

      const origFindById = PlatformOfferCampaign.findById;
      const origFindByIdAndUpdate = PlatformOfferCampaign.findByIdAndUpdate;

      (PlatformOfferCampaign as any).findById = async () => statusCampaign;
      (PlatformOfferCampaign as any).findByIdAndUpdate = async () => ({
        ...statusCampaign,
        broadcastCount: 1,
      });

      const req: any = {
        params: { id: campaignId.toString() },
        platformUser: { _id: new Types.ObjectId(), email: 'retention@bharat.com', role: 'PLATFORM_ADMIN' },
        body: {},
      };
      const res = createMockRes();

      await platformCampaignController.broadcastCampaign(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.recipientCount, 1, 'Duplicate tenant occurrences must be deduplicated');
      assert.equal(deliveredNotifications.length, 1);
      assert.equal(deliveredNotifications[0].tenantId.toString(), expiredTenantId.toString());

      Notification.insertMany = origInsertMany;
      Subscription.find = origSubFind;
      PlatformOfferCampaign.findById = origFindById;
      PlatformOfferCampaign.findByIdAndUpdate = origFindByIdAndUpdate;
    });

    it('3.4 should target SPECIFIC_TENANTS directly by configured IDs', async () => {
      const deliveredNotifications: any[] = [];
      const origInsertMany = Notification.insertMany;
      (Notification as any).insertMany = async (docs: any[]) => {
        deliveredNotifications.push(...docs);
        return docs;
      };

      const specialTenant = new Types.ObjectId();

      const MockAdmin = {
        find: (query: any) => ({
          select: () => ({
            lean: async () => [{ _id: specialTenant }],
          }),
        }),
      };
      (mongoose.models as any).Admin = MockAdmin;

      const campaignId = new Types.ObjectId();
      const specificCampaign = {
        _id: campaignId,
        title: 'VIP Exclusive Concierge Migration',
        message: 'We are migrating your multi-branch records to enterprise tier free of charge.',
        type: 'BROADCAST_ANNOUNCEMENT',
        targetAudience: 'SPECIFIC_TENANTS',
        targetTenantIds: [specialTenant],
        discountType: 'NONE',
        discountValue: 0,
        bannerStyle: 'purple',
        priority: 'URGENT',
        broadcastCount: 0,
      };

      const origFindById = PlatformOfferCampaign.findById;
      const origFindByIdAndUpdate = PlatformOfferCampaign.findByIdAndUpdate;

      (PlatformOfferCampaign as any).findById = async () => specificCampaign;
      (PlatformOfferCampaign as any).findByIdAndUpdate = async () => ({
        ...specificCampaign,
        broadcastCount: 1,
      });

      const req: any = {
        params: { id: campaignId.toString() },
        platformUser: { _id: new Types.ObjectId(), email: 'concierge@bharat.com', role: 'PLATFORM_ADMIN' },
        body: {},
      };
      const res = createMockRes();

      await platformCampaignController.broadcastCampaign(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.recipientCount, 1);
      assert.equal(deliveredNotifications.length, 1);
      assert.equal(deliveredNotifications[0].tenantId.toString(), specialTenant.toString());

      Notification.insertMany = origInsertMany;
      PlatformOfferCampaign.findById = origFindById;
      PlatformOfferCampaign.findByIdAndUpdate = origFindByIdAndUpdate;
    });
  });
});
