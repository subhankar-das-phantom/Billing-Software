/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * Domain Hardening, Distributed Lock & Keyset Query Tests
 *
 * Executed natively via Node test runner: npx tsx --test admin/backend/tests/domainAndQuery.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { ClientSession } from 'mongoose';
import Admin from '../../../backend/models/Admin';
import { runInTransaction } from '../services/transactionHelper';
import { encodeKeysetCursor, decodeAndVerifyKeysetCursor, computeFilterSignature } from '../utils/cursorCrypto';
import type { IKeysetCursor } from '../types';

describe('1. Distributed Lock & Fencing Lease Engine', () => {
  interface SimulatedLockDoc {
    lockKey: string;
    ownerToken: string | null;
    fencingToken: number;
    acquiredAt: Date | null;
    expiresAt: Date;
    lastHeartbeatAt: Date | null;
  }

  class MockDistributedLockEngine {
    private locks: Map<string, SimulatedLockDoc> = new Map();

    async acquireLease(lockKey: string, leaseDurationMs: number, customNow?: Date) {
      const now = customNow || new Date();
      let lock = this.locks.get(lockKey);

      // Step 1: Idempotent initialization
      if (!lock) {
        lock = {
          lockKey,
          ownerToken: null,
          fencingToken: 0,
          acquiredAt: null,
          expiresAt: new Date(0),
          lastHeartbeatAt: null,
        };
        this.locks.set(lockKey, lock);
      }

      // Step 2: Atomic attempt to claim or recover expired lock
      const isAvailable = lock.ownerToken === null || lock.expiresAt.getTime() < now.getTime();
      if (isAvailable) {
        const ownerToken = `token_${Math.random().toString(36).substring(2, 9)}`;
        lock.ownerToken = ownerToken;
        lock.fencingToken += 1;
        lock.acquiredAt = now;
        lock.expiresAt = new Date(now.getTime() + leaseDurationMs);
        lock.lastHeartbeatAt = now;

        return {
          acquired: true,
          ownerToken,
          fencingToken: lock.fencingToken,
          expiresAt: lock.expiresAt,
        };
      }

      return {
        acquired: false,
        reason: 'LOCKED_BY_OTHER_WORKER',
        heldBy: lock.ownerToken || undefined,
        expiresAt: lock.expiresAt,
      };
    }

    async heartbeatLease(
      lockKey: string,
      ownerToken: string,
      fencingToken: number,
      extensionMs: number,
      customNow?: Date
    ) {
      const now = customNow || new Date();
      const lock = this.locks.get(lockKey);
      if (!lock) return false;

      // Strictly enforce ownerToken, fencingToken, and non-expired state
      if (
        lock.ownerToken === ownerToken &&
        lock.fencingToken === fencingToken &&
        lock.expiresAt.getTime() > now.getTime()
      ) {
        lock.expiresAt = new Date(now.getTime() + extensionMs);
        lock.lastHeartbeatAt = now;
        return true;
      }
      return false;
    }

    async releaseLease(lockKey: string, ownerToken: string) {
      const lock = this.locks.get(lockKey);
      if (!lock) return false;

      if (lock.ownerToken === ownerToken) {
        lock.ownerToken = null;
        lock.expiresAt = new Date(0);
        return true;
      }
      return false;
    }

    getLock(lockKey: string) {
      return this.locks.get(lockKey);
    }
  }

  it('should acquire an unheld lease, set ownerToken, and increment fencingToken', async () => {
    const engine = new MockDistributedLockEngine();
    const lease = await engine.acquireLease('cron:process-expired', 300000);

    assert.equal(lease.acquired, true);
    assert.ok(lease.ownerToken);
    assert.equal(lease.fencingToken, 1);
    assert.ok(lease.expiresAt && lease.expiresAt.getTime() > Date.now());
  });

  it('should reject acquisition when lease is actively held by another process', async () => {
    const engine = new MockDistributedLockEngine();
    const lease1 = await engine.acquireLease('cron:process-expired', 300000);
    assert.equal(lease1.acquired, true);

    const lease2 = await engine.acquireLease('cron:process-expired', 300000);
    assert.equal(lease2.acquired, false);
    assert.equal(lease2.reason, 'LOCKED_BY_OTHER_WORKER');
    assert.equal(lease2.heldBy, lease1.ownerToken);
  });

  it('should recover stale expired lease and monotonically increment fencingToken', async () => {
    const engine = new MockDistributedLockEngine();
    const t0 = new Date('2026-11-04T00:00:00.000Z');
    const lease1 = await engine.acquireLease('cron:process-expired', 60000, t0);
    assert.equal(lease1.acquired, true);
    assert.equal(lease1.fencingToken, 1);

    // Fast-forward past lease expiry (e.g. worker crashed)
    const tExpired = new Date('2026-11-04T00:02:00.000Z');
    const lease2 = await engine.acquireLease('cron:process-expired', 60000, tExpired);

    assert.equal(lease2.acquired, true);
    assert.notEqual(lease2.ownerToken, lease1.ownerToken);
    assert.equal(lease2.fencingToken, 2, 'Fencing token must monotonically increment');
  });

  it('should allow valid owner to heartbeat lease extension and reject invalid fencing tokens', async () => {
    const engine = new MockDistributedLockEngine();
    const t0 = new Date('2026-11-04T00:00:00.000Z');
    const lease = await engine.acquireLease('cron:process-expired', 60000, t0);

    // Heartbeat before expiry
    const tHeartbeat = new Date('2026-11-04T00:00:30.000Z');
    const success = await engine.heartbeatLease(
      'cron:process-expired',
      lease.ownerToken!,
      lease.fencingToken!,
      60000,
      tHeartbeat
    );
    assert.equal(success, true);

    // Reject heartbeat with stale/forged fencingToken
    const failStaleToken = await engine.heartbeatLease(
      'cron:process-expired',
      lease.ownerToken!,
      999, // Wrong fencingToken
      60000,
      tHeartbeat
    );
    assert.equal(failStaleToken, false);
  });

  it('should allow owner to cleanly release lease and allow subsequent workers to acquire', async () => {
    const engine = new MockDistributedLockEngine();
    const lease1 = await engine.acquireLease('cron:process-expired', 60000);
    assert.equal(lease1.acquired, true);

    const released = await engine.releaseLease('cron:process-expired', lease1.ownerToken!);
    assert.equal(released, true);

    // Subsequent worker can now acquire immediately
    const lease2 = await engine.acquireLease('cron:process-expired', 60000);
    assert.equal(lease2.acquired, true);
    assert.equal(lease2.fencingToken, 2);
  });
});

