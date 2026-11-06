/**
 * Bharat Enterprise Billing System — Campaign A/B Testing & Offer Parity Test Suite
 *
 * Test Coverage:
 * 1. A/B testing audience targeting partitions:
 *    - Starter vs Professional vs Expired vs Specific VIP tenants.
 * 2. Tenant API Parity & Zero Data Leakage (GET /api/saas/offers/active):
 *    - Verifies response contains exact matching campaigns.
 *    - Verifies 0 data leakage: no targetPlanCodes, targetStatuses, targetTenantIds,
 *      targetAudience, createdBy, or broadcastCount leaked to client.
 * 3. Priority ordering (URGENT > HIGH > NORMAL > LOW) and date filtering.
 * 4. Authentication and tenant isolation security guards.
 *
 * Executed natively via tsx / node:test:
 * npx tsx admin/backend/tests/campaignABTestingAndParity.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import PlatformOfferCampaign, {
  CampaignType,
  TargetAudience,
  CampaignDiscountType,
  BannerStyle,
  CampaignPriority,
} from '../models/PlatformOfferCampaign';
import Subscription from '../../../backend/saas/models/Subscription';
import * as offerController from '../../../backend/saas/controllers/offerController';

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

describe('Campaign A/B Testing & Tenant Offer Parity Test Suite', () => {
  const tenantStarter = new Types.ObjectId();
  const tenantPro = new Types.ObjectId();
  const tenantExpired = new Types.ObjectId();
  const tenantVIP = new Types.ObjectId();

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const nextWeek = new Date(now.getTime() + 7 * 86400000);

  let activeMockSub: any = null;

  // Set of test campaigns covering different A/B segments
  const mockCampaigns: any[] = [
    {
      _id: new Types.ObjectId(),
      title: 'Starter Upgrade Flash Sale',
      message: 'Upgrade from Starter to Pro for 20% off',
      type: CampaignType.PROMOTIONAL_OFFER,
      targetAudience: TargetAudience.BY_PLAN,
      targetPlanCodes: ['starter'],
      targetStatuses: [],
      targetTenantIds: [],
      promoCode: 'STARTER20',
      discountType: CampaignDiscountType.PERCENTAGE,
      discountValue: 20,
      bannerStyle: BannerStyle.BLUE,
      isDismissible: true,
      startsAt: yesterday,
      expiresAt: nextWeek,
      isActive: true,
      priority: CampaignPriority.NORMAL,
      broadcastCount: 5,
      createdBy: new Types.ObjectId(),
      createdAt: new Date(now.getTime() - 10000),
    },
    {
      _id: new Types.ObjectId(),
      title: 'Pro Annual Commitment Waiver',
      message: 'Get 2 bonus months when upgrading Pro to Annual',
      type: CampaignType.PROMOTIONAL_OFFER,
      targetAudience: TargetAudience.BY_PLAN,
      targetPlanCodes: ['professional'],
      targetStatuses: [],
      targetTenantIds: [],
      promoCode: 'PROBONUS',
      discountType: CampaignDiscountType.BONUS_DAYS,
      discountValue: 60,
      bannerStyle: BannerStyle.EMERALD,
      isDismissible: true,
      startsAt: yesterday,
      expiresAt: nextWeek,
      isActive: true,
      priority: CampaignPriority.NORMAL,
      broadcastCount: 2,
      createdBy: new Types.ObjectId(),
      createdAt: new Date(now.getTime() - 8000),
    },
    {
      _id: new Types.ObjectId(),
      title: 'Win-Back Reactivation Grant',
      message: 'Special 50% waiver to reactivate your expired subscription',
      type: CampaignType.PROMOTIONAL_OFFER,
      targetAudience: TargetAudience.BY_STATUS,
      targetPlanCodes: [],
      targetStatuses: ['expired'],
      targetTenantIds: [],
      promoCode: 'WINBACK50',
      discountType: CampaignDiscountType.PERCENTAGE,
      discountValue: 50,
      bannerStyle: BannerStyle.AMBER,
      isDismissible: false,
      startsAt: yesterday,
      expiresAt: nextWeek,
      isActive: true,
      priority: CampaignPriority.HIGH,
      broadcastCount: 1,
      createdBy: new Types.ObjectId(),
      createdAt: new Date(now.getTime() - 6000),
    },
    {
      _id: new Types.ObjectId(),
      title: 'Platform System Announcement',
      message: 'New e-Way bill bulk generator is now live for all plans',
      type: CampaignType.FEATURE_RELEASE,
      targetAudience: TargetAudience.ALL_TENANTS,
      targetPlanCodes: [],
      targetStatuses: [],
      targetTenantIds: [],
      promoCode: null,
      discountType: CampaignDiscountType.NONE,
      discountValue: 0,
      bannerStyle: BannerStyle.BLUE,
      isDismissible: true,
      startsAt: yesterday,
      expiresAt: nextWeek,
      isActive: true,
      priority: CampaignPriority.LOW,
      broadcastCount: 10,
      createdBy: new Types.ObjectId(),
      createdAt: new Date(now.getTime() - 12000),
    },
    {
      _id: new Types.ObjectId(),
      title: 'VIP Dedicated Account Concierge',
      message: 'Exclusive 1-on-1 migration assistance for your account',
      type: CampaignType.SYSTEM_ALERT,
      targetAudience: TargetAudience.SPECIFIC_TENANTS,
      targetPlanCodes: [],
      targetStatuses: [],
      targetTenantIds: [tenantVIP],
      promoCode: 'VIPCONCIERGE',
      discountType: CampaignDiscountType.NONE,
      discountValue: 0,
      bannerStyle: BannerStyle.PURPLE,
      isDismissible: true,
      startsAt: yesterday,
      expiresAt: nextWeek,
      isActive: true,
      priority: CampaignPriority.URGENT,
      broadcastCount: 1,
      createdBy: new Types.ObjectId(),
      createdAt: new Date(now.getTime() - 2000),
    },
  ];

  beforeEach(() => {
    activeMockSub = null;

    // Mock Subscription.findOne to prevent Mongoose DB timeout
    Subscription.findOne = (() => ({
      sort: () => ({
        populate: () => ({
          lean: async () => activeMockSub,
        }),
      }),
    })) as any;

    // Setup Mock for PlatformOfferCampaign.find
    PlatformOfferCampaign.find = ((query: any) => {
      let filtered = [...mockCampaigns];

      if (query.isActive !== undefined) {
        filtered = filtered.filter((c) => c.isActive === query.isActive);
      }

      if (query.startsAt?.$lte) {
        filtered = filtered.filter((c) => c.startsAt <= query.startsAt.$lte);
      }

      if (query.expiresAt?.$gte) {
        filtered = filtered.filter((c) => c.expiresAt >= query.expiresAt.$gte);
      }

      if (Array.isArray(query.$or)) {
        filtered = filtered.filter((c) => {
          return query.$or.some((cond: any) => {
            if (cond.targetAudience === 'ALL_TENANTS' && c.targetAudience === 'ALL_TENANTS') {
              return true;
            }
            if (
              cond.targetAudience === 'SPECIFIC_TENANTS' &&
              c.targetAudience === 'SPECIFIC_TENANTS' &&
              c.targetTenantIds?.some((id: any) => id.toString() === cond.targetTenantIds?.toString())
            ) {
              return true;
            }
            if (
              cond.targetAudience === 'BY_PLAN' &&
              c.targetAudience === 'BY_PLAN' &&
              c.targetPlanCodes?.includes(cond.targetPlanCodes)
            ) {
              return true;
            }
            if (
              cond.targetAudience === 'BY_STATUS' &&
              c.targetAudience === 'BY_STATUS' &&
              c.targetStatuses?.includes(cond.targetStatuses)
            ) {
              return true;
            }
            return false;
          });
        });
      }

      return {
        sort: () => ({
          lean: async () => filtered,
        }),
      };
    }) as any;
  });

  // ═════════════════════════════════════════════════════════════════════
  // 1. A/B Testing Audience Partitioning
  // ═════════════════════════════════════════════════════════════════════
  describe('1. A/B Testing Partitioning Simulation', () => {
    it('1.1 Starter plan tenant should see Starter Offer + All Tenants, but NOT Pro or VIP offers', async () => {
      activeMockSub = {
        tenantId: tenantStarter.toString(),
        status: 'active',
        currentPricingSnapshot: { planCode: 'starter' },
      };

      const req: any = {
        user: { _id: tenantStarter },
        userRole: 'admin',
      };
      const res = createMockRes();

      await offerController.getActiveOffers(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      const codes = res.body.offers.map((o: any) => o.promoCode);

      // Must receive:
      assert.ok(codes.includes('STARTER20'), 'Starter tenant must see STARTER20');
      assert.ok(codes.includes(''), 'Starter tenant must see platform announcement (promoCode null -> empty)');

      // Must NOT receive:
      assert.equal(codes.includes('PROBONUS'), false, 'Starter tenant must NOT see Pro offers');
      assert.equal(codes.includes('WINBACK50'), false, 'Active tenant must NOT see Winback offer');
      assert.equal(codes.includes('VIPCONCIERGE'), false, 'Non-VIP tenant must NOT see VIP offer');
    });

    it('1.2 Professional plan tenant should see Pro Offer + All Tenants, but NOT Starter or VIP offers', async () => {
      activeMockSub = {
        tenantId: tenantPro.toString(),
        status: 'active',
        currentPricingSnapshot: { planCode: 'professional' },
      };

      const req: any = {
        user: { _id: tenantPro },
        userRole: 'admin',
      };
      const res = createMockRes();

      await offerController.getActiveOffers(req, res, () => {});

      assert.equal(res.statusCode, 200);
      const codes = res.body.offers.map((o: any) => o.promoCode);

      // Must receive:
      assert.ok(codes.includes('PROBONUS'), 'Pro tenant must see PROBONUS');
      // Must NOT receive:
      assert.equal(codes.includes('STARTER20'), false, 'Pro tenant must NOT see Starter offers');
      assert.equal(codes.includes('VIPCONCIERGE'), false, 'Pro tenant must NOT see VIP offers');
    });

    it('1.3 Expired tenant should see Win-Back reactivation offer regardless of plan', async () => {
      activeMockSub = {
        tenantId: tenantExpired.toString(),
        status: 'expired',
        currentPricingSnapshot: { planCode: 'enterprise' },
      };

      const req: any = {
        user: { _id: tenantExpired },
        userRole: 'admin',
      };
      const res = createMockRes();

      await offerController.getActiveOffers(req, res, () => {});

      assert.equal(res.statusCode, 200);
      const codes = res.body.offers.map((o: any) => o.promoCode);

      // Must receive Winback offer and All Tenants announcement
      assert.ok(codes.includes('WINBACK50'), 'Expired tenant must receive winback reactivation offer');
      assert.equal(codes.includes('PROBONUS'), false);
      assert.equal(codes.includes('STARTER20'), false);
    });

    it('1.4 Specific VIP tenant should receive targeted concierge alert', async () => {
      activeMockSub = {
        tenantId: tenantVIP.toString(),
        status: 'active',
        currentPricingSnapshot: { planCode: 'enterprise' },
      };

      const req: any = {
        user: { _id: tenantVIP },
        userRole: 'admin',
      };
      const res = createMockRes();

      await offerController.getActiveOffers(req, res, () => {});

      assert.equal(res.statusCode, 200);
      const codes = res.body.offers.map((o: any) => o.promoCode);

      // Must receive VIP offer
      assert.ok(codes.includes('VIPCONCIERGE'), 'VIP tenant must receive exclusive concierge offer');
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  // 2. Parity & Zero Data Leakage Checks
  // ═════════════════════════════════════════════════════════════════════
  describe('2. Offer DTO Parity & Zero Data Leakage Security Guard', () => {
    it('2.1 should sanitize all internal administrative fields from client DTO', async () => {
      activeMockSub = {
        tenantId: tenantVIP.toString(),
        status: 'active',
        currentPricingSnapshot: { planCode: 'enterprise' },
      };

      const req: any = {
        user: { _id: tenantVIP },
        userRole: 'admin',
      };
      const res = createMockRes();

      await offerController.getActiveOffers(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.ok(res.body.offers.length > 0);

      // Allowed client-safe fields
      const ALLOWED_FIELDS = new Set([
        '_id',
        'title',
        'message',
        'type',
        'promoCode',
        'discountType',
        'discountValue',
        'bannerStyle',
        'callToAction',
        'isDismissible',
        'startsAt',
        'expiresAt',
        'priority',
      ]);

      // Forbidden sensitive fields that must NEVER be leaked to frontend client
      const SENSITIVE_FORBIDDEN_FIELDS = [
        'targetAudience',
        'targetPlanCodes',
        'targetStatuses',
        'targetTenantIds',
        'createdBy',
        'broadcastCount',
        '__v',
      ];

      for (const offer of res.body.offers) {
        for (const forbidden of SENSITIVE_FORBIDDEN_FIELDS) {
          assert.equal(
            (offer as any)[forbidden],
            undefined,
            `Zero Data Leakage Violation: Sensitive field "${forbidden}" leaked to tenant client!`,
          );
        }

        // Check that every key in offer is an allowed field
        for (const key of Object.keys(offer)) {
          assert.ok(
            ALLOWED_FIELDS.has(key),
            `Unrecognized field "${key}" present in public offer DTO`,
          );
        }
      }
    });

    it('2.2 should maintain dual parity: body.offers and body.data must be identical', async () => {
      activeMockSub = {
        tenantId: tenantStarter.toString(),
        status: 'active',
        currentPricingSnapshot: { planCode: 'starter' },
      };

      const req: any = {
        user: { _id: tenantStarter },
        userRole: 'admin',
      };
      const res = createMockRes();

      await offerController.getActiveOffers(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body.offers, res.body.data);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  // 3. Priority Ordering & Date Window Boundary
  // ═════════════════════════════════════════════════════════════════════
  describe('3. Priority Ordering and Date Window Safeguards', () => {
    it('3.1 should sort offers with URGENT highest priority first', async () => {
      activeMockSub = {
        tenantId: tenantVIP.toString(),
        status: 'active',
        currentPricingSnapshot: { planCode: 'enterprise' },
      };

      const req: any = {
        user: { _id: tenantVIP },
        userRole: 'admin',
      };
      const res = createMockRes();

      await offerController.getActiveOffers(req, res, () => {});

      assert.equal(res.statusCode, 200);
      const priorities = res.body.offers.map((o: any) => o.priority);

      // First item must be URGENT
      assert.equal(priorities[0], 'URGENT');
      // Last item must be LOW (Platform System Announcement)
      assert.equal(priorities[priorities.length - 1], 'LOW');
    });

    it('3.2 should reject unauthenticated requests with 401 and empty offers array', async () => {
      const req: any = {
        user: null, // Unauthenticated
      };
      const res = createMockRes();

      await offerController.getActiveOffers(req, res, () => {});

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
      assert.deepEqual(res.body.offers, []);
    });
  });
});
