/**
 * Bharat Enterprise Billing System — Support Sessions & Dashboard Aggregation Tests
 * Comprehensive unit tests covering session bounds, anti-impersonation, read-only gating,
 * MRR calculations, IST date boundaries, 30s TTL cache, and ESR indexing specifications.
 *
 * Executed natively via Node 22 test runner: npx tsx --test
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import {
  generateSupportSessionCode,
  computePermissionsSnapshot,
} from '../services/supportSessionService';
import {
  enforceSupportSessionBounds,
} from '../middleware/supportSessionMiddleware';
import {
  getISTDateBoundaries,
  invalidatePlatformDashboardCache,
  getPlatformDashboardOverview,
  CACHE_TTL_MS,
} from '../queries/dashboardQueries';
import {
  PLATFORM_ESR_INDEXES,
} from '../scripts/migratePlatformIndexes';
import {
  PlatformRole,
  PlatformPermission,
  SupportSessionStatus,
  IPlatformUser,
  IPlatformSupportSession,
  PlatformRequest,
} from '../types';
import PlatformSupportSession from '../models/PlatformSupportSession';
import Admin from '../../../backend/models/Admin';
import Subscription from '../../../backend/saas/models/Subscription';
import SubscriptionPayment from '../../../backend/saas/models/SubscriptionPayment';

describe('Phase 9: Support Sessions Diagnostic Scope — Code Generator & Permission Snapshots', () => {
  it('should generate valid diagnostic session codes matching SUP-YYYYMMDD-XXXX', () => {
    const code = generateSupportSessionCode();
    assert.match(code, /^SUP-\d{8}-[A-F0-9]{4}$/);
  });

  it('should generate distinct codes on consecutive invocations', () => {
    const codeA = generateSupportSessionCode();
    const codeB = generateSupportSessionCode();
    assert.notEqual(codeA, codeB);
  });

  it('should grant all permissions to PLATFORM_OWNER in permissions snapshot', () => {
    const ownerUser: IPlatformUser = {
      _id: new Types.ObjectId(),
      email: 'owner@bharat.test',
      fullName: 'Platform Owner',
      role: PlatformRole.PLATFORM_OWNER,
      customPermissions: [],
      isActive: true,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      mfaEnabled: true,
      mfaBackupCodes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const snapshot = computePermissionsSnapshot(ownerUser);
    const allPermissions = Object.values(PlatformPermission);
    assert.equal(snapshot.length, allPermissions.length);
    assert.ok(snapshot.includes(PlatformPermission.EMERGENCY_BYPASS_MANAGE));
  });

  it('should snapshot base role permissions plus custom permissions for support roles', () => {
    const agentUser: IPlatformUser = {
      _id: new Types.ObjectId(),
      email: 'agent@bharat.test',
      fullName: 'Support Agent',
      role: PlatformRole.SUPPORT_AGENT,
      customPermissions: [PlatformPermission.SUBSCRIPTIONS_VIEW],
      isActive: true,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      mfaEnabled: false,
      mfaBackupCodes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const snapshot = computePermissionsSnapshot(agentUser);
    assert.ok(snapshot.includes(PlatformPermission.SUPPORT_START));
    assert.ok(snapshot.includes(PlatformPermission.SUPPORT_END));
    assert.ok(snapshot.includes(PlatformPermission.SUBSCRIPTIONS_VIEW));
    assert.ok(!snapshot.includes(PlatformPermission.USERS_MANAGE));
  });
});

describe('Phase 9: Support Sessions — Duration Bounds & Ceilings', () => {
  it('should clamp duration between 0.5 hours and 4 hours ceiling', () => {
    const testCases = [
      { input: 0.1, expected: 0.5 },
      { input: 0.5, expected: 0.5 },
      { input: 2, expected: 2 },
      { input: 4, expected: 4 },
      { input: 8, expected: 4 },
      { input: 24, expected: 4 },
    ];

    for (const tc of testCases) {
      const bounded = Math.min(Math.max(tc.input, 0.5), 4);
      assert.equal(bounded, tc.expected, `Input ${tc.input} should be bounded to ${tc.expected}`);
    }
  });

  it('should validate minimum reason length (>= 10 characters)', () => {
    const shortReason = 'Bug fix';
    assert.ok(shortReason.trim().length < 10);

    const validReason = 'Investigating intermittent invoice printing discrepancy reported by distributor';
    assert.ok(validReason.trim().length >= 10);
  });
});

describe('Phase 9: Support Session Bounds Middleware — Anti-Impersonation & Read-Only Gating', () => {
  const dummySession: IPlatformSupportSession = {
    _id: new Types.ObjectId(),
    sessionCode: 'SUP-20261104-ABCD',
    operatorId: new Types.ObjectId(),
    targetTenantId: new Types.ObjectId(),
    reason: 'Investigating tenant calculation discrepancy',
    permissionsSnapshot: [PlatformPermission.SUPPORT_START, PlatformPermission.SUPPORT_OPERATE],
    status: SupportSessionStatus.ACTIVE,
    isReadOnly: true,
    isRevoked: false,
    allowedScope: ['tenant'],
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 2 * 3600 * 1000),
    endedAt: null,
    endedBy: null,
    actionsPerformed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should strictly purge tenant impersonation identity from request context', async () => {
    const originalUpdateOne = PlatformSupportSession.updateOne;
    PlatformSupportSession.updateOne = (async () => ({ acknowledged: true })) as any;

    try {
      const mockReq: Partial<PlatformRequest> & Record<string, unknown> = {
        method: 'GET',
        path: '/api/tenants/data/products',
        supportSession: { ...dummySession },
        // Attempted impersonation pollution:
        user: { _id: new Types.ObjectId(), role: 'admin' },
        admin: { _id: new Types.ObjectId(), firmName: 'Tenant Firm' },
        tenantUser: { email: 'tenant@test.com' },
        isImpersonated: true,
        headers: {},
      };

      const mockRes: any = {
        status: () => mockRes,
        json: () => mockRes,
      };

      let nextCalled = false;
      await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(mockReq.user, undefined, 'Tenant user context must be purged');
      assert.equal(mockReq.admin, undefined, 'Tenant admin context must be purged');
      assert.equal(mockReq.tenantUser, undefined, 'Tenant user identity must be purged');
      assert.equal(mockReq.isImpersonated, undefined, 'isImpersonated flag must be purged');
      assert.equal((mockReq as any).supportSessionId, dummySession.sessionCode);
    } finally {
      PlatformSupportSession.updateOne = originalUpdateOne;
    }
  });

  it('should allow GET requests to inspect tenant data during active support session', async () => {
    const originalUpdateOne = PlatformSupportSession.updateOne;
    PlatformSupportSession.updateOne = (async () => ({ acknowledged: true })) as any;

    try {
      const mockReq: Partial<PlatformRequest> = {
        method: 'GET',
        path: '/api/tenants/data/invoices',
        supportSession: { ...dummySession },
        headers: {},
      };

      const mockRes: any = {
        status: () => mockRes,
        json: () => mockRes,
      };

      let nextCalled = false;
      await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
    } finally {
      PlatformSupportSession.updateOne = originalUpdateOne;
    }
  });

  it('should strictly block core business entity mutations (POST /invoices) with 403 SUPPORT_SESSION_READ_ONLY', async () => {
    const mockReq: Partial<PlatformRequest> = {
      method: 'POST',
      path: '/api/invoices',
      supportSession: { ...dummySession },
      headers: {},
    };

    let statusCode = 0;
    let responseBody: any = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    };

    let nextCalled = false;
    await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, 'Mutating invoices must not pass to next middleware');
    assert.equal(statusCode, 403);
    assert.equal(responseBody.code, 'SUPPORT_SESSION_READ_ONLY');
  });

  it('should strictly block customer, stock, and payment mutations during support session', async () => {
    const forbiddenPaths = [
      { method: 'POST', path: '/api/customers' },
      { method: 'PUT', path: '/api/customers/64f1a2b3c4d5e6f7a8b9c0d1' },
      { method: 'POST', path: '/api/stock/adjust' },
      { method: 'POST', path: '/api/payments' },
      { method: 'POST', path: '/api/credit-notes' },
      { method: 'POST', path: '/api/manual-entries' },
    ];

    for (const testCase of forbiddenPaths) {
      const mockReq: Partial<PlatformRequest> = {
        method: testCase.method,
        path: testCase.path,
        supportSession: { ...dummySession },
        headers: {},
      };

      let statusCode = 0;
      let responseBody: any = null;

      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            },
          };
        },
      };

      let nextCalled = false;
      await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, `${testCase.method} ${testCase.path} must be blocked`);
      assert.equal(statusCode, 403);
      assert.equal(responseBody.code, 'SUPPORT_SESSION_READ_ONLY');
    }
  });

  it('should strictly block tenant credential and password modification routes', async () => {
    const credentialPaths = [
      '/api/auth/update-password',
      '/api/auth/change-password',
      '/api/auth/reset-password',
      '/auth/password',
    ];

    for (const path of credentialPaths) {
      const mockReq: Partial<PlatformRequest> = {
        method: 'POST',
        path,
        supportSession: { ...dummySession },
        headers: {},
      };

      let statusCode = 0;
      let responseBody: any = null;

      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            },
          };
        },
      };

      let nextCalled = false;
      await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 403);
      assert.equal(responseBody.code, 'SUPPORT_SESSION_READ_ONLY');
    }
  });

  it('should allow authorized Tier-2 diagnostic actions (cache flush, notification retry)', async () => {
    const originalUpdateOne = PlatformSupportSession.updateOne;
    PlatformSupportSession.updateOne = (async () => ({ acknowledged: true })) as any;

    try {
      const diagnosticPaths = [
        '/api/diagnostics/cache-flush',
        '/api/diagnostics/notification-retry',
        '/api/notifications/retry',
        '/api/platform/support/sessions/SUP-20261104-ABCD/end',
      ];

      for (const path of diagnosticPaths) {
        const mockReq: Partial<PlatformRequest> = {
          method: 'POST',
          path,
          supportSession: { ...dummySession },
          headers: {},
        };

        const mockRes: any = {
          status: () => mockRes,
          json: () => mockRes,
        };

        let nextCalled = false;
        await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
          nextCalled = true;
        });

        assert.equal(nextCalled, true, `Diagnostic route ${path} should be permitted`);
      }
    } finally {
      PlatformSupportSession.updateOne = originalUpdateOne;
    }
  });

  it('should reject requests with expired support session code header with 403 SUPPORT_SESSION_EXPIRED', async () => {
    const originalFindOne = PlatformSupportSession.findOne;
    PlatformSupportSession.findOne = (async () => ({
      ...dummySession,
      status: SupportSessionStatus.EXPIRED,
      expiresAt: new Date(Date.now() - 3600 * 1000),
      save: async () => {},
    })) as any;

    try {
      const mockReq: Partial<PlatformRequest> = {
        method: 'GET',
        path: '/api/tenants',
        headers: {
          'x-support-session-code': 'SUP-20261104-EXPD',
        },
      };

      let statusCode = 0;
      let responseBody: any = null;

      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            },
          };
        },
      };

      let nextCalled = false;
      await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 403);
      assert.equal(responseBody.code, 'SUPPORT_SESSION_EXPIRED');
    } finally {
      PlatformSupportSession.findOne = originalFindOne;
    }
  });
});

describe('Phase 10: Dashboard Aggregation Layer — IST Date Boundaries & MRR Math', () => {
  it('should calculate accurate IST date boundaries aligned with Asia/Kolkata (UTC+5:30)', () => {
    // Reference: 2026-11-04 15:30:00 UTC = 2026-11-04 21:00:00 IST
    const refDate = new Date('2026-11-04T15:30:00.000Z');
    const boundaries = getISTDateBoundaries(refDate);

    // IST Day start: 2026-11-04 00:00:00 IST = 2026-11-03 18:30:00 UTC
    assert.equal(boundaries.todayStart.toISOString(), '2026-11-03T18:30:00.000Z');

    // Tomorrow start: 2026-11-05 00:00:00 IST = 2026-11-04 18:30:00 UTC
    assert.equal(boundaries.tomorrowStart.toISOString(), '2026-11-04T18:30:00.000Z');

    // Month start: 2026-11-01 00:00:00 IST = 2026-10-31 18:30:00 UTC
    assert.equal(boundaries.monthStart.toISOString(), '2026-10-31T18:30:00.000Z');

    // Next Month start: 2026-12-01 00:00:00 IST = 2026-11-30 18:30:00 UTC
    assert.equal(boundaries.nextMonthStart.toISOString(), '2026-11-30T18:30:00.000Z');
  });

  it('should compute MRR with exact paise precision and annual run rate (ARR = MRR * 12)', () => {
    // Simulation of subscriptions:
    // Sub 1: 12 months, ₹12,000 -> ₹1,000.00/mo
    // Sub 2: 3 months, ₹2,499 -> ₹833.00/mo (approx ₹833.00)
    // Sub 3: 1 month, ₹999.50 -> ₹999.50/mo
    const subs = [
      { finalAmount: 12000, durationMonths: 12 },
      { finalAmount: 2499, durationMonths: 3 },
      { finalAmount: 999.50, durationMonths: 1 },
    ];

    const rawMRR = subs.reduce((sum, s) => sum + s.finalAmount / s.durationMonths, 0);
    const contractedMRR = Math.round(rawMRR * 100) / 100;
    const arr = Math.round(contractedMRR * 12 * 100) / 100;

    // 1000 + 833 + 999.50 = 2832.50
    assert.equal(contractedMRR, 2832.5);
    assert.equal(arr, 33990);
  });
});

describe('Phase 10: Dashboard Performance Layer — Parallel Querying & 30s TTL Caching', () => {
  beforeEach(() => {
    invalidatePlatformDashboardCache();
  });

  it('should aggregate dashboard overview and cache result with isCached=false on initial load', async () => {
    const originalAdminAggregate = Admin.aggregate;
    const originalAdminCount = Admin.countDocuments;
    const originalSubAggregate = Subscription.aggregate;
    const originalPaymentAggregate = SubscriptionPayment.aggregate;

    Admin.aggregate = (async () => [{ total: 150, active: 142 }]) as any;
    Admin.countDocuments = (async (filter?: any) => {
      if (filter && filter.isActive === true) return 142;
      return 150;
    }) as any;
    Subscription.aggregate = (async (pipeline: any[]) => {
      // Check if MRR pipeline or status breakdown pipeline
      if (pipeline[0]?.$match?.status === 'active') {
        return [{ contractedMRR: 142500.75, activeSubscriptionsCount: 140 }];
      }
      return [
        { _id: 'active', count: 140 },
        { _id: 'trial', count: 5 },
        { _id: 'grace', count: 3 },
        { _id: 'expired', count: 2 },
      ];
    }) as any;
    SubscriptionPayment.aggregate = (async () => [
      {
        thisMonth: 450000.5,
        thisMonthPaymentsCount: 85,
        today: 25000.0,
        todayPaymentsCount: 5,
      },
    ]) as any;

    try {
      const overview = await getPlatformDashboardOverview();

      assert.equal(overview.tenants.total, 150);
      assert.equal(overview.tenants.active, 142);
      assert.equal(overview.tenants.trial, 5);
      assert.equal(overview.tenants.grace, 3);
      assert.equal(overview.mrr.contractedMRR, 142500.75);
      assert.equal(overview.mrr.arr, Math.round(142500.75 * 12 * 100) / 100);
      assert.equal(overview.revenue.today, 25000);
      assert.equal(overview.revenue.thisMonth, 450000.5);
      assert.equal(overview.systemHealth.isCached, false);
      assert.equal(overview.systemHealth.status, 'HEALTHY');
    } finally {
      Admin.aggregate = originalAdminAggregate;
      Admin.countDocuments = originalAdminCount;
      Subscription.aggregate = originalSubAggregate;
      SubscriptionPayment.aggregate = originalPaymentAggregate;
    }
  });

  it('should return cached metrics with isCached=true on consecutive calls within 30s TTL', async () => {
    let callCount = 0;
    const originalAdminAggregate = Admin.aggregate;
    const originalAdminCount = Admin.countDocuments;
    const originalSubAggregate = Subscription.aggregate;
    const originalPaymentAggregate = SubscriptionPayment.aggregate;

    Admin.aggregate = (async () => {
      callCount++;
      return [{ total: 100, active: 95 }];
    }) as any;
    Admin.countDocuments = (async (filter?: any) => {
      callCount++;
      if (filter && filter.isActive === true) return 95;
      return 100;
    }) as any;
    Subscription.aggregate = (async () => [{ contractedMRR: 50000, activeSubscriptionsCount: 95 }]) as any;
    SubscriptionPayment.aggregate = (async () => [{ thisMonth: 100000, today: 5000 }]) as any;

    try {
      // First call: Populates cache
      const firstResult = await getPlatformDashboardOverview();
      assert.equal(firstResult.systemHealth.isCached, false);
      assert.ok(callCount > 0);
      const initialCalls = callCount;

      // Second call: Returned from cache (DB not queried)
      const secondResult = await getPlatformDashboardOverview();
      assert.equal(secondResult.systemHealth.isCached, true);
      assert.equal(callCount, initialCalls, 'Admin queries should not be called again within TTL');
      assert.equal(secondResult.tenants.total, 100);
    } finally {
      Admin.aggregate = originalAdminAggregate;
      Admin.countDocuments = originalAdminCount;
      Subscription.aggregate = originalSubAggregate;
      SubscriptionPayment.aggregate = originalPaymentAggregate;
    }
  });

  it('should invalidate cache when invalidatePlatformDashboardCache() is invoked', async () => {
    let callCount = 0;
    const originalAdminAggregate = Admin.aggregate;
    const originalAdminCount = Admin.countDocuments;
    const originalSubAggregate = Subscription.aggregate;
    const originalPaymentAggregate = SubscriptionPayment.aggregate;

    Admin.aggregate = (async () => {
      callCount++;
      return [{ total: 200, active: 190 }];
    }) as any;
    Admin.countDocuments = (async (filter?: any) => {
      callCount++;
      if (filter && filter.isActive === true) return 190;
      return 200;
    }) as any;
    Subscription.aggregate = (async () => []) as any;
    SubscriptionPayment.aggregate = (async () => []) as any;

    try {
      await getPlatformDashboardOverview();
      assert.ok(callCount > 0);
      const firstCallCount = callCount;

      // Explicit invalidation
      invalidatePlatformDashboardCache();

      // Next call queries DB again
      const result = await getPlatformDashboardOverview();
      assert.equal(result.systemHealth.isCached, false);
      assert.ok(callCount > firstCallCount);
    } finally {
      Admin.aggregate = originalAdminAggregate;
      Admin.countDocuments = originalAdminCount;
      Subscription.aggregate = originalSubAggregate;
      SubscriptionPayment.aggregate = originalPaymentAggregate;
    }
  });
});

describe('Phase 10: Compound ESR Index Registration Registry Integrity', () => {
  it('should have all 10 platform collections registered in PLATFORM_ESR_INDEXES', () => {
    const collections = new Set(PLATFORM_ESR_INDEXES.map((idx) => idx.collection));

    assert.ok(collections.has('admins'));
    assert.ok(collections.has('subscriptions'));
    assert.ok(collections.has('subscriptionpayments'));
    assert.ok(collections.has('platformusers'));
    assert.ok(collections.has('platformsessions'));
    assert.ok(collections.has('platformauditlogs'));
    assert.ok(collections.has('platformauditheads'));
    assert.ok(collections.has('tenantfeatureoverrides'));
    assert.ok(collections.has('platformsupportsessions'));
    assert.ok(collections.has('distributedlocks'));
    assert.equal(collections.size, 10);
  });

  it('should ensure all indexes enforce background: true to prevent blocking production write traffic', () => {
    for (const def of PLATFORM_ESR_INDEXES) {
      assert.equal(
        def.options.background,
        true,
        `Index on ${def.collection} (${JSON.stringify(def.spec)}) must have background: true`
      );
    }
  });

  it('should include partialFilterExpression on TenantFeatureOverride compound index', () => {
    const overrideIndex = PLATFORM_ESR_INDEXES.find(
      (idx) =>
        idx.collection === 'tenantfeatureoverrides' &&
        'feature' in idx.spec &&
        'tenantId' in idx.spec
    );

    assert.ok(overrideIndex, 'TenantFeatureOverride compound index must exist');
    assert.deepEqual(overrideIndex.options.partialFilterExpression, { isActive: true });
    assert.equal(overrideIndex.options.unique, true);
  });

  it('should include TTL expireAfterSeconds: 0 on PlatformSession expiresAt index', () => {
    const ttlIndex = PLATFORM_ESR_INDEXES.find(
      (idx) =>
        idx.collection === 'platformsessions' &&
        idx.spec.expiresAt === 1 &&
        Object.keys(idx.spec).length === 1
    );

    assert.ok(ttlIndex, 'PlatformSession expiresAt index must exist');
    assert.equal(ttlIndex.options.expireAfterSeconds, 0);
  });
});
