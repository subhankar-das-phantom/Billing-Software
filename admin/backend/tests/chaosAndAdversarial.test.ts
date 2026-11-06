/**
 * Bharat Enterprise Billing System — Adversarial Security, Penetration & Chaos Test Suite
 *
 * Exhaustive attack simulations across Platform Control Plane (/api/platform)
 * and Tenant Business Plane (/api).
 *
 * Test Suites:
 *   1. Authentication & Token Boundary Breach
 *   2. Privilege Escalation & RBAC Ceiling Violations
 *   3. Support Session Anti-Impersonation & Read-Only Gating
 *   4. Audit Log Cryptographic Tampering & Chain Defense
 *   5. Distributed Lock Fencing & Concurrency Race Chaos
 *   6. Keyset Cursor Forgery & Injection Protection
 *
 * Executed natively via Node 22 test runner:
 *   npx tsx admin/backend/tests/chaosAndAdversarial.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';

// Models
import PlatformUser from '../models/PlatformUser';
import PlatformSession from '../models/PlatformSession';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformAuditHead, AUDIT_GENESIS_HASH } from '../models/PlatformAuditHead';
import PlatformSupportSession from '../models/PlatformSupportSession';
import TenantFeatureOverride, { EMERGENCY_BYPASS_FEATURE } from '../models/TenantFeatureOverride';
import Admin from '../../../backend/models/Admin';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import {
  DistributedLock,
  acquireLease,
  releaseLease,
  heartbeatLease,
} from '../../../backend/models/DistributedLock';

// Auth & Security Services
import {
  login,
  getPlatformJwtSecret,
  sanitizePlatformUser,
} from '../auth/platformAuthService';
import {
  logPlatformAudit,
  verifyAuditChain,
  redactSensitiveFields,
} from '../services/platformAuditService';
import {
  computeCanonicalSha256,
} from '../utils/canonicalJson';
import {
  encodeKeysetCursor,
  decodeAndVerifyKeysetCursor,
  computeFilterSignature,
} from '../utils/cursorCrypto';

// Middleware
import {
  requirePlatformAuth,
  requirePasswordChanged,
} from '../middleware/platformAuthMiddleware';
import {
  requirePlatformPermission,
  requireReason,
} from '../middleware/platformRbacMiddleware';
import {
  enforceSupportSessionBounds,
} from '../middleware/supportSessionMiddleware';

// Controllers
import {
  createUser,
  updateUser,
} from '../controllers/platformUserController';
import {
  listTenants,
  suspendTenant,
  unsuspendTenant,
} from '../controllers/platformTenantController';
import {
  getAuditLogs,
  verifyAuditScope,
} from '../controllers/platformAuditController';
import {
  adjustSubscription,
} from '../controllers/platformSubscriptionController';
import {
  createOverride,
  grantEmergencyBypass,
} from '../controllers/platformFeatureOverrideController';

// Permissions & Types
import {
  PlatformRole,
  PlatformPermission,
  hasPermission,
  canManageRole,
} from '../permissions';
import {
  SupportSessionStatus,
  OverrideType,
  PlatformRequest,
} from '../types';

// Isolated local MongoDB connection for adversarial and chaos testing
const LOCAL_CHAOS_TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/test_chaos_adversarial_isolated';

// Helper mock response
function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, any>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
    cookie(name: string, val: any, opts?: any) {
      this.headers[name] = { val, opts };
      return this;
    },
    clearCookie(name: string) {
      delete this.headers[name];
      return this;
    },
  };
  return res;
}

// ═════════════════════════════════════════════════════════════════════
// GLOBAL TEST SETUP & TEARDOWN
// ═════════════════════════════════════════════════════════════════════

before(async () => {
  await mongoose.connect(LOCAL_CHAOS_TEST_MONGO_URI);
  // Clear isolated test database collections via raw collection API
  const collections = [
    'platformusers',
    'platformsessions',
    'platformauditlogs',
    'platformauditheads',
    'platformsupportsessions',
    'tenantfeatureoverrides',
    'distributedlocks',
    'admins',
    'subscriptions',
    'plans',
  ];
  for (const coll of collections) {
    try {
      await mongoose.connection.collection(coll).deleteMany({});
    } catch {
      // Collection may not exist yet
    }
  }
});

after(async () => {
  const collections = [
    'platformusers',
    'platformsessions',
    'platformauditlogs',
    'platformauditheads',
    'platformsupportsessions',
    'tenantfeatureoverrides',
    'distributedlocks',
    'admins',
    'subscriptions',
    'plans',
  ];
  for (const coll of collections) {
    try {
      await mongoose.connection.collection(coll).deleteMany({});
    } catch {
      // Collection may not exist yet
    }
  }
  await mongoose.disconnect();
});

// ═════════════════════════════════════════════════════════════════════
// 1. AUTHENTICATION & TOKEN BOUNDARY BREACH
// ═════════════════════════════════════════════════════════════════════

describe('1. Authentication & Token Boundary Breach', () => {
  const platformSecret = getPlatformJwtSecret();
  const TENANT_JWT_SECRET = 'separate-tenant-secret-key-1234567890';

  it('should reject cross-plane infiltration using Tenant Admin JWT with 401', async () => {
    // Attacker crafts a valid tenant admin token signed with tenant secret
    const tenantPayload = {
      id: new Types.ObjectId().toString(),
      email: 'tenant_admin@pharmacy.in',
      role: 'admin',
      firmName: 'Apex Medicals',
    };
    const tenantToken = jwt.sign(tenantPayload, TENANT_JWT_SECRET, { expiresIn: '1h' });

    // Attempt Bearer header infiltration
    const reqHeader: any = {
      headers: { authorization: `Bearer ${tenantToken}` },
      cookies: {},
    };
    const resHeader = createMockRes();
    let nextCalled = false;

    await requirePlatformAuth(reqHeader, resHeader, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(resHeader.statusCode, 401);
    assert.equal(resHeader.body.error, 'Invalid or expired platform token.');

    // Attempt cookie infiltration
    const reqCookie: any = {
      headers: {},
      cookies: { platform_token: tenantToken },
    };
    const resCookie = createMockRes();
    nextCalled = false;

    await requirePlatformAuth(reqCookie, resCookie, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(resCookie.statusCode, 401);
    assert.equal(resCookie.body.error, 'Invalid or expired platform token.');
  });

  it('should reject expired platform token with 401', async () => {
    const expiredToken = jwt.sign(
      {
        platformUserId: new Types.ObjectId().toString(),
        sessionId: new Types.ObjectId().toString(),
      },
      platformSecret,
      { expiresIn: '-10s' }
    );

    const req: any = {
      headers: { authorization: `Bearer ${expiredToken}` },
      cookies: {},
    };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlatformAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Invalid or expired platform token.');
  });

  it('should reject forged token signed with rogue secret with 401', async () => {
    const forgedToken = jwt.sign(
      {
        platformUserId: new Types.ObjectId().toString(),
        sessionId: new Types.ObjectId().toString(),
      },
      'attacker_rogue_secret_key_67890',
      { expiresIn: '1h' }
    );

    const req: any = {
      headers: { authorization: `Bearer ${forgedToken}` },
      cookies: {},
    };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlatformAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it('should reject empty, malformed, or missing Authorization header/cookie variations with 401', async () => {
    const variations = [
      { headers: {}, cookies: {} },
      { headers: { authorization: '' }, cookies: {} },
      { headers: { authorization: 'Bearer ' }, cookies: {} },
      { headers: { authorization: 'Bearer   ' }, cookies: {} },
      { headers: { authorization: 'Bearer malformed.jwt.token' }, cookies: {} },
      { headers: { authorization: 'Basic dXNlcjpwYXNz' }, cookies: {} },
      { headers: {}, cookies: { platform_token: '' } },
      { headers: {}, cookies: { platform_token: 'garbage-cookie' } },
    ];

    for (const testCase of variations) {
      const req: any = testCase;
      const res = createMockRes();
      let nextCalled = false;

      await requirePlatformAuth(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
    }
  });

  it('should reject token with missing sessionId or platformUserId claims with 401', async () => {
    // Missing sessionId
    const tokenNoSession = jwt.sign(
      { platformUserId: new Types.ObjectId().toString() },
      platformSecret,
      { expiresIn: '1h' }
    );
    const req1: any = { headers: { authorization: `Bearer ${tokenNoSession}` }, cookies: {} };
    const res1 = createMockRes();
    let nextCalled = false;
    await requirePlatformAuth(req1, res1, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res1.statusCode, 401);
    assert.equal(res1.body.error, 'Malformed platform token.');

    // Missing platformUserId
    const tokenNoUser = jwt.sign(
      { sessionId: new Types.ObjectId().toString() },
      platformSecret,
      { expiresIn: '1h' }
    );
    const req2: any = { headers: { authorization: `Bearer ${tokenNoUser}` }, cookies: {} };
    const res2 = createMockRes();
    nextCalled = false;
    await requirePlatformAuth(req2, res2, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res2.statusCode, 401);
    assert.equal(res2.body.error, 'Malformed platform token.');
  });

  it('should reject revoked session reuse (isRevoked === true) with 401', async () => {
    const user = await PlatformUser.create({
      email: 'revocation_test@bharat.in',
      password: 'password12345',
      fullName: 'Revocation Test User',
      role: PlatformRole.SUPPORT_AGENT,
      isActive: true,
    });

    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');

    const session = await PlatformSession.create({
      platformUserId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isRevoked: true, // REVOKED
    });

    const token = jwt.sign(
      {
        platformUserId: user._id.toString(),
        sessionId: session._id.toString(),
        sessionToken: rawSessionToken,
      },
      platformSecret,
      { expiresIn: '1h' }
    );

    const req: any = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlatformAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Platform session has expired or been revoked.');
  });

  it('should reject session expired in database (expiresAt <= now) with 401', async () => {
    const user = await PlatformUser.create({
      email: 'expired_session_test@bharat.in',
      password: 'password12345',
      fullName: 'Expired Session User',
      role: PlatformRole.SUPPORT_AGENT,
      isActive: true,
    });

    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');

    const session = await PlatformSession.create({
      platformUserId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() - 5000), // EXPIRED IN DB
      isRevoked: false,
    });

    const token = jwt.sign(
      {
        platformUserId: user._id.toString(),
        sessionId: session._id.toString(),
        sessionToken: rawSessionToken,
      },
      platformSecret,
      { expiresIn: '1h' }
    );

    const req: any = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlatformAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Platform session has expired or been revoked.');
  });

  it('should reject session when sessionToken hash does not match tokenHash with 401', async () => {
    const user = await PlatformUser.create({
      email: 'hash_mismatch_test@bharat.in',
      password: 'password12345',
      fullName: 'Hash Mismatch User',
      role: PlatformRole.SUPPORT_AGENT,
      isActive: true,
    });

    const originalToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(originalToken).digest('hex');

    const session = await PlatformSession.create({
      platformUserId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isRevoked: false,
    });

    // Forged session token whose SHA256 does NOT match tokenHash
    const tamperedSessionToken = crypto.randomBytes(32).toString('hex');

    const token = jwt.sign(
      {
        platformUserId: user._id.toString(),
        sessionId: session._id.toString(),
        sessionToken: tamperedSessionToken,
      },
      platformSecret,
      { expiresIn: '1h' }
    );

    const req: any = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlatformAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Session integrity verification failed.');
  });

  it('should reject request when platform user is deactivated (isActive === false) with 403', async () => {
    const deactivatedUser = await PlatformUser.create({
      email: 'deactivated_operator@bharat.in',
      password: 'password12345',
      fullName: 'Deactivated Operator',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: false, // DEACTIVATED
    });

    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');

    const session = await PlatformSession.create({
      platformUserId: deactivatedUser._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isRevoked: false,
    });

    const token = jwt.sign(
      {
        platformUserId: deactivatedUser._id.toString(),
        sessionId: session._id.toString(),
        sessionToken: rawSessionToken,
      },
      platformSecret,
      { expiresIn: '1h' }
    );

    const req: any = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlatformAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'Platform account is inactive or disabled.');
  });

  it('should strictly purge tenant auth context from request object upon platform auth', async () => {
    const user = await PlatformUser.create({
      email: 'purge_context_test@bharat.in',
      password: 'password12345',
      fullName: 'Purge Context User',
      role: PlatformRole.PLATFORM_OWNER,
      isActive: true,
    });

    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');

    const session = await PlatformSession.create({
      platformUserId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isRevoked: false,
    });

    const token = jwt.sign(
      {
        platformUserId: user._id.toString(),
        sessionId: session._id.toString(),
        sessionToken: rawSessionToken,
      },
      platformSecret,
      { expiresIn: '1h' }
    );

    // Request maliciously pre-polluted with tenant business plane auth attributes
    const req: any = {
      headers: { authorization: `Bearer ${token}` },
      cookies: {},
      user: { id: 'tenant_user_1', role: 'admin' },
      userRole: 'admin',
      userModel: 'Admin',
      admin: { firmName: 'Infiltrated Pharmacy' },
    };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlatformAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.ok(req.platformUser);
    assert.ok(req.platformSession);

    // Crucial security invariant: tenant business plane properties MUST be purged
    assert.equal(req.user, undefined, 'Tenant req.user must be purged');
    assert.equal(req.userRole, undefined, 'Tenant req.userRole must be purged');
    assert.equal(req.userModel, undefined, 'Tenant req.userModel must be purged');
    assert.equal(req.admin, undefined, 'Tenant req.admin must be purged');
  });

  it('should enforce requirePasswordChanged: block protected routes when mustChangePassword is true', async () => {
    const userWithTempPassword = {
      mustChangePassword: true,
      role: PlatformRole.SUPPORT_AGENT,
    };

    // Blocked endpoints
    const blockedUrls = [
      '/api/platform/tenants',
      '/api/platform/subscriptions',
      '/api/platform/users',
      '/api/platform/audit',
      '/api/platform/feature-overrides',
    ];

    for (const url of blockedUrls) {
      const req: any = {
        platformUser: userWithTempPassword,
        originalUrl: url,
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePasswordChanged(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, `${url} must be blocked`);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'PASSWORD_CHANGE_REQUIRED');
    }

    // Permitted endpoints for resolution
    const allowedUrls = [
      '/api/platform/auth/change-password',
      '/api/platform/auth/logout',
      '/api/platform/auth/me',
    ];

    for (const url of allowedUrls) {
      const req: any = {
        platformUser: userWithTempPassword,
        originalUrl: url,
      };
      const res = createMockRes();
      let nextCalled = false;

      requirePasswordChanged(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, `${url} must be permitted for resolution`);
    }
  });

  it('should enforce account lockout: trigger 5 consecutive failed logins and block with 423 ACCOUNT_LOCKED', async () => {
    const targetEmail = 'brute_force_victim@bharat.in';
    const correctPassword = 'StrongPassword123!';

    await PlatformUser.create({
      email: targetEmail,
      password: correctPassword,
      fullName: 'Brute Force Target',
      role: PlatformRole.SUPPORT_AGENT,
      isActive: true,
    });

    // 1 to 4 consecutive failed attempts should return HTTP 401
    for (let attempt = 1; attempt <= 4; attempt++) {
      await assert.rejects(
        async () => {
          await login(targetEmail, 'WrongPassword!');
        },
        (err: any) => {
          assert.equal(err.statusCode, 401);
          return true;
        }
      );
    }

    // 5th attempt: threshold reached -> triggers lockout
    await assert.rejects(
      async () => {
        await login(targetEmail, 'WrongPassword!');
      },
      (err: any) => {
        assert.equal(err.statusCode, 401);
        return true;
      }
    );

    // Verify user record has lockUntil set ~15 minutes into the future
    const lockedUser = await PlatformUser.findOne({ email: targetEmail });
    assert.equal(lockedUser?.failedLoginAttempts, 5);
    assert.ok(lockedUser?.lockUntil && lockedUser.lockUntil.getTime() > Date.now());

    // 6th attempt: Even with CORRECT password, account must be locked with HTTP 423
    await assert.rejects(
      async () => {
        await login(targetEmail, correctPassword);
      },
      (err: any) => {
        assert.equal(err.statusCode, 423, 'Must return HTTP 423 Locked');
        assert.equal(err.code, 'ACCOUNT_LOCKED');
        assert.match(err.message, /Account is temporarily locked/);
        return true;
      }
    );

    // Fast forward past lockout duration
    lockedUser!.lockUntil = new Date(Date.now() - 1000);
    await lockedUser!.save();

    // 7th attempt: Once lockout window expires, correct password succeeds and resets counters
    const successResult = await login(targetEmail, correctPassword);
    assert.equal(successResult.mfaRequired, false);
    assert.ok(successResult.token);

    const refreshedUser = await PlatformUser.findOne({ email: targetEmail });
    assert.equal(refreshedUser?.failedLoginAttempts, 0);
    assert.equal(refreshedUser?.lockUntil, null);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 2. PRIVILEGE ESCALATION & RBAC CEILING VIOLATIONS
// ═════════════════════════════════════════════════════════════════════

describe('2. Privilege Escalation & RBAC Ceiling Violations', () => {
  it('should enforce Role Privilege Ceiling matrix across all platform roles', () => {
    // 1. READ_ONLY role forbidden operations
    assert.equal(hasPermission(PlatformRole.READ_ONLY, [], PlatformPermission.TENANTS_MANAGE), false);
    assert.equal(hasPermission(PlatformRole.READ_ONLY, [], PlatformPermission.TENANTS_SUSPEND), false);
    assert.equal(hasPermission(PlatformRole.READ_ONLY, [], PlatformPermission.SUBSCRIPTIONS_MANAGE), false);
    assert.equal(hasPermission(PlatformRole.READ_ONLY, [], PlatformPermission.USERS_MANAGE), false);
    assert.equal(hasPermission(PlatformRole.READ_ONLY, [], PlatformPermission.SUPPORT_START), false);
    assert.equal(hasPermission(PlatformRole.READ_ONLY, [], PlatformPermission.EMERGENCY_BYPASS_MANAGE), false);

    // 2. TELESUPPORT role forbidden operations
    assert.equal(hasPermission(PlatformRole.TELESUPPORT, [], PlatformPermission.TENANT_DATA_VIEW), false);
    assert.equal(hasPermission(PlatformRole.TELESUPPORT, [], PlatformPermission.TENANTS_SUSPEND), false);
    assert.equal(hasPermission(PlatformRole.TELESUPPORT, [], PlatformPermission.SUBSCRIPTIONS_MANAGE), false);
    assert.equal(hasPermission(PlatformRole.TELESUPPORT, [], PlatformPermission.USERS_MANAGE), false);
    assert.equal(hasPermission(PlatformRole.TELESUPPORT, [], PlatformPermission.SUPPORT_START), false);

    // 3. SUPPORT_AGENT role forbidden operations
    assert.equal(hasPermission(PlatformRole.SUPPORT_AGENT, [], PlatformPermission.TENANTS_SUSPEND), false);
    assert.equal(hasPermission(PlatformRole.SUPPORT_AGENT, [], PlatformPermission.SUBSCRIPTIONS_MANAGE), false);
    assert.equal(hasPermission(PlatformRole.SUPPORT_AGENT, [], PlatformPermission.FEATURE_OVERRIDES_MANAGE), false);
    assert.equal(hasPermission(PlatformRole.SUPPORT_AGENT, [], PlatformPermission.USERS_MANAGE), false);
    assert.equal(hasPermission(PlatformRole.SUPPORT_AGENT, [], PlatformPermission.EMERGENCY_BYPASS_MANAGE), false);

    // 4. SUPPORT_ADMIN role forbidden operations
    assert.equal(hasPermission(PlatformRole.SUPPORT_ADMIN, [], PlatformPermission.TENANTS_SUSPEND), false);
    assert.equal(hasPermission(PlatformRole.SUPPORT_ADMIN, [], PlatformPermission.TENANTS_REACTIVATE), false);
    assert.equal(hasPermission(PlatformRole.SUPPORT_ADMIN, [], PlatformPermission.USERS_MANAGE), false);
    assert.equal(hasPermission(PlatformRole.SUPPORT_ADMIN, [], PlatformPermission.EMERGENCY_BYPASS_MANAGE), false);

    // 5. PLATFORM_ADMIN role forbidden operations (EMERGENCY_BYPASS is OWNER only)
    assert.equal(hasPermission(PlatformRole.PLATFORM_ADMIN, [], PlatformPermission.EMERGENCY_BYPASS_MANAGE), false);

    // 6. PLATFORM_OWNER has absolute authority
    for (const perm of Object.values(PlatformPermission)) {
      assert.equal(hasPermission(PlatformRole.PLATFORM_OWNER, [], perm), true);
    }
  });

  it('should enforce 14-day ceiling on SUPPORT_ADMIN subscription adjustments', async () => {
    const supportAdmin = {
      _id: new Types.ObjectId(),
      email: 'support_admin_adjust@bharat.in',
      role: PlatformRole.SUPPORT_ADMIN,
      customPermissions: [],
      isActive: true,
    };

    const dummyTenantId = new Types.ObjectId();

    // Attempt adjustment > 14 days (+15 days)
    const reqExceed: any = {
      platformUser: supportAdmin,
      body: {
        tenantId: dummyTenantId.toString(),
        daysToAdd: 15,
        reason: 'Customer requested extended compensation period',
      },
    };
    const resExceed = createMockRes();

    await adjustSubscription(reqExceed, resExceed, () => {});
    assert.equal(resExceed.statusCode, 403);
    assert.match(resExceed.body.message, /maximum 14-day subscription adjustment ceiling/);

    // Attempt negative adjustment > 14 days (-20 days)
    const reqNegativeExceed: any = {
      platformUser: supportAdmin,
      body: {
        tenantId: dummyTenantId.toString(),
        daysToAdd: -20,
        reason: 'Revoking promotional credits due to non-payment',
      },
    };
    const resNegativeExceed = createMockRes();

    await adjustSubscription(reqNegativeExceed, resNegativeExceed, () => {});
    assert.equal(resNegativeExceed.statusCode, 403);
    assert.match(resNegativeExceed.body.message, /maximum 14-day subscription adjustment ceiling/);
  });

  it('should enforce EMERGENCY_BYPASS_MANAGE restriction on feature override creation', async () => {
    const platformAdmin = {
      _id: new Types.ObjectId(),
      email: 'admin_bypass_attempt@bharat.in',
      role: PlatformRole.PLATFORM_ADMIN,
      customPermissions: [],
      isActive: true,
    };

    const req: any = {
      platformUser: platformAdmin,
      body: {
        tenantId: new Types.ObjectId().toString(),
        feature: EMERGENCY_BYPASS_FEATURE,
        type: OverrideType.ALLOW,
        reason: 'Customer system down; granting emergency access',
      },
    };
    const res = createMockRes();

    await createOverride(req, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /EMERGENCY_BYPASS_MANAGE privilege/);
  });

  it('should prevent PLATFORM_ADMIN from creating PLATFORM_OWNER or peer PLATFORM_ADMIN (privilege ceiling)', async () => {
    const adminUser = {
      _id: new Types.ObjectId(),
      email: 'admin_creator@bharat.in',
      role: PlatformRole.PLATFORM_ADMIN,
      customPermissions: [],
      isActive: true,
    };

    // Attempt creating Owner
    const reqOwner: any = {
      platformUser: adminUser,
      body: {
        email: 'attacker_owner@bharat.in',
        password: 'password12345',
        fullName: 'Escalated Owner',
        role: PlatformRole.PLATFORM_OWNER,
        reason: 'Attempting vertical escalation to owner',
      },
    };
    const resOwner = createMockRes();
    await createUser(reqOwner, resOwner);
    assert.equal(resOwner.statusCode, 403);
    assert.match(resOwner.body.message, /Privilege ceiling/);

    // Attempt creating Peer Admin (horizontal escalation)
    const reqAdmin: any = {
      platformUser: adminUser,
      body: {
        email: 'peer_admin@bharat.in',
        password: 'password12345',
        fullName: 'Peer Admin',
        role: PlatformRole.PLATFORM_ADMIN,
        reason: 'Attempting horizontal escalation to admin',
      },
    };
    const resAdmin = createMockRes();
    await createUser(reqAdmin, resAdmin);
    assert.equal(resAdmin.statusCode, 403);
    assert.match(resAdmin.body.message, /Privilege ceiling/);
  });

  it('should prevent operator from granting custom permissions they do not possess', async () => {
    const supportAdmin = {
      _id: new Types.ObjectId(),
      email: 'support_admin_perm@bharat.in',
      role: PlatformRole.SUPPORT_ADMIN,
      customPermissions: [],
      isActive: true,
    };

    const req: any = {
      platformUser: supportAdmin,
      body: {
        email: 'agent_with_bypass@bharat.in',
        password: 'password12345',
        fullName: 'Agent with elevated bypass',
        role: PlatformRole.SUPPORT_AGENT,
        customPermissions: [PlatformPermission.EMERGENCY_BYPASS_MANAGE],
        reason: 'Attempting to grant emergency bypass to agent',
      },
    };
    const res = createMockRes();
    await createUser(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /Privilege ceiling: Cannot grant custom permission/);
  });

  it('should prevent operator from deactivating own account (anti-self-lockout)', async () => {
    const ownerId = new Types.ObjectId();
    const owner = await PlatformUser.create({
      _id: ownerId,
      email: 'self_lockout_owner@bharat.in',
      password: 'password12345',
      fullName: 'Self Lockout Owner',
      role: PlatformRole.PLATFORM_OWNER,
      isActive: true,
    });

    const req: any = {
      platformUser: owner,
      params: { id: ownerId.toString() },
      body: {
        isActive: false,
        reason: 'Accidental self deactivation attempt',
      },
    };
    const res = createMockRes();
    await updateUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Anti-self-lockout: Operators cannot deactivate their own platform account/);
  });

  it('should prevent operator from modifying own role (anti-self-demotion / elevation)', async () => {
    const ownerId = new Types.ObjectId();
    const owner = await PlatformUser.create({
      _id: ownerId,
      email: 'self_demote_owner@bharat.in',
      password: 'password12345',
      fullName: 'Self Demote Owner',
      role: PlatformRole.PLATFORM_OWNER,
      isActive: true,
    });

    const req: any = {
      platformUser: owner,
      params: { id: ownerId.toString() },
      body: {
        role: PlatformRole.SUPPORT_AGENT,
        reason: 'Attempting self demotion',
      },
    };
    const res = createMockRes();
    await updateUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Anti-self-demotion: Operators cannot modify their own platform role/);
  });

  it('should enforce Last-Owner Protection: cannot deactivate or demote the last remaining active PLATFORM_OWNER', async () => {
    // Delete all existing platform users to ensure exact owner count
    await mongoose.connection.collection('platformusers').deleteMany({});

    const soleOwner = await PlatformUser.create({
      _id: new Types.ObjectId(),
      email: 'sole_surviving_owner@bharat.in',
      password: 'password12345',
      fullName: 'Sole Owner',
      role: PlatformRole.PLATFORM_OWNER,
      isActive: true,
    });

    const secondOperator = {
      _id: new Types.ObjectId(),
      role: PlatformRole.PLATFORM_OWNER,
      customPermissions: [],
      isActive: true,
    };

    // Attempt demoting sole owner
    const reqDemote: any = {
      platformUser: secondOperator,
      params: { id: soleOwner._id.toString() },
      body: {
        role: PlatformRole.PLATFORM_ADMIN,
        reason: 'Attempting to demote sole owner',
      },
    };
    const resDemote = createMockRes();
    await updateUser(reqDemote, resDemote);

    assert.equal(resDemote.statusCode, 400);
    assert.match(resDemote.body.message, /Last owner protection: Cannot deactivate or demote/);

    // Attempt deactivating sole owner
    const reqDeactivate: any = {
      platformUser: secondOperator,
      params: { id: soleOwner._id.toString() },
      body: {
        isActive: false,
        reason: 'Attempting to deactivate sole owner',
      },
    };
    const resDeactivate = createMockRes();
    await updateUser(reqDeactivate, resDeactivate);

    assert.equal(resDeactivate.statusCode, 400);
    assert.match(resDeactivate.body.message, /Last owner protection: Cannot deactivate or demote/);
  });

  it('should fail-closed on administrative mutations when operational reason is missing or < 10 characters', () => {
    const middleware = requireReason(10);

    const invalidBodies = [
      {},
      { reason: '' },
      { reason: 'Too short' }, // 9 chars
      { reason: '         ' }, // Whitespace only
      { reason: 1234567890 }, // Number
      { reason: null },
      { reason: undefined },
    ];

    for (const body of invalidBodies) {
      const req: any = { body };
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, `Body ${JSON.stringify(body)} must be rejected`);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /minimum 10 characters/);
    }

    // Valid reason >= 10 chars
    const validReq: any = {
      body: { reason: '   Customer requested manual data reconciliation after audit   ' },
    };
    const res = createMockRes();
    let nextCalled = false;

    middleware(validReq, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(
      validReq.body.reason,
      'Customer requested manual data reconciliation after audit',
      'Reason must be trimmed'
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// 3. SUPPORT SESSION ANTI-IMPERSONATION & READ-ONLY GATING
// ═════════════════════════════════════════════════════════════════════

describe('3. Support Session Anti-Impersonation & Read-Only Gating', () => {
  const targetTenantId = new Types.ObjectId();
  const operatorId = new Types.ObjectId();

  it('should strictly purge tenant identity and impersonation attributes upon support session detection', async () => {
    const session = await PlatformSupportSession.create({
      sessionCode: 'SUP-20261105-0001',
      operatorId,
      targetTenantId,
      reason: 'Investigating customer invoice reconciliation anomaly',
      permissionsSnapshot: [PlatformPermission.SUPPORT_START, PlatformPermission.SUPPORT_OPERATE],
      status: SupportSessionStatus.ACTIVE,
      isReadOnly: true,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      actionsPerformed: 0,
    });

    const mockReq: any = {
      method: 'GET',
      path: '/api/tenants',
      headers: {
        'x-support-session-code': session.sessionCode,
      },
      // Injected tenant impersonation artifacts
      user: { id: 'tenant_admin_id', email: 'owner@clinic.in' },
      userRole: 'admin',
      userModel: 'Admin',
      admin: { firmName: 'Apollo Healthcare' },
      tenantUser: { username: 'clinic_admin' },
      isImpersonated: true,
    };
    const mockRes = createMockRes();
    let nextCalled = false;

    await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);

    // Anti-Impersonation verification: All tenant properties must be purged
    assert.equal(mockReq.user, undefined, 'req.user must be purged');
    assert.equal(mockReq.userRole, undefined, 'req.userRole must be purged');
    assert.equal(mockReq.userModel, undefined, 'req.userModel must be purged');
    assert.equal(mockReq.admin, undefined, 'req.admin must be purged');
    assert.equal(mockReq.tenantUser, undefined, 'req.tenantUser must be purged');
    assert.equal(mockReq.isImpersonated, undefined, 'req.isImpersonated must be purged');
  });

  it('should reject core business mutations with 403 SUPPORT_SESSION_READ_ONLY across all business endpoints', async () => {
    const session = await PlatformSupportSession.create({
      sessionCode: 'SUP-20261105-0002',
      operatorId,
      targetTenantId,
      reason: 'Diagnosing billing system sync',
      permissionsSnapshot: [PlatformPermission.SUPPORT_START, PlatformPermission.SUPPORT_OPERATE],
      status: SupportSessionStatus.ACTIVE,
      isReadOnly: true,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      actionsPerformed: 0,
    });

    const mutatingEndpoints = [
      { method: 'POST', path: '/api/invoices' },
      { method: 'POST', path: '/api/customers' },
      { method: 'PUT', path: '/api/customers/64f1a2b3c4d5e6f7a8b9c0d1' },
      { method: 'POST', path: '/api/payments' },
      { method: 'POST', path: '/api/products' },
      { method: 'POST', path: '/api/stock-movements' },
      { method: 'POST', path: '/api/credit-notes' },
      { method: 'POST', path: '/api/manual-entries' },
      { method: 'DELETE', path: '/api/invoices/64f1a2b3c4d5e6f7a8b9c0d2' },
      { method: 'PATCH', path: '/api/products/64f1a2b3c4d5e6f7a8b9c0d3' },
    ];

    for (const ep of mutatingEndpoints) {
      const mockReq: any = {
        method: ep.method,
        path: ep.path,
        headers: {
          'x-support-session-code': session.sessionCode,
        },
      };
      const mockRes = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, `${ep.method} ${ep.path} must be blocked`);
      assert.equal(mockRes.statusCode, 403);
      assert.equal(mockRes.body.code, 'SUPPORT_SESSION_READ_ONLY');
      assert.match(mockRes.body.error, /Mutating business entities/);
    }
  });

  it('should reject credential and password tampering with 403 SUPPORT_SESSION_READ_ONLY', async () => {
    const session = await PlatformSupportSession.create({
      sessionCode: 'SUP-20261105-0003',
      operatorId,
      targetTenantId,
      reason: 'Diagnostic routine check',
      permissionsSnapshot: [PlatformPermission.SUPPORT_START, PlatformPermission.SUPPORT_OPERATE],
      status: SupportSessionStatus.ACTIVE,
      isReadOnly: true,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      actionsPerformed: 0,
    });

    const credentialEndpoints = [
      { method: 'PUT', path: '/api/auth/change-password' },
      { method: 'POST', path: '/api/auth/update-password' },
      { method: 'POST', path: '/api/auth/reset-password' },
      { method: 'POST', path: '/auth/password' },
      { method: 'POST', path: '/api/auth/register' },
    ];

    for (const ep of credentialEndpoints) {
      const mockReq: any = {
        method: ep.method,
        path: ep.path,
        headers: {
          'x-support-session-code': session.sessionCode,
        },
      };
      const mockRes = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, `${ep.method} ${ep.path} must be blocked`);
      assert.equal(mockRes.statusCode, 403);
      assert.equal(mockRes.body.code, 'SUPPORT_SESSION_READ_ONLY');
      assert.match(mockRes.body.error, /Credential modifications and authentication route access/);
    }
  });

  it('should reject invalid or non-existent support session codes with 403 SUPPORT_SESSION_EXPIRED', async () => {
    const mockReq: any = {
      method: 'GET',
      path: '/api/tenants',
      headers: {
        'x-support-session-code': 'SUP-20261105-NONE',
      },
    };
    const mockRes = createMockRes();
    let nextCalled = false;

    await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(mockRes.statusCode, 403);
    assert.equal(mockRes.body.code, 'SUPPORT_SESSION_EXPIRED');
    assert.match(mockRes.body.error, /Support session code is invalid/);
  });

  it('should reject expired support sessions and transition status to EXPIRED in database', async () => {
    const expiredSession = await PlatformSupportSession.create({
      sessionCode: 'SUP-20261105-EXPD',
      operatorId,
      targetTenantId,
      reason: 'Expired session testing',
      permissionsSnapshot: [PlatformPermission.SUPPORT_START],
      status: SupportSessionStatus.ACTIVE,
      isReadOnly: true,
      startedAt: new Date(Date.now() - 7200 * 1000),
      expiresAt: new Date(Date.now() - 3600 * 1000), // EXPIRED 1 hour ago
      actionsPerformed: 0,
    });

    const mockReq: any = {
      method: 'GET',
      path: '/api/tenants',
      headers: {
        'x-support-session-code': expiredSession.sessionCode,
      },
    };
    const mockRes = createMockRes();
    let nextCalled = false;

    await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(mockRes.statusCode, 403);
    assert.equal(mockRes.body.code, 'SUPPORT_SESSION_EXPIRED');

    // Verify database record transitioned to EXPIRED
    const updated = await PlatformSupportSession.findById(expiredSession._id);
    assert.equal(updated?.status, SupportSessionStatus.EXPIRED);
    assert.ok(updated?.endedAt);
  });

  it('should prevent cross-tenant pinned support session replay (SUPPORT_SESSION_TENANT_MISMATCH)', async () => {
    const tenantAId = new Types.ObjectId();
    const tenantBId = new Types.ObjectId();

    const sessionA = await PlatformSupportSession.create({
      sessionCode: 'SUP-20261105-TNTA',
      operatorId,
      targetTenantId: tenantAId, // Pinned to Tenant A
      reason: 'Diagnostic access for Tenant A only',
      permissionsSnapshot: [PlatformPermission.SUPPORT_START, PlatformPermission.SUPPORT_OPERATE],
      status: SupportSessionStatus.ACTIVE,
      isReadOnly: true,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      actionsPerformed: 0,
    });

    // Operator attempts to access Tenant B's data
    const mockReq: any = {
      method: 'GET',
      path: `/api/platform/tenants/${tenantBId.toString()}/invoices`,
      params: { id: tenantBId.toString() },
      headers: {
        'x-support-session-code': sessionA.sessionCode,
      },
    };
    const mockRes = createMockRes();
    let nextCalled = false;

    await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(mockRes.statusCode, 403);
    assert.equal(mockRes.body.code, 'SUPPORT_SESSION_TENANT_MISMATCH');
    assert.match(mockRes.body.error, /pinned to a different tenant/);
  });

  it('should permit authorized Tier-2 diagnostic actions and increment actionsPerformed', async () => {
    const session = await PlatformSupportSession.create({
      sessionCode: 'SUP-20261105-DIAG',
      operatorId,
      targetTenantId,
      reason: 'Tier 2 diagnostic testing',
      permissionsSnapshot: [PlatformPermission.SUPPORT_START, PlatformPermission.SUPPORT_OPERATE],
      status: SupportSessionStatus.ACTIVE,
      isReadOnly: true,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      actionsPerformed: 0,
    });

    const diagnosticEndpoints = [
      { method: 'POST', path: '/api/diagnostics/cache-flush' },
      { method: 'POST', path: '/api/notifications/retry' },
      { method: 'POST', path: `/api/platform/support/sessions/${session._id.toString()}/end` },
    ];

    for (const ep of diagnosticEndpoints) {
      const mockReq: any = {
        method: ep.method,
        path: ep.path,
        headers: {
          'x-support-session-code': session.sessionCode,
        },
      };
      const mockRes = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(mockReq as PlatformRequest, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, `Diagnostic endpoint ${ep.path} should be allowed`);
    }

    const refreshed = await PlatformSupportSession.findById(session._id);
    assert.equal(refreshed?.actionsPerformed, 3);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 4. AUDIT LOG CRYPTOGRAPHIC TAMPERING & CHAIN DEFENSE
// ═════════════════════════════════════════════════════════════════════

describe('4. Audit Log Cryptographic Tampering & Chain Defense', () => {
  it('should enforce fatal errors on Mongoose update and delete mutation hooks', async () => {
    // 1. updateOne
    await assert.rejects(
      async () => {
        await PlatformAuditLog.updateOne({ scope: 'global' }, { $set: { reason: 'Tampered reason' } });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./
    );

    // 2. updateMany
    await assert.rejects(
      async () => {
        await PlatformAuditLog.updateMany({}, { $set: { reason: 'Tampered' } });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./
    );

    // 3. replaceOne
    await assert.rejects(
      async () => {
        await PlatformAuditLog.replaceOne({ scope: 'global' }, { reason: 'Replaced' } as any);
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./
    );

    // 4. findOneAndUpdate
    await assert.rejects(
      async () => {
        await PlatformAuditLog.findOneAndUpdate({ scope: 'global' }, { $set: { reason: 'Tampered' } });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./
    );

    // 5. deleteOne
    await assert.rejects(
      async () => {
        await PlatformAuditLog.deleteOne({ scope: 'global' });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./
    );

    // 6. deleteMany
    await assert.rejects(
      async () => {
        await PlatformAuditLog.deleteMany({});
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./
    );

    // 7. findOneAndDelete
    await assert.rejects(
      async () => {
        await PlatformAuditLog.findOneAndDelete({ scope: 'global' });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./
    );

    // 8. doc.save() when !isNew
    const existingLog = await PlatformAuditLog.create({
      scope: 'save_hook_scope',
      sequence: 1,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.test',
      targetType: 'Test',
      targetId: 't1',
      reason: 'Initial log creation',
      previousHash: AUDIT_GENESIS_HASH,
      hash: 'a'.repeat(64),
    });

    existingLog.reason = 'Tampered reason via doc.save()';
    await assert.rejects(
      async () => {
        await existingLog.save();
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./
    );
  });

  it('should detect tampering when audit log document content is directly altered in MongoDB collection', async () => {
    const scope = 'collection_tamper_scope';

    await logPlatformAudit({
      scope,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.tenant.create',
      targetType: 'Tenant',
      targetId: 'tenant_1',
      reason: 'Legitimate onboard action',
    });

    await logPlatformAudit({
      scope,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.tenant.update',
      targetType: 'Tenant',
      targetId: 'tenant_1',
      reason: 'Legitimate plan update action',
    });

    // Verify initial chain integrity
    const initialVerify = await verifyAuditChain(scope);
    assert.equal(initialVerify.valid, true);
    assert.equal(initialVerify.verifiedCount, 2);

    // Attacker bypasses Mongoose middleware using native driver collection mutation
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 2 },
      { $set: { reason: 'ATTACKER_MUTATED_REASON' } }
    );

    // Verification must detect the cryptographic discrepancy
    const tamperedVerify = await verifyAuditChain(scope);
    assert.equal(tamperedVerify.valid, false);
    assert.match(tamperedVerify.error || '', /Cryptographic hash mismatch at sequence 2/);
  });

  it('should detect monotonic sequence skips (e.g. sequence 1 -> sequence 3)', async () => {
    const scope = 'sequence_skip_scope';
    const now = new Date();

    // Canonical payload 1 (Sequence 1)
    const payload1 = {
      scope,
      sequence: 1,
      action: 'platform.test.1',
      targetType: 'Test',
      targetId: 't1',
      reason: 'First entry',
      before: null,
      after: null,
      previousHash: AUDIT_GENESIS_HASH,
      timestamp: now,
    };
    const hash1 = computeCanonicalSha256(payload1);

    // Canonical payload 2 with sequence skip to 3, but chained to hash1
    const payload2 = {
      scope,
      sequence: 3, // GAP: sequence 2 skipped!
      action: 'platform.test.3',
      targetType: 'Test',
      targetId: 't3',
      reason: 'Third entry (sequence skipped)',
      before: null,
      after: null,
      previousHash: hash1,
      timestamp: now,
    };
    const hash2 = computeCanonicalSha256(payload2);

    // Directly insert via raw collection
    await mongoose.connection.collection('platformauditlogs').insertMany([
      {
        scope,
        sequence: 1,
        actorEmail: 'owner@bharat.in',
        actorRole: PlatformRole.PLATFORM_OWNER,
        action: 'platform.test.1',
        targetType: 'Test',
        targetId: 't1',
        reason: 'First entry',
        before: null,
        after: null,
        previousHash: AUDIT_GENESIS_HASH,
        hash: hash1,
        createdAt: now,
      },
      {
        scope,
        sequence: 3,
        actorEmail: 'owner@bharat.in',
        actorRole: PlatformRole.PLATFORM_OWNER,
        action: 'platform.test.3',
        targetType: 'Test',
        targetId: 't3',
        reason: 'Third entry (sequence skipped)',
        before: null,
        after: null,
        previousHash: hash1,
        hash: hash2,
        createdAt: now,
      },
    ]);

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.match(result.error || '', /Monotonic sequence gap detected between sequence 1 and 3/);
  });

  it('should detect broken hash chaining when previousHash is manipulated', async () => {
    const scope = 'broken_chain_scope';

    await logPlatformAudit({
      scope,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.test.1',
      targetType: 'Test',
      targetId: 't1',
      reason: 'First legitimate log',
    });

    await logPlatformAudit({
      scope,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.test.2',
      targetType: 'Test',
      targetId: 't2',
      reason: 'Second legitimate log',
    });

    // Tamper sequence 2 previousHash to point to an unrelated hash
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 2 },
      { $set: { previousHash: 'f'.repeat(64) } }
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    // Hash recomputation or previousHash link mismatch must fail
    assert.ok(result.error);
  });

  it('should detect forged genesis entry with invalid previousHash', async () => {
    const scope = 'invalid_genesis_scope';

    await logPlatformAudit({
      scope,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.genesis',
      targetType: 'Test',
      targetId: 't1',
      reason: 'Genesis action',
    });

    // Tamper sequence 1 previousHash away from AUDIT_GENESIS_HASH
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 1 },
      { $set: { previousHash: 'forged_genesis_hash_0000000000' } }
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.ok(result.error);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 5. DISTRIBUTED LOCK FENCING & CONCURRENCY RACE CHAOS
// ═════════════════════════════════════════════════════════════════════

describe('5. Distributed Lock Fencing & Concurrency Race Chaos', () => {
  const lockKey = 'adversarial:distributed:cron-job';

  beforeEach(async () => {
    await mongoose.connection.collection('distributedlocks').deleteMany({});
  });

  it('should acquire lease, generate UUID ownerToken, and initialize fencingToken to 1', async () => {
    const lease = await acquireLease(lockKey, 10000);

    assert.equal(lease.acquired, true);
    assert.ok(lease.ownerToken);
    assert.equal(typeof lease.ownerToken, 'string');
    assert.equal(lease.fencingToken, 1);
    assert.ok(lease.expiresAt && lease.expiresAt.getTime() > Date.now());

    // Inspect database record
    const lockDoc = await DistributedLock.findOne({ lockKey });
    assert.equal(lockDoc?.ownerToken, lease.ownerToken);
    assert.equal(lockDoc?.fencingToken, 1);
  });

  it('should reject acquisition when lease is actively held by another process', async () => {
    const worker1Lease = await acquireLease(lockKey, 30000);
    assert.equal(worker1Lease.acquired, true);

    // Worker 2 attempts acquisition while lease is actively held
    const worker2Lease = await acquireLease(lockKey, 30000);
    assert.equal(worker2Lease.acquired, false);
    assert.equal(worker2Lease.reason, 'LOCKED_BY_OTHER_WORKER');
    assert.equal(worker2Lease.heldBy, worker1Lease.ownerToken);
  });

  it('should reject heartbeat with outdated or forged fencingToken', async () => {
    const lease = await acquireLease(lockKey, 20000);
    assert.equal(lease.acquired, true);

    // Attempt heartbeat with forged / stale fencingToken (999)
    const success = await heartbeatLease(lockKey, lease.ownerToken!, 999, 20000);
    assert.equal(success, false, 'Heartbeat with invalid fencing token must fail');
  });

  it('should reject heartbeat with forged ownerToken', async () => {
    const lease = await acquireLease(lockKey, 20000);
    assert.equal(lease.acquired, true);

    // Attempt heartbeat with forged ownerToken
    const success = await heartbeatLease(lockKey, 'attacker_forged_uuid', lease.fencingToken!, 20000);
    assert.equal(success, false, 'Heartbeat with forged owner token must fail');
  });

  it('should reject heartbeat on already expired lease', async () => {
    const lease = await acquireLease(lockKey, 5000);
    assert.equal(lease.acquired, true);

    // Force expire lease in database
    await DistributedLock.updateOne(
      { lockKey },
      { $set: { expiresAt: new Date(Date.now() - 10000) } }
    );

    const success = await heartbeatLease(lockKey, lease.ownerToken!, lease.fencingToken!, 20000);
    assert.equal(success, false, 'Heartbeat on expired lease must fail');
  });

  it('should reject release with invalid ownerToken', async () => {
    const lease = await acquireLease(lockKey, 20000);
    assert.equal(lease.acquired, true);

    // Rogue worker attempts to release lease
    const released = await releaseLease(lockKey, 'rogue_worker_token');
    assert.equal(released, false, 'Release with invalid owner token must fail');

    // Verify lease remains held by Worker 1
    const lockDoc = await DistributedLock.findOne({ lockKey });
    assert.equal(lockDoc?.ownerToken, lease.ownerToken);
  });

  it('should cleanly release lease with valid ownerToken and allow next worker to acquire', async () => {
    const lease1 = await acquireLease(lockKey, 20000);
    assert.equal(lease1.acquired, true);

    // Clean release
    const released = await releaseLease(lockKey, lease1.ownerToken!);
    assert.equal(released, true);

    // Worker 2 acquires immediately after release
    const lease2 = await acquireLease(lockKey, 20000);
    assert.equal(lease2.acquired, true);
    assert.notEqual(lease2.ownerToken, lease1.ownerToken);
    assert.equal(lease2.fencingToken, 2, 'Fencing token must increment on subsequent claim');
  });

  it('should atomically resolve concurrent worker races where 10 workers contest an expired lease (Chaos Race)', async () => {
    const raceKey = 'adversarial:race:expired-lease';

    // Step 1: Pre-seed expired lease
    await acquireLease(raceKey, 1000);
    await DistributedLock.updateOne(
      { lockKey: raceKey },
      { $set: { expiresAt: new Date(Date.now() - 5000) } }
    );

    // Step 2: Chaos simulation: 10 concurrent workers simultaneously attempt to claim the expired lock
    const CONCURRENT_WORKERS = 10;
    const promises = Array.from({ length: CONCURRENT_WORKERS }).map(() =>
      acquireLease(raceKey, 60000)
    );

    const results = await Promise.all(promises);

    // Step 3: Assert exactly ONE worker won the race
    const winners = results.filter((r) => r.acquired === true);
    const losers = results.filter((r) => r.acquired === false);

    assert.equal(winners.length, 1, 'Strictly 1 worker must acquire the lease');
    assert.equal(losers.length, CONCURRENT_WORKERS - 1, 'Remaining workers must lose');

    // All losers must report LOCKED_BY_OTHER_WORKER
    for (const loser of losers) {
      assert.equal(loser.reason, 'LOCKED_BY_OTHER_WORKER');
      assert.equal(loser.heldBy, winners[0]!.ownerToken);
    }

    // Verify database document state: fencingToken incremented monotonically
    const finalDoc = await DistributedLock.findOne({ lockKey: raceKey });
    assert.equal(finalDoc?.ownerToken, winners[0]!.ownerToken);
    assert.equal(finalDoc?.fencingToken, 2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 6. KEYSET CURSOR FORGERY & INJECTION PROTECTION
// ═════════════════════════════════════════════════════════════════════

describe('6. Keyset Cursor Forgery & Injection Protection', () => {
  const platformSecret = getPlatformJwtSecret();

  it('should reject cursor with tampered HMAC signature', () => {
    const validCursor = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection: 'desc',
      val: new Date().toISOString(),
      id: new Types.ObjectId().toString(),
      tenantScope: null,
      filterSig: 'abcdef12',
    });

    // Tamper signature by appending characters
    const decodedContainer = JSON.parse(Buffer.from(validCursor, 'base64url').toString('utf8'));
    decodedContainer.s = decodedContainer.s.slice(0, -4) + 'zzzz';
    const tamperedCursor = Buffer.from(JSON.stringify(decodedContainer), 'utf8').toString('base64url');

    assert.throws(
      () => decodeAndVerifyKeysetCursor(tamperedCursor),
      /Forged or corrupted pagination cursor: signature validation failed/
    );
  });

  it('should reject cursor when payload is tampered without re-signing', () => {
    const validCursor = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection: 'desc',
      val: new Date().toISOString(),
      id: new Types.ObjectId().toString(),
      tenantScope: null,
      filterSig: 'abcdef12',
    });

    const decodedContainer = JSON.parse(Buffer.from(validCursor, 'base64url').toString('utf8'));
    // Attacker modifies payload id to skip records
    decodedContainer.p.id = new Types.ObjectId().toString();
    const tamperedCursor = Buffer.from(JSON.stringify(decodedContainer), 'utf8').toString('base64url');

    assert.throws(
      () => decodeAndVerifyKeysetCursor(tamperedCursor),
      /Forged or corrupted pagination cursor: signature validation failed/
    );
  });

  it('should reject cursor signed with unauthorized / rogue secret', () => {
    const forgedCursor = encodeKeysetCursor(
      {
        sortField: 'createdAt',
        sortDirection: 'desc',
        val: new Date().toISOString(),
        id: new Types.ObjectId().toString(),
        tenantScope: null,
        filterSig: 'abcdef12',
      },
      'attacker_rogue_secret_key'
    );

    assert.throws(
      () => decodeAndVerifyKeysetCursor(forgedCursor),
      /Forged or corrupted pagination cursor: signature validation failed/
    );
  });

  it('should prevent Cross-Tenant Cursor Replay Attack', () => {
    const tenantAId = new Types.ObjectId().toString();
    const tenantBId = new Types.ObjectId().toString();

    // Cursor generated and scoped for Tenant A
    const cursorTenantA = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection: 'desc',
      val: new Date().toISOString(),
      id: new Types.ObjectId().toString(),
      tenantScope: tenantAId,
      filterSig: '12345678',
    });

    // Attacker attempts to replay Tenant A's cursor when querying Tenant B
    assert.throws(
      () =>
        decodeAndVerifyKeysetCursor(cursorTenantA, {
          expectedTenantScope: tenantBId,
        }),
      /Cross-tenant pagination cursor reuse is strictly prohibited/
    );
  });

  it('should reject cursor when query filters have drifted (filter context mismatch)', () => {
    const originalFilterSig = computeFilterSignature({ search: 'Apex Pharmacy', status: 'ACTIVE' });
    const cursor = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection: 'desc',
      val: new Date().toISOString(),
      id: new Types.ObjectId().toString(),
      tenantScope: null,
      filterSig: originalFilterSig,
    });

    // User modified filter to 'Zenith Diagnostics'
    const driftedFilterSig = computeFilterSignature({ search: 'Zenith Diagnostics', status: 'ACTIVE' });

    assert.throws(
      () =>
        decodeAndVerifyKeysetCursor(cursor, {
          currentFilterSig: driftedFilterSig,
        }),
      /Cursor filter context mismatch. Active filters have changed; pagination must reset to page 1/
    );
  });

  it('should reject cursor when sort field or direction does not match query expectation', () => {
    const cursor = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection: 'desc',
      val: new Date().toISOString(),
      id: new Types.ObjectId().toString(),
      tenantScope: null,
      filterSig: 'abcdef12',
    });

    // Expected sort field is normalizedFirmName
    assert.throws(
      () =>
        decodeAndVerifyKeysetCursor(cursor, {
          expectedSortField: 'normalizedFirmName',
        }),
      /Cursor sort field mismatch/
    );

    // Expected sort direction is asc
    assert.throws(
      () =>
        decodeAndVerifyKeysetCursor(cursor, {
          expectedSortField: 'createdAt',
          expectedSortDirection: 'asc',
        }),
      /Cursor sort direction mismatch/
    );
  });

  it('should safely reject malformed, non-base64, or non-JSON cursor strings with fail-closed errors', () => {
    const malformedInputs = [
      'not_valid_base64_url!@#$',
      Buffer.from('not json string').toString('base64url'),
      Buffer.from(JSON.stringify({ notP: 1 })).toString('base64url'),
      Buffer.from(JSON.stringify({ p: {} })).toString('base64url'), // missing signature s
      Buffer.from(JSON.stringify({ p: {}, s: 12345 })).toString('base64url'), // s is not string
    ];

    for (const input of malformedInputs) {
      assert.throws(
        () => decodeAndVerifyKeysetCursor(input),
        /Malformed pagination cursor/
      );
    }
  });

  it('should safely handle NoSQL injection object payload in cursor parameter in getAuditLogs controller', async () => {
    // Attacker sends NoSQL injection payload cursor[$gt]= via extended query parser
    const req: any = {
      query: {
        cursor: { $gt: '' }, // Object NoSQL injection attack
        limit: '20',
      },
    };
    const res = createMockRes();

    // getAuditLogs checks `typeof cursor === 'string'`, so object payload is safely ignored
    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('should safely handle NoSQL injection object payload in cursor parameter in listTenants controller', async () => {
    const req: any = {
      query: {
        cursor: { $gt: '' }, // Object NoSQL injection attack
        limit: '25',
      },
    };
    const res = createMockRes();

    await listTenants(req as PlatformRequest, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });
});
