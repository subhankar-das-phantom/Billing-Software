/**
 * Bharat Enterprise Billing System — Platform Control Plane Authentication Hardening & Rate Limiting QA
 * Automated test suite verifying lockout thresholds, auto-unlock, constant-time verification,
 * client IP normalization, rate limiting enforcement, and MFA retry limits.
 *
 * Test Suites:
 *   1. Lockout Threshold Validation (5 consecutive failures -> 6th locked with HTTP 423 & isLocked: true)
 *   2. Auto-Unlock Behavior (expired lockUntil allows subsequent correct login)
 *   3. Password Verification Timing Consistency (Constant-time dummy bcrypt verification)
 *   4. Client IP Header Parsing & Rate Limiting (X-Forwarded-For edge cases, IP isolation, 429 enforcement)
 *   5. Multi-Factor Verification Retry Limits (Invalid TOTP & backup code lockout, reset on success)
 *
 * Executed via:
 *   npx tsx --tsconfig admin/backend/tsconfig.json --test admin/backend/tests/authLockoutAndRateLimit.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Models
import PlatformUser from '../models/PlatformUser';
import PlatformSession from '../models/PlatformSession';

// Services & Controllers
import * as platformAuthService from '../auth/platformAuthService';
import * as platformAuthController from '../controllers/platformAuthController';
import * as mfaService from '../auth/mfaService';
import { extractClientIp, normalizeIp } from '../utils/clientIp';
import {
  PlatformRateLimiter,
  createPlatformRateLimiter,
  platformAuthRateLimiter,
  platformAuthLimiterInstance,
} from '../middleware/platformRateLimitMiddleware';
import { PlatformRole, PlatformPermission, PlatformRequest } from '../types';

// Isolated local MongoDB connection for auth hardening tests
const LOCAL_TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/test_platform_auth_lockout_isolated';

// Helper mock response object
function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    cookies: {} as Record<string, any>,
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
    setHeader(name: string, val: string) {
      this.headers[name.toLowerCase()] = String(val);
      return this;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    },
    cookie(name: string, val: any, opts?: any) {
      this.cookies[name] = { val, opts };
      return this;
    },
    clearCookie(name: string) {
      delete this.cookies[name];
      return this;
    },
  };
  return res;
}

// ═════════════════════════════════════════════════════════════════════
// GLOBAL TEST DATABASE SETUP & TEARDOWN
// ═════════════════════════════════════════════════════════════════════

before(async () => {
  await mongoose.connect(LOCAL_TEST_MONGO_URI);
  const collections = ['platformusers', 'platformsessions'];
  for (const coll of collections) {
    try {
      await mongoose.connection.collection(coll).deleteMany({});
    } catch {
      // Collection may not exist yet
    }
  }
});

after(async () => {
  try {
    const collections = ['platformusers', 'platformsessions'];
    for (const coll of collections) {
      await mongoose.connection.collection(coll).deleteMany({});
    }
    await mongoose.disconnect();
  } catch {
    // Ignore teardown errors
  }
});

beforeEach(async () => {
  await PlatformUser.deleteMany({});
  await PlatformSession.deleteMany({});
  platformAuthLimiterInstance.reset();
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 1: LOCKOUT THRESHOLD VALIDATION
// ═════════════════════════════════════════════════════════════════════

describe('Suite 1: Platform Authentication Lockout Thresholds', () => {
  it('should increment failedLoginAttempts on invalid passwords and lock account on 5th attempt', async () => {
    const testPassword = 'StrongPassword2026!';
    const user = await PlatformUser.create({
      email: 'lockout-test@bharatplatform.com',
      password: testPassword,
      fullName: 'Lockout Test Operator',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      failedLoginAttempts: 0,
      mfaEnabled: false,
    });

    // 1 to 4 invalid attempts: each returns 401
    for (let attempt = 1; attempt <= 4; attempt++) {
      const mockReq: any = {
        body: { email: user.email, password: 'WrongPassword' },
        headers: { 'x-forwarded-for': '192.0.2.1' },
        socket: {},
      };
      const mockRes = createMockRes();

      await platformAuthController.login(mockReq as PlatformRequest, mockRes);

      assert.equal(mockRes.statusCode, 401);
      assert.equal(mockRes.body.success, false);
      assert.equal(mockRes.body.error, 'Invalid email or password');
      assert.equal(mockRes.body.isLocked, false);

      const dbUser = await PlatformUser.findById(user._id);
      assert.equal(dbUser?.failedLoginAttempts, attempt);
      assert.equal(dbUser?.lockUntil, null);
      assert.equal(dbUser?.isLocked, false);
    }

    // 5th invalid attempt: records 5th failure and locks the account
    const fifthReq: any = {
      body: { email: user.email, password: 'WrongPassword' },
      headers: { 'x-forwarded-for': '192.0.2.1' },
      socket: {},
    };
    const fifthRes = createMockRes();

    await platformAuthController.login(fifthReq as PlatformRequest, fifthRes);

    assert.equal(fifthRes.statusCode, 401);
    const lockedUser = await PlatformUser.findById(user._id);
    assert.equal(lockedUser?.failedLoginAttempts, 5);
    assert.notEqual(lockedUser?.lockUntil, null);
    assert.ok(lockedUser!.lockUntil!.getTime() > Date.now());
    assert.equal(lockedUser?.isLocked, true);
  });

  it('should reject the 6th login attempt with HTTP 423 Locked and isLocked: true', async () => {
    const testPassword = 'StrongPassword2026!';
    const user = await PlatformUser.create({
      email: 'sixth-attempt@bharatplatform.com',
      password: testPassword,
      fullName: 'Sixth Attempt Operator',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      failedLoginAttempts: 0,
      mfaEnabled: false,
    });

    // Exhaust 5 attempts
    for (let i = 1; i <= 5; i++) {
      const req: any = {
        body: { email: user.email, password: 'WrongPassword' },
        headers: {},
        socket: {},
      };
      const res = createMockRes();
      await platformAuthController.login(req as PlatformRequest, res);
    }

    // 6th attempt with wrong password: rejected with HTTP 423 and isLocked: true
    const sixthReq: any = {
      body: { email: user.email, password: 'WrongPassword' },
      headers: {},
      socket: {},
    };
    const sixthRes = createMockRes();

    await platformAuthController.login(sixthReq as PlatformRequest, sixthRes);

    assert.equal(sixthRes.statusCode, 423);
    assert.equal(sixthRes.body.success, false);
    assert.equal(sixthRes.body.code, 'ACCOUNT_LOCKED');
    assert.equal(sixthRes.body.isLocked, true);
    assert.match(sixthRes.body.error, /Account is temporarily locked/);

    // 7th attempt with the CORRECT password while locked: MUST STILL BE REJECTED with 423
    const correctPasswordReq: any = {
      body: { email: user.email, password: testPassword },
      headers: {},
      socket: {},
    };
    const correctPasswordRes = createMockRes();

    await platformAuthController.login(correctPasswordReq as PlatformRequest, correctPasswordRes);

    assert.equal(correctPasswordRes.statusCode, 423);
    assert.equal(correctPasswordRes.body.success, false);
    assert.equal(correctPasswordRes.body.code, 'ACCOUNT_LOCKED');
    assert.equal(correctPasswordRes.body.isLocked, true);
  });

  it('should isolate lockout state per user account (unaffected accounts can still log in)', async () => {
    const userA = await PlatformUser.create({
      email: 'user-a@bharatplatform.com',
      password: 'PasswordUserA123!',
      fullName: 'User A',
      role: PlatformRole.SUPPORT_AGENT,
      isActive: true,
      failedLoginAttempts: 5,
      lockUntil: new Date(Date.now() + 15 * 60 * 1000), // Locked
      mfaEnabled: false,
    });

    const userB = await PlatformUser.create({
      email: 'user-b@bharatplatform.com',
      password: 'PasswordUserB123!',
      fullName: 'User B',
      role: PlatformRole.SUPPORT_AGENT,
      isActive: true,
      failedLoginAttempts: 0,
      lockUntil: null,
      mfaEnabled: false,
    });

    // User A should be locked
    const resA = createMockRes();
    await platformAuthController.login(
      { body: { email: userA.email, password: 'PasswordUserA123!' }, headers: {}, socket: {} } as any,
      resA
    );
    assert.equal(resA.statusCode, 423);
    assert.equal(resA.body.isLocked, true);

    // User B should succeed with HTTP 200
    const resB = createMockRes();
    await platformAuthController.login(
      { body: { email: userB.email, password: 'PasswordUserB123!' }, headers: {}, socket: {} } as any,
      resB
    );
    assert.equal(resB.statusCode, 200);
    assert.equal(resB.body.success, true);
    assert.notEqual(resB.body.token, undefined);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 2: AUTO-UNLOCK BEHAVIOR
// ═════════════════════════════════════════════════════════════════════

describe('Suite 2: Platform Authentication Auto-Unlock Behavior', () => {
  it('should automatically allow login with correct password after lockUntil timestamp has passed', async () => {
    const correctPassword = 'ValidPlatformPassword123!';
    // Create an account with lockUntil 5 seconds in the past
    const user = await PlatformUser.create({
      email: 'autounlock@bharatplatform.com',
      password: correctPassword,
      fullName: 'Auto Unlock Operator',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      failedLoginAttempts: 5,
      lockUntil: new Date(Date.now() - 5000), // Expired lockout
      mfaEnabled: false,
    });

    // Verify virtual indicates it is no longer locked
    assert.equal(user.isLocked, false);

    // Login with the correct password
    const req: any = {
      body: { email: user.email, password: correctPassword },
      headers: { 'x-forwarded-for': '198.51.100.5' },
      socket: {},
    };
    const res = createMockRes();

    await platformAuthController.login(req as PlatformRequest, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.mfaRequired, false);
    assert.notEqual(res.body.token, undefined);

    // Verify database document was auto-cleared: failedLoginAttempts = 0, lockUntil = null
    const updatedUser = await PlatformUser.findById(user._id);
    assert.equal(updatedUser?.failedLoginAttempts, 0);
    assert.equal(updatedUser?.lockUntil, null);
    assert.equal(updatedUser?.isLocked, false);
    assert.notEqual(updatedUser?.lastLoginAt, null);
  });

  it('should reset failure attempts to 0 and allow fresh attempts after auto-unlock', async () => {
    const correctPassword = 'ValidPlatformPassword123!';
    const user = await PlatformUser.create({
      email: 'fresh-counter@bharatplatform.com',
      password: correctPassword,
      fullName: 'Fresh Counter Operator',
      role: PlatformRole.SUPPORT_AGENT,
      isActive: true,
      failedLoginAttempts: 5,
      lockUntil: new Date(Date.now() - 1000), // Expired lockout
      mfaEnabled: false,
    });

    // Login correctly to clear counters
    const successReq: any = {
      body: { email: user.email, password: correctPassword },
      headers: {},
      socket: {},
    };
    const successRes = createMockRes();
    await platformAuthController.login(successReq as PlatformRequest, successRes);
    assert.equal(successRes.statusCode, 200);

    // Now fail password once: failedLoginAttempts must be 1 (not 6)
    const failReq: any = {
      body: { email: user.email, password: 'WrongPassword' },
      headers: {},
      socket: {},
    };
    const failRes = createMockRes();
    await platformAuthController.login(failReq as PlatformRequest, failRes);

    assert.equal(failRes.statusCode, 401);
    const reloaded = await PlatformUser.findById(user._id);
    assert.equal(reloaded?.failedLoginAttempts, 1);
    assert.equal(reloaded?.lockUntil, null);
    assert.equal(reloaded?.isLocked, false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 3: PASSWORD VERIFICATION TIMING CONSISTENCY
// ═════════════════════════════════════════════════════════════════════

describe('Suite 3: Constant-Time Password Verification & Timing Consistency', () => {
  it('should execute non-trivial cryptographic operations when authenticating non-existent users', async () => {
    // Non-existent user email
    const nonExistentEmail = 'definitely.not.found@bharatplatform.com';
    const testPassword = 'ArbitraryTestPassword123!';

    const start = performance.now();
    try {
      await platformAuthService.login(nonExistentEmail, testPassword);
      assert.fail('Should have thrown 401');
    } catch (err: any) {
      assert.equal(err.statusCode, 401);
      assert.equal(err.message, 'Invalid email or password');
    }
    const elapsedMs = performance.now() - start;

    // A dummy bcrypt comparison with 12 rounds takes > 25ms on modern CPUs.
    // If fast-path exit was present, elapsed time would be < 3ms.
    assert.ok(
      elapsedMs >= 20,
      `Non-existent account login completed too quickly (${elapsedMs.toFixed(2)}ms). Bcrypt dummy comparison was bypassed.`
    );
  });

  it('should maintain comparable response times between existing accounts with wrong passwords and non-existent accounts', async () => {
    const existingUser = await PlatformUser.create({
      email: 'timing-existing@bharatplatform.com',
      password: 'RealTargetPassword123!',
      fullName: 'Timing Existing User',
      role: PlatformRole.SUPPORT_AGENT,
      isActive: true,
      failedLoginAttempts: 0,
      mfaEnabled: false,
    });

    const nonExistentEmail = 'timing-nonexistent@bharatplatform.com';
    const wrongPassword = 'IncorrectPassword999!';

    // Measure existing user failure time (average of 3 attempts)
    const existingTimes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      try {
        await platformAuthService.login(existingUser.email, wrongPassword);
      } catch (err: any) {
        assert.equal(err.statusCode, 401);
      }
      existingTimes.push(performance.now() - t0);
    }

    // Measure non-existent user failure time (average of 3 attempts)
    const nonExistentTimes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      try {
        await platformAuthService.login(nonExistentEmail, wrongPassword);
      } catch (err: any) {
        assert.equal(err.statusCode, 401);
      }
      nonExistentTimes.push(performance.now() - t0);
    }

    const avgExisting = existingTimes.reduce((a, b) => a + b, 0) / existingTimes.length;
    const avgNonExistent = nonExistentTimes.reduce((a, b) => a + b, 0) / nonExistentTimes.length;

    // Both should take cryptographic time (> 25ms)
    assert.ok(avgExisting >= 25, `Existing avg too fast: ${avgExisting.toFixed(2)}ms`);
    assert.ok(avgNonExistent >= 25, `Non-existent avg too fast: ${avgNonExistent.toFixed(2)}ms`);

    // Ratio between existing and non-existent average times should be within reasonable variance (< 3.0x factor)
    const ratio = Math.max(avgExisting, avgNonExistent) / Math.min(avgExisting, avgNonExistent);
    assert.ok(
      ratio < 3.0,
      `Timing variance too high between existing (${avgExisting.toFixed(2)}ms) and non-existent (${avgNonExistent.toFixed(2)}ms), ratio=${ratio.toFixed(2)}`
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 4: CLIENT IP HEADER VALIDATION & RATE LIMITING
// ═════════════════════════════════════════════════════════════════════

describe('Suite 4: Client IP Extraction & Rate Limiting Behavior', () => {
  describe('Client IP Extraction & Edge Cases', () => {
    it('should extract leftmost IP from comma-separated X-Forwarded-For header', () => {
      const mockReq: any = {
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
        },
      };
      const ip = extractClientIp(mockReq);
      assert.equal(ip, '203.0.113.195');
    });

    it('should extract first entry when X-Forwarded-For is an array of strings', () => {
      const mockReq: any = {
        headers: {
          'x-forwarded-for': ['198.51.100.42, 10.0.0.1', '10.0.0.2'],
        },
      };
      const ip = extractClientIp(mockReq);
      assert.equal(ip, '198.51.100.42');
    });

    it('should strip IPv4-mapped IPv6 prefixes (::ffff:)', () => {
      const mockReq: any = {
        headers: {
          'x-forwarded-for': '::ffff:192.0.2.1',
        },
      };
      const ip = extractClientIp(mockReq);
      assert.equal(ip, '192.0.2.1');
    });

    it('should strip trailing port numbers from IPv4 addresses', () => {
      const mockReq: any = {
        headers: {
          'x-forwarded-for': '198.51.100.99:54321',
        },
      };
      const ip = extractClientIp(mockReq);
      assert.equal(ip, '198.51.100.99');
    });

    it('should strip port numbers from bracketed IPv6 addresses', () => {
      const mockReq: any = {
        headers: {
          'x-forwarded-for': '[2001:db8::1]:8080',
        },
      };
      const ip = extractClientIp(mockReq);
      assert.equal(ip, '2001:db8::1');
    });

    it('should fall back to X-Real-IP if X-Forwarded-For is missing', () => {
      const mockReq: any = {
        headers: {
          'x-real-ip': '203.0.113.88',
        },
      };
      const ip = extractClientIp(mockReq);
      assert.equal(ip, '203.0.113.88');
    });

    it('should fall back to req.ip or socket.remoteAddress if forwarded headers are absent', () => {
      const mockReqSocket: any = {
        headers: {},
        socket: { remoteAddress: '192.168.1.50' },
      };
      assert.equal(extractClientIp(mockReqSocket), '192.168.1.50');

      const mockReqExpress: any = {
        headers: {},
        ip: '10.10.10.10',
      };
      assert.equal(extractClientIp(mockReqExpress), '10.10.10.10');
    });

    it('should safely fall back to 127.0.0.1 on empty or null requests', () => {
      assert.equal(extractClientIp(null), '127.0.0.1');
      assert.equal(extractClientIp({ headers: {} }), '127.0.0.1');
      assert.equal(normalizeIp(''), '');
    });
  });

  describe('Rate Limiter Behavior & Headers', () => {
    it('should enforce rate limits and respond with HTTP 429 when max threshold is exceeded', () => {
      const limiter = createPlatformRateLimiter({
        windowMs: 5000,
        max: 3, // Allow 3 requests
        message: 'Rate limit test exceeded',
      });

      const clientIp = '198.51.100.77';
      const results: number[] = [];

      for (let i = 1; i <= 4; i++) {
        const req: any = {
          headers: { 'x-forwarded-for': clientIp },
          socket: {},
        };
        const res = createMockRes();
        let nextCalled = false;

        limiter.middleware(req, res, () => {
          nextCalled = true;
        });

        if (nextCalled) {
          results.push(200);
        } else {
          results.push(res.statusCode);
          assert.equal(res.statusCode, 429);
          assert.equal(res.body.success, false);
          assert.equal(res.body.code, 'RATE_LIMIT_EXCEEDED');
          assert.equal(res.body.error, 'Rate limit test exceeded');
          assert.ok(Number(res.getHeader('Retry-After')) > 0);
          assert.equal(res.getHeader('RateLimit-Remaining'), '0');
        }
      }

      assert.deepEqual(results, [200, 200, 200, 429]);
    });

    it('should maintain independent counters per distinct client IP address', () => {
      const limiter = createPlatformRateLimiter({
        windowMs: 5000,
        max: 2,
      });

      const ip1 = '203.0.113.1';
      const ip2 = '203.0.113.2';

      // IP 1 uses all 2 requests
      for (let i = 0; i < 2; i++) {
        const req: any = { headers: { 'x-forwarded-for': ip1 } };
        const res = createMockRes();
        let nextCalled = false;
        limiter.middleware(req, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
      }

      // IP 1 3rd attempt is blocked (429)
      const blockedReq: any = { headers: { 'x-forwarded-for': ip1 } };
      const blockedRes = createMockRes();
      let blockedNext = false;
      limiter.middleware(blockedReq, blockedRes, () => { blockedNext = true; });
      assert.equal(blockedNext, false);
      assert.equal(blockedRes.statusCode, 429);

      // IP 2 1st attempt must succeed (isolated from IP 1)
      const allowedReq: any = { headers: { 'x-forwarded-for': ip2 } };
      const allowedRes = createMockRes();
      let allowedNext = false;
      limiter.middleware(allowedReq, allowedRes, () => { allowedNext = true; });
      assert.equal(allowedNext, true);
    });

    it('should reset limits when manually cleared or after window expiration', () => {
      const limiter = createPlatformRateLimiter({
        windowMs: 50, // Short window 50ms
        max: 1,
      });

      const clientIp = '198.51.100.12';

      // 1st request: pass
      const req1: any = { headers: { 'x-forwarded-for': clientIp } };
      const res1 = createMockRes();
      let next1 = false;
      limiter.middleware(req1, res1, () => { next1 = true; });
      assert.equal(next1, true);

      // 2nd request immediately: blocked
      const req2: any = { headers: { 'x-forwarded-for': clientIp } };
      const res2 = createMockRes();
      let next2 = false;
      limiter.middleware(req2, res2, () => { next2 = true; });
      assert.equal(next2, false);
      assert.equal(res2.statusCode, 429);

      // Reset limiter for this key
      limiter.reset(clientIp);

      // 3rd request after reset: passes immediately
      const req3: any = { headers: { 'x-forwarded-for': clientIp } };
      const res3 = createMockRes();
      let next3 = false;
      limiter.middleware(req3, res3, () => { next3 = true; });
      assert.equal(next3, true);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 5: MULTI-FACTOR VERIFICATION RETRY LIMITS
// ═════════════════════════════════════════════════════════════════════

describe('Suite 5: Multi-Factor Verification Retry Limits & Hardening', () => {
  it('should increment failedLoginAttempts on invalid TOTP codes and lock account on 5th failure', async () => {
    // Generate valid MFA setup
    const email = 'mfa-lockout@bharatplatform.com';
    const password = 'SuperMfaPassword123!';
    const mfaSetup = await mfaService.generateMfaSetup(email);

    const user = await PlatformUser.create({
      email,
      password,
      fullName: 'MFA Lockout Operator',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      failedLoginAttempts: 0,
      mfaEnabled: true,
      mfaSecret: mfaSetup.encryptedSecret,
      mfaBackupCodes: mfaSetup.backupCodeHashes,
    });

    // Obtain pending MFA token via login
    const loginResult = await platformAuthService.login(email, password);
    assert.equal(loginResult.mfaRequired, true);
    assert.ok(loginResult.mfaPendingToken);

    // Submit 4 invalid TOTP codes
    for (let attempt = 1; attempt <= 4; attempt++) {
      const req: any = {
        body: {
          mfaPendingToken: loginResult.mfaPendingToken,
          code: '000000', // Invalid code
        },
        headers: { 'x-forwarded-for': '192.0.2.77' },
        socket: {},
      };
      const res = createMockRes();

      await platformAuthController.verifyMfa(req as PlatformRequest, res);

      assert.equal(mockResStatus(res), 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Invalid MFA verification code');
      assert.equal(res.body.isLocked, false);

      const dbUser = await PlatformUser.findById(user._id);
      assert.equal(dbUser?.failedLoginAttempts, attempt);
      assert.equal(dbUser?.lockUntil, null);
      assert.equal(dbUser?.isLocked, false);
    }

    // 5th invalid attempt: locks account
    const fifthReq: any = {
      body: {
        mfaPendingToken: loginResult.mfaPendingToken,
        code: '000000',
      },
      headers: { 'x-forwarded-for': '192.0.2.77' },
      socket: {},
    };
    const fifthRes = createMockRes();
    await platformAuthController.verifyMfa(fifthReq as PlatformRequest, fifthRes);

    assert.equal(mockResStatus(fifthRes), 401);
    const lockedUser = await PlatformUser.findById(user._id);
    assert.equal(lockedUser?.failedLoginAttempts, 5);
    assert.notEqual(lockedUser?.lockUntil, null);
    assert.ok(lockedUser!.lockUntil!.getTime() > Date.now());
    assert.equal(lockedUser?.isLocked, true);

    // 6th attempt: rejected with HTTP 423 and isLocked: true
    const sixthReq: any = {
      body: {
        mfaPendingToken: loginResult.mfaPendingToken,
        code: '000000',
      },
      headers: { 'x-forwarded-for': '192.0.2.77' },
      socket: {},
    };
    const sixthRes = createMockRes();
    await platformAuthController.verifyMfa(sixthReq as PlatformRequest, sixthRes);

    assert.equal(mockResStatus(sixthRes), 423);
    assert.equal(sixthRes.body.success, false);
    assert.equal(sixthRes.body.code, 'ACCOUNT_LOCKED');
    assert.equal(sixthRes.body.isLocked, true);
    assert.match(sixthRes.body.error, /Account is temporarily locked/);
  });

  it('should increment failed attempts and lock account on repeated invalid backup codes', async () => {
    const email = 'backup-code-lockout@bharatplatform.com';
    const password = 'SuperBackupPassword123!';
    const mfaSetup = await mfaService.generateMfaSetup(email);

    const user = await PlatformUser.create({
      email,
      password,
      fullName: 'Backup Code Operator',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      failedLoginAttempts: 4, // 4 failures already
      mfaEnabled: true,
      mfaSecret: mfaSetup.encryptedSecret,
      mfaBackupCodes: mfaSetup.backupCodeHashes,
    });

    const loginResult = await platformAuthService.login(email, password);
    assert.ok(loginResult.mfaPendingToken);

    // Simulate 4 prior failed attempts during MFA stage
    await PlatformUser.updateOne({ _id: user._id }, { failedLoginAttempts: 4 });

    // 5th attempt using an invalid backup code
    const invalidBackupReq: any = {
      body: {
        mfaPendingToken: loginResult.mfaPendingToken,
        code: 'INVALIDCODE',
        isBackupCode: true,
      },
      headers: {},
      socket: {},
    };
    const invalidBackupRes = createMockRes();

    await platformAuthController.verifyMfa(invalidBackupReq as PlatformRequest, invalidBackupRes);

    assert.equal(mockResStatus(invalidBackupRes), 401);
    assert.equal(invalidBackupRes.body.error, 'Invalid or already used backup code');

    const dbUser = await PlatformUser.findById(user._id);
    assert.equal(dbUser?.failedLoginAttempts, 5);
    assert.equal(dbUser?.isLocked, true);

    // 6th attempt is locked with 423
    const nextReq: any = {
      body: {
        mfaPendingToken: loginResult.mfaPendingToken,
        code: 'ANOTHERBAD',
        isBackupCode: true,
      },
      headers: {},
      socket: {},
    };
    const nextRes = createMockRes();
    await platformAuthController.verifyMfa(nextReq as PlatformRequest, nextRes);

    assert.equal(mockResStatus(nextRes), 423);
    assert.equal(nextRes.body.code, 'ACCOUNT_LOCKED');
    assert.equal(nextRes.body.isLocked, true);
  });

  it('should reset failedLoginAttempts to 0 and issue valid session when valid TOTP code is entered', async () => {
    const email = 'mfa-success@bharatplatform.com';
    const password = 'SuccessfulMfaPassword123!';
    const mfaSetup = await mfaService.generateMfaSetup(email);

    const user = await PlatformUser.create({
      email,
      password,
      fullName: 'MFA Success Operator',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      failedLoginAttempts: 3, // Had 3 failed attempts previously
      lockUntil: null,
      mfaEnabled: true,
      mfaSecret: mfaSetup.encryptedSecret,
      mfaBackupCodes: mfaSetup.backupCodeHashes,
    });

    const loginResult = await platformAuthService.login(email, password);
    assert.ok(loginResult.mfaPendingToken);

    // Simulate 4 prior failed attempts during MFA stage
    await PlatformUser.updateOne({ _id: user._id }, { failedLoginAttempts: 4 });

    // Compute valid TOTP code
    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const validCode = mfaService.computeTotpCode(mfaSetup.secret, currentStep);

    const req: any = {
      body: {
        mfaPendingToken: loginResult.mfaPendingToken,
        code: validCode,
      },
      headers: { 'x-forwarded-for': '198.51.100.99' },
      socket: {},
    };
    const res = createMockRes();

    await platformAuthController.verifyMfa(req as PlatformRequest, res);

    assert.equal(mockResStatus(res), 200);
    assert.equal(res.body.success, true);
    assert.notEqual(res.body.user, undefined);
    assert.notEqual(res.cookies.platform_token, undefined);

    // Verify database document reset: failedLoginAttempts = 0
    const dbUser = await PlatformUser.findById(user._id);
    assert.equal(dbUser?.failedLoginAttempts, 0);
    assert.equal(dbUser?.lockUntil, null);
    assert.equal(dbUser?.isLocked, false);
    assert.notEqual(dbUser?.lastLoginAt, null);
  });
});

// Helper to reliably read mock status code
function mockResStatus(res: any): number {
  return res.statusCode;
}