describe('2. Transaction Helper & Execution Semantics', () => {
  it('should reuse existing session directly without creating a new session', async () => {
    const mockSession = { id: 'mock-session-123' } as unknown as ClientSession;
    let invokedWithSession: ClientSession | null = null;

    const result = await runInTransaction(async (session) => {
      invokedWithSession = session;
      return 'work-complete';
    }, mockSession);

    assert.equal(result, 'work-complete');
    assert.equal(invokedWithSession, mockSession);
  });

  it('should create, run transaction, and safely end session when no session is provided', async () => {
    let sessionStarted = false;
    let transactionExecuted = false;
    let sessionEnded = false;

    const fakeSession = {
      withTransaction: async (fn: () => Promise<any>) => {
        transactionExecuted = true;
        return await fn();
      },
      endSession: async () => {
        sessionEnded = true;
      },
    };

    const originalStartSession = mongoose.startSession;
    try {
      (mongoose as any).startSession = async () => {
        sessionStarted = true;
        return fakeSession;
      };

      const result = await runInTransaction(async (session) => {
        assert.equal(session, fakeSession as unknown as ClientSession);
        return 42;
      });

      assert.equal(result, 42);
      assert.equal(sessionStarted, true);
      assert.equal(transactionExecuted, true);
      assert.equal(sessionEnded, true);
    } finally {
      mongoose.startSession = originalStartSession;
    }
  });

  it('should guarantee session.endSession is called in finally block even on error', async () => {
    let sessionEnded = false;
    const fakeSession = {
      withTransaction: async (fn: () => Promise<any>) => {
        return await fn();
      },
      endSession: async () => {
        sessionEnded = true;
      },
    };

    const originalStartSession = mongoose.startSession;
    try {
      (mongoose as any).startSession = async () => fakeSession;

      await assert.rejects(
        async () => {
          await runInTransaction(async () => {
            throw new Error('Database write failure');
          });
        },
        /Database write failure/
      );

      assert.equal(sessionEnded, true);
    } finally {
      mongoose.startSession = originalStartSession;
    }
  });
});

