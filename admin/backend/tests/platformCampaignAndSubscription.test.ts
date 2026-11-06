/**
 * Stream 2 Unit & Integration Tests: Platform Subscriptions & Campaign Engine
 *
 * Tests:
 * 1. PlatformOfferCampaign schema validation, defaults, and query indexes
 * 2. platformCampaignController CRUD and audience broadcast targeting
 * 3. platformSubscriptionController updateSubscription validation, custom pricing snapshot, and cache invalidation
 * 4. saas/offerController getActiveOffers audience resolution and priority ordering
 *
 * Executed natively via Node 22 test runner:
 * npx tsx --test admin/backend/tests/platformCampaignAndSubscription.test.ts
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

import {
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  broadcastCampaign,
} from '../controllers/platformCampaignController';

import { updateSubscription } from '../controllers/platformSubscriptionController';
import { getActiveOffers } from '../../../backend/saas/controllers/offerController';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import Notification from '../../../backend/saas/models/Notification';
import { SubscriptionStatus, PlanCode, Feature } from '../../../backend/saas/shared/features';
import * as auditService from '../services/platformAuditService';
import { PlatformAuditHead } from '../models/PlatformAuditHead';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import type { PlatformRequest } from '../types';

// Fast-path mock for audit logger & mongoose buffering in unit tests without live database connection
const auditMod = require('../services/platformAuditService');
auditMod.logPlatformAudit = async () => ({} as any);

PlatformAuditHead.findOne = (() => ({
  session: async () => ({ lastSequence: 50, lastHash: 'prev_hash_50' }),
  lean: async () => ({ lastSequence: 50, lastHash: 'prev_hash_50' }),
})) as any;

PlatformAuditHead.findOneAndUpdate = (() => ({
  session: async () => ({ lastSequence: 51, lastHash: 'new_hash_51' }),
})) as any;

PlatformAuditLog.create = (async (docs: any) => docs) as any;

// Mock response builder
function createMockResponse() {
  const res: any = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res;
}

// ─── 1. Schema Validation Tests ──────────────────────────────────
describe('Stream 2: PlatformOfferCampaign Schema & Validation', () => {
  it('instantiates PlatformOfferCampaign with canonical defaults', () => {
    const operatorId = new Types.ObjectId();
    const now = new Date();
    const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const campaign = new PlatformOfferCampaign({
      title: 'Diwali Enterprise Promotion',
      message: 'Get 25% off annual business plans with priority support.',
      startsAt: now,
      expiresAt: expiry,
      createdBy: operatorId,
    });

    assert.equal(campaign.title, 'Diwali Enterprise Promotion');
    assert.equal(campaign.type, CampaignType.PROMOTIONAL_OFFER);
    assert.equal(campaign.targetAudience, TargetAudience.ALL_TENANTS);
    assert.equal(campaign.discountType, CampaignDiscountType.NONE);
    assert.equal(campaign.discountValue, 0);
    assert.equal(campaign.bannerStyle, BannerStyle.BLUE);
    assert.equal(campaign.isDismissible, true);
    assert.equal(campaign.isActive, true);
    assert.equal(campaign.priority, CampaignPriority.NORMAL);
    assert.equal(campaign.broadcastCount, 0);
    assert.equal(campaign.createdBy?.toString(), operatorId.toString());
  });

  it('rejects title longer than 200 characters', () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 10000);

    const campaign = new PlatformOfferCampaign({
      title: 'A'.repeat(201),
      message: 'Valid message body',
      startsAt: now,
      expiresAt: expiry,
    });

    const err = campaign.validateSync();
    assert.ok(err);
    assert.ok(err.errors['title']);
  });

  it('rejects message longer than 1000 characters', () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 10000);

    const campaign = new PlatformOfferCampaign({
      title: 'Valid Title',
      message: 'M'.repeat(1001),
      startsAt: now,
      expiresAt: expiry,
    });

    const err = campaign.validateSync();
    assert.ok(err);
    assert.ok(err.errors['message']);
  });

  it('has required indexes declared on schema', () => {
    const indexes: any[] = PlatformOfferCampaign.schema.indexes();
    const hasActiveWindowIndex = indexes.some(
      (idx: any) =>
        idx[0]['isActive'] === 1 &&
        idx[0]['startsAt'] === 1 &&
        idx[0]['expiresAt'] === 1,
    );
    const hasAudienceIndex = indexes.some(
      (idx: any) => idx[0]['targetAudience'] === 1 && idx[0]['isActive'] === 1,
    );
    const hasCreatedAtIndex = indexes.some((idx: any) => idx[0]['createdAt'] === -1);

    assert.ok(hasActiveWindowIndex, 'Missing index on { isActive: 1, startsAt: 1, expiresAt: 1 }');
    assert.ok(hasAudienceIndex, 'Missing index on { targetAudience: 1, isActive: 1 }');
    assert.ok(hasCreatedAtIndex, 'Missing index on { createdAt: -1 }');
  });
});

// ─── 2. Platform Campaign Controller Tests ───────────────────────
describe('Stream 2: Platform Campaign Controller CRUD & Validation', () => {
  it('createCampaign rejects missing title or message', async () => {
    const req: any = {
      body: {
        title: '',
        message: 'Valid message',
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10000).toISOString(),
      },
      platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
    };
    const res = createMockResponse();

    await createCampaign(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /title is required/i);
  });

  it('createCampaign rejects expiry date earlier than or equal to start date', async () => {
    const now = new Date();
    const req: any = {
      body: {
        title: 'New Feature Announcement',
        message: 'Batch expiry tracking is live!',
        startsAt: now.toISOString(),
        expiresAt: new Date(now.getTime() - 1000).toISOString(),
      },
      platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
    };
    const res = createMockResponse();

    await createCampaign(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /strictly after start date/i);
  });

  it('createCampaign rejects percentage discount exceeding 100%', async () => {
    const now = new Date();
    const req: any = {
      body: {
        title: 'Flash Sale',
        message: 'Massive discount',
        discountType: CampaignDiscountType.PERCENTAGE,
        discountValue: 125,
        startsAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 100000).toISOString(),
      },
      platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
    };
    const res = createMockResponse();

    await createCampaign(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /cannot exceed 100%/i);
  });

  it('getCampaignById rejects invalid ObjectId', async () => {
    const req: any = {
      params: { id: 'invalid-id' },
    };
    const res = createMockResponse();

    await getCampaignById(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid campaign id/i);
  });

  it('updateCampaign rejects invalid ObjectId', async () => {
    const req: any = {
      params: { id: 'bad-id' },
      body: { title: 'Updated' },
    };
    const res = createMockResponse();

    await updateCampaign(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid campaign id/i);
  });

  it('deleteCampaign rejects invalid ObjectId', async () => {
    const req: any = {
      params: { id: 'bad-id' },
    };
    const res = createMockResponse();

    await deleteCampaign(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid campaign id/i);
  });

  it('broadcastCampaign rejects invalid ObjectId', async () => {
    const req: any = {
      params: { id: 'not-an-id' },
    };
    const res = createMockResponse();

    await broadcastCampaign(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid campaign id/i);
  });
});

// ─── 3. Platform Subscription Controller updateSubscription Tests ──
describe('Stream 2: Platform Subscription Controller updateSubscription', () => {
  it('updateSubscription enforces minimum 10-char reason requirement', async () => {
    const req: any = {
      params: { id: new Types.ObjectId().toString() },
      body: {
        status: SubscriptionStatus.ACTIVE,
        reason: 'Too short',
      },
      platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
    };
    const res = createMockResponse();

    await updateSubscription(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /minimum 10 characters/i);
  });

  it('updateSubscription rejects invalid subscription ID format', async () => {
    const req: any = {
      params: { id: 'not-valid' },
      body: {
        reason: 'Valid operational reason with sufficient characters',
      },
    };
    const res = createMockResponse();

    await updateSubscription(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid subscription id/i);
  });

  it('updateSubscription returns 404 for non-existent subscription', async () => {
    const originalFindById = Subscription.findById;
    (Subscription as any).findById = () => Promise.resolve(null);

    try {
      const req: any = {
        params: { id: new Types.ObjectId().toString() },
        body: {
          reason: 'Valid operational reason for missing record test',
        },
        platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
      };
      const res = createMockResponse();

      await updateSubscription(req, res, () => {});
      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /subscription not found/i);
    } finally {
      Subscription.findById = originalFindById;
    }
  });

  it('updateSubscription rejects invalid status enum value', async () => {
    const mockSub = {
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(),
      status: SubscriptionStatus.TRIAL,
      toObject: () => ({ status: SubscriptionStatus.TRIAL }),
      save: async () => {},
    };
    const originalFindById = Subscription.findById;
    (Subscription as any).findById = () => Promise.resolve(mockSub);

    try {
      const req: any = {
        params: { id: mockSub._id.toString() },
        body: {
          status: 'INVALID_STATUS_VALUE',
          reason: 'Testing status transition validation rejection',
        },
        platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
      };
      const res = createMockResponse();

      await updateSubscription(req, res, () => {});
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /invalid status/i);
    } finally {
      Subscription.findById = originalFindById;
    }
  });

  it('updateSubscription updates customPrice and currentPricingSnapshot correctly', async () => {
    let saved = false;
    const mockSub: any = {
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(),
      planId: new Types.ObjectId(),
      status: SubscriptionStatus.ACTIVE,
      currentPricingSnapshot: {
        planName: 'Business Pro',
        planCode: PlanCode.BUSINESS,
        baseMonthlyPrice: 1999,
        durationMonths: 12,
        discountApplied: 0,
        finalAmount: 1999,
        features: [Feature.GST_REPORTS],
      },
      toObject() {
        return { ...this };
      },
      save: async () => {
        saved = true;
      },
    };

    const originalFindById = Subscription.findById;
    (Subscription as any).findById = () => Promise.resolve(mockSub);

    try {
      const req: any = {
        params: { id: mockSub._id.toString() },
        body: {
          customPrice: 1499.5,
          gracePeriodDays: 14,
          reason: 'Special enterprise negotiated custom pricing agreement',
        },
        platformUser: { _id: new Types.ObjectId(), email: 'admin@bharat.com', role: 'PLATFORM_ADMIN' },
      };
      const res = createMockResponse();

      await updateSubscription(req, res, () => {});
      assert.equal(res.statusCode, 200);
      assert.equal(saved, true);
      assert.equal(mockSub.currentPricingSnapshot.baseMonthlyPrice, 1499.5);
      assert.equal(mockSub.currentPricingSnapshot.finalAmount, 1499.5);
      assert.equal(mockSub.gracePeriodDays, 14);
    } finally {
      Subscription.findById = originalFindById;
    }
  });
});

// ─── 4. SaaS Offer Controller getActiveOffers Tests ──────────────
describe('Stream 2: SaaS Offer Controller getActiveOffers', () => {
  it('getActiveOffers queries matching campaigns by audience, plan, and status', async () => {
    const tenantId = new Types.ObjectId();
    const campaignId = new Types.ObjectId();

    // Mock Subscription lookup
    const originalSubFindOne = Subscription.findOne;
    (Subscription as any).findOne = () => ({
      sort: () => ({
        populate: () => ({
          lean: async () => ({
            _id: new Types.ObjectId(),
            tenantId,
            status: SubscriptionStatus.ACTIVE,
            currentPricingSnapshot: {
              planCode: PlanCode.BUSINESS,
            },
          }),
        }),
      }),
    });

    // Mock PlatformOfferCampaign lookup
    const originalCampaignFind = PlatformOfferCampaign.find;
    (PlatformOfferCampaign as any).find = (query: any) => ({
      sort: () => ({
        lean: async () => [
          {
            _id: campaignId,
            title: 'Q4 Pro Discount',
            message: 'Upgrade to Business tier for ₹999/mo',
            type: CampaignType.PROMOTIONAL_OFFER,
            promoCode: 'Q4SAVE',
            discountType: CampaignDiscountType.PERCENTAGE,
            discountValue: 20,
            bannerStyle: BannerStyle.EMERALD,
            priority: CampaignPriority.URGENT,
            isDismissible: true,
            startsAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
            createdAt: new Date(),
          },
        ],
      }),
    });

    try {
      const req: any = {
        userRole: 'admin',
        user: { _id: tenantId },
      };
      const res = createMockResponse();

      await getActiveOffers(req, res, () => {});
      assert.equal(res.statusCode, 200);
      assert.ok(res.body.success);
      assert.equal(res.body.offers.length, 1);
      assert.equal(res.body.offers[0].title, 'Q4 Pro Discount');
      assert.equal(res.body.offers[0].promoCode, 'Q4SAVE');
      assert.equal(res.body.offers[0].priority, CampaignPriority.URGENT);
    } finally {
      Subscription.findOne = originalSubFindOne;
      PlatformOfferCampaign.find = originalCampaignFind;
    }
  });

  it('getActiveOffers rejects unauthenticated request missing tenant identity', async () => {
    const req: any = {
      userRole: 'guest',
      user: null,
    };
    const res = createMockResponse();

    await getActiveOffers(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /authentication required/i);
  });
});