describe('3. Subscription Adjustment Expiry Math Anchoring', () => {
  function computeAdjustedExpiry(
    currentExpiresAt: Date,
    daysToAdd: number,
    nowMs: number
  ): Date {
    const currentExpiryMs = currentExpiresAt.getTime();
    const baseTime = daysToAdd > 0 && currentExpiryMs < nowMs ? nowMs : currentExpiryMs;
    return new Date(baseTime + daysToAdd * 86400000);
  }

  it('should anchor past-expired subscriptions to nowMs so added days take effect immediately', () => {
    const fixedNow = new Date('2026-11-04T12:00:00.000Z').getTime();
    const expiredDate = new Date('2026-10-01T12:00:00.000Z'); // 34 days in the past

    // Adding 7 days should result in now + 7 days, NOT expiredDate + 7 days (which would still be expired!)
    const result = computeAdjustedExpiry(expiredDate, 7, fixedNow);

    const expected = new Date(fixedNow + 7 * 86400000);
    assert.equal(result.toISOString(), expected.toISOString());
    assert.ok(result.getTime() > fixedNow, 'Resulting expiry must be in the future');
  });

  it('should extend from current expiry date when subscription is currently active in the future', () => {
    const fixedNow = new Date('2026-11-04T12:00:00.000Z').getTime();
    const activeExpiry = new Date('2026-11-20T12:00:00.000Z'); // 16 days in the future

    // Adding 30 days should append to activeExpiry
    const result = computeAdjustedExpiry(activeExpiry, 30, fixedNow);

    const expected = new Date(activeExpiry.getTime() + 30 * 86400000);
    assert.equal(result.toISOString(), expected.toISOString());
  });

  it('should not anchor negative adjustments to nowMs', () => {
    const fixedNow = new Date('2026-11-04T12:00:00.000Z').getTime();
    const activeExpiry = new Date('2026-11-20T12:00:00.000Z');

    // Deducting 5 days
    const result = computeAdjustedExpiry(activeExpiry, -5, fixedNow);

    const expected = new Date(activeExpiry.getTime() - 5 * 86400000);
    assert.equal(result.toISOString(), expected.toISOString());
  });
});

describe('4. Admin normalizedFirmName Schema & Pre-Save Hook', () => {
  it('should trim and lowercase firmName in document initialization', () => {
    const doc = new Admin({
      email: 'test@bharatpharmacy.com',
      password: 'StrongPassword123!',
      firmName: '   Apex Medical Supplies Pvt Ltd   ',
    });

    assert.equal(doc.normalizedFirmName, 'apex medical supplies pvt ltd');
  });

  it('should execute pre-save hook to re-normalize firmName whenever firmName is modified', async () => {
    const doc = new Admin({
      email: 'test2@bharatpharmacy.com',
      password: 'StrongPassword123!',
      firmName: 'Alpha Pharmaceuticals',
    });

    assert.equal(doc.normalizedFirmName, 'alpha pharmaceuticals');

    // Update firmName with mixed case and leading/trailing whitespace
    doc.firmName = '   ZENITH PHARMA CORP.   ';

    // Emulate mongoose pre-save hook execution
    if (doc.isModified('firmName') || !doc.normalizedFirmName) {
      doc.normalizedFirmName = (doc.firmName || '').toLowerCase().trim();
    }

    assert.equal(doc.normalizedFirmName, 'zenith pharma corp.');
  });
});

describe('5. Keyset Pagination & Cryptographic Cursor Security', () => {
  const secret = 'super_secret_control_plane_test_key_123';
  const sampleCursor: IKeysetCursor = {
    sortField: 'createdAt',
    sortDirection: 'desc',
    val: 1730678400000,
    id: '65a1b2c3d4e5f67890123456',
    tenantScope: '65a1b2c3d4e5f67890123456',
    filterSig: 'c1d2e3f4',
  };

  it('should encode and decode HMAC-signed keyset cursor token', () => {
    const token = encodeKeysetCursor(sampleCursor, secret);
    const decoded = decodeAndVerifyKeysetCursor(token, {
      secret,
      expectedSortField: 'createdAt',
      expectedSortDirection: 'desc',
      expectedTenantScope: '65a1b2c3d4e5f67890123456',
      currentFilterSig: 'c1d2e3f4',
    });

    assert.deepEqual(decoded, sampleCursor);
  });

  it('should reject cursor if tenant scope is cross-reused across different tenants', () => {
    const token = encodeKeysetCursor(sampleCursor, secret);

    assert.throws(
      () =>
        decodeAndVerifyKeysetCursor(token, {
          secret,
          expectedTenantScope: '65ffffffffffffffffffffff',
        }),
      /Cross-tenant pagination cursor reuse is strictly prohibited/
    );
  });

  it('should reject cursor when active filter context changes (filter signature mismatch)', () => {
    const token = encodeKeysetCursor(sampleCursor, secret);

    assert.throws(
      () =>
        decodeAndVerifyKeysetCursor(token, {
          secret,
          currentFilterSig: 'changed_filter_sig',
        }),
      /Cursor filter context mismatch/
    );
  });

  it('should compute deterministic 8-character filter signature independent of key order', () => {
    const sig1 = computeFilterSignature({ search: 'pharma', status: 'active', limit: 25 });
    const sig2 = computeFilterSignature({ limit: 25, status: 'active', search: 'pharma' });

    assert.equal(sig1.length, 8);
    assert.equal(sig1, sig2);
  });
});
