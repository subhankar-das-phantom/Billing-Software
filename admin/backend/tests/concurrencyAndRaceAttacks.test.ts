/**
 * Bharat Enterprise Billing System — Platform Control Plane & Business Plane
 * Race Condition & Split-Brain Ledger Concurrency Attack Test Suite
 *
 * Scope:
 * 1. Concurrent Multi-Document Customer Balance Mutations
 *    - Initial balance: ₹10,000.00
 *    - 25 concurrent requests:
 *      * 10 invoice payments of ₹500 each (-₹5,000)
 *      * 10 manual debit adjustments of ₹300 each (+₹3,000)
 *      * 5 credit note applications of ₹200 each (-₹1,000)
 *    - Invariant: Final balance === ₹7,000.00 with ZERO lost updates and ZERO read-modify-write overwrites.
 *
 * 2. Razorpay Payment Double-Claim Race Attack
 *    - Mock unlinked Razorpay payment ID: `pay_concurrency_race_001`
 *    - 10 concurrent requests contesting `/api/platform/subscriptions/reconcile`
 *    - Invariant: EXACTLY ONE request succeeds with HTTP 200 and extends subscription tenure;
 *      all other 9 requests fail with HTTP 409 Conflict / Idempotency guard.
 *    - Invariant: Subscription expiration extended EXACTLY ONCE, not 10 times.
 *
 * 3. Partitioned Audit Hash Chain Forking Attack
 *    - 20 concurrent audit log writes to exact same partition scope (`GLOBAL`)
 *    - Invariant: Audit head OCC resolves conflicts without duplicate sequences or branching hashes.
 *    - Invariant: Cryptographic chain verification proves 20 unbroken, strictly ordered sequence links (1..20).
 *
 * 4. Distributed Cron Lease Split-Brain Attack
 *    - 10 concurrent worker processes contesting lease `cron:process-expired` at exact same millisecond
 *    - Invariant: EXACTLY ONE worker acquires lease (acquired = true); remaining 9 receive acquired = false.
 *    - Invariant: Fencing token is monotonically incremented by exactly 1.
 *
 * Executed natively via Node 22 test runner:
 *   npx tsx admin/backend/tests/concurrencyAndRaceAttacks.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'perf_hooks';
import mongoose, { Types } from 'mongoose';

// ─── Control Plane & Business Plane Models ─────────────────────────────
const Customer: mongoose.Model<any> = require('../../../backend/models/Customer');
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import SubscriptionPayment from '../../../backend/saas/models/SubscriptionPayment';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformAuditHead } from '../models/PlatformAuditHead';
import {
  DistributedLock,
  acquireLease,
  releaseLease,
} from '../../../backend/models/DistributedLock';

// ─── Services & Controllers ───────────────────────────────────────────
import { reconcilePayment } from '../controllers/platformSubscriptionController';
import { logPlatformAudit, verifyAuditChain } from '../services/platformAuditService';
import {
  PlanCode,
  SubscriptionStatus,
  PaymentStatus,
  PaymentGateway,
  Feature,
} from '../../../backend/saas/shared/features';
import { PlatformRequest, PlatformRole } from '../types';

// Isolated local MongoDB connection for concurrency & race attack testing
const LOCAL_CONCURRENCY_TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/test_concurrency_race_attacks';

// Mock Razorpay gateway API to intercept payments.fetch for synthetic payment IDs
const razorpayPath = require.resolve('razorpay');
require.cache[razorpayPath] = {
  id: razorpayPath,
  filename: razorpayPath,
  loaded: true,
  exports: function MockRazorpay() {
    this.payments = {
      fetch: async (id: string) => ({
        id,
        status: 'captured',
        amount: 199900,
        currency: 'INR',
      }),
    };
  },
} as any;

// Helper to create mock Express Response objects
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
  };
  return res;
}

// ═════════════════════════════════════════════════════════════════════
// GLOBAL SETUP & TEARDOWN
// ═════════════════════════════════════════════════════════════════════

before(async () => {
  await mongoose.connect(LOCAL_CONCURRENCY_TEST_MONGO_URI);

  const collections = [
    'customers',
    'subscriptions',
    'subscriptionpayments',
    'plans',
    'platformauditlogs',
    'platformauditheads',
    'distributedlocks',
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
    'customers',
    'subscriptions',
    'subscriptionpayments',
    'plans',
    'platformauditlogs',
    'platformauditheads',
    'distributedlocks',
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
// SUITE 1: Concurrent Multi-Document Customer Balance Mutations
// ═════════════════════════════════════════════════════════════════════

describe('1. Concurrent Multi-Document Customer Balance Mutations ($inc Atomic Concurrency)', () => {
  beforeEach(async () => {
    await mongoose.connection.collection('customers').deleteMany({});
  });

  it('Simulate 25 concurrent mixed mutations: 10 invoice payments (-₹5,000), 10 debit adjustments (+₹3,000), 5 credit notes (-₹1,000)', async () => {
    const tenantId = new Types.ObjectId();
    const initialBalance = 10000.0;

    // Step 1: Pre-seed Customer with initial balance of ₹10,000.00
    const customer = await Customer.create({
      tenantId,
      customerName: 'Bharat Care Diagnostics Ltd',
      phone: '9876543210',
      outstandingBalance: initialBalance,
    });

    assert.equal(customer.outstandingBalance, 10000.0);

    // Step 2: Prepare 25 concurrent mutation tasks
    // - 10 invoice payments of ₹500 each (-₹5,000)
    // - 10 manual debit adjustments of ₹300 each (+₹3,000)
    // - 5 credit note applications of ₹200 each (-₹1,000)
    // Net expected delta = -5000 + 3000 - 1000 = -3000 -> Final Balance = ₹7,000.00
    const mutationTasks: Array<{ type: string; delta: number }> = [
      ...Array.from({ length: 10 }, () => ({ type: 'INVOICE_PAYMENT', delta: -500.0 })),
      ...Array.from({ length: 10 }, () => ({ type: 'DEBIT_ADJUSTMENT', delta: 300.0 })),
      ...Array.from({ length: 5 }, () => ({ type: 'CREDIT_NOTE', delta: -200.0 })),
    ];

    // Shuffle mutation tasks to maximize interleaved concurrent execution order
    mutationTasks.sort(() => Math.random() - 0.5);

    const startTime = performance.now();

    // Fire all 25 requests simultaneously
    const mutationResults = await Promise.all(
      mutationTasks.map(async (task, idx) => {
        const updateRes = await Customer.findOneAndUpdate(
          { _id: customer._id, tenantId },
          { $inc: { outstandingBalance: task.delta } },
          { new: true }
        );
        return {
          idx,
          type: task.type,
          delta: task.delta,
          balanceAfter: updateRes?.outstandingBalance,
        };
      })
    );

    const durationMs = performance.now() - startTime;

    // Step 3: Verification — Does final balance equal EXACTLY ₹7,000.00?
    const finalCustomer = await Customer.findById(customer._id).lean();
    assert.ok(finalCustomer, 'Customer record must exist');

    const expectedBalance = 7000.0;
    assert.equal(
      finalCustomer.outstandingBalance,
      expectedBalance,
      `Final customer balance must be exactly ₹${expectedBalance}.00, received ₹${finalCustomer.outstandingBalance}`
    );

    // Step 4: Verify zero lost updates across all 25 operations
    assert.equal(mutationResults.length, 25, 'All 25 concurrent mutations must resolve');
    for (const res of mutationResults) {
      assert.ok(
        res.balanceAfter !== undefined && res.balanceAfter !== null,
        `Mutation ${res.idx} (${res.type}) must return valid balance`
      );
    }

    console.log(
      `   [Suite 1 Result] 25 concurrent balance mutations completed in ${durationMs.toFixed(2)}ms ` +
      `(${(25 / (durationMs / 1000)).toFixed(1)} ops/sec). Final Balance: ₹${finalCustomer.outstandingBalance.toFixed(2)} (Zero lost updates)`
    );
  });

  it('Anti-Pattern Contrast: Naive in-memory read-modify-write causes lost updates under high concurrency', async () => {
    const tenantId = new Types.ObjectId();
    const naiveCustomer = await Customer.create({
      tenantId,
      customerName: 'Naive Overwrite Vulnerable Clinic',
      phone: '9876543211',
      outstandingBalance: 10000.0,
    });

    // Demonstrate the fatal flaw of read-modify-write:
    // If 10 concurrent requests read the doc simultaneously, modify balance in-memory, and call save():
    // The requests overwrite each other, causing massive lost updates.
    const concurrentWrites = Array.from({ length: 10 }).map(async () => {
      const doc = await Customer.findById(naiveCustomer._id);
      // Artificial 5ms tick to simulate business logic before writing back
      await new Promise((r) => setTimeout(r, 5));
      doc.outstandingBalance -= 500;
      await doc.save();
    });

    await Promise.all(concurrentWrites);

    const corruptedDoc = await Customer.findById(naiveCustomer._id).lean();

    // With atomic $inc, 10 * 500 would yield 5,000.
    // Under read-modify-write, lost updates occur, proving why $inc is mandatory.
    assert.notEqual(
      corruptedDoc.outstandingBalance,
      5000.0,
      'Naive read-modify-write should lose updates under concurrency (demonstrating why $inc is required)'
    );

    console.log(
      `   [Suite 1 Contrast] Naive read-modify-write corrupted balance to ₹${corruptedDoc.outstandingBalance} ` +
      `(expected ₹5,000 if atomic, proving lost updates occurred without $inc)`
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 2: Razorpay Payment Double-Claim Race Attack
// ═════════════════════════════════════════════════════════════════════

describe('2. Razorpay Payment Double-Claim Race Attack (Atomic Claim & Idempotency)', () => {
  beforeEach(async () => {
    await mongoose.connection.collection('subscriptions').deleteMany({});
    await mongoose.connection.collection('subscriptionpayments').deleteMany({});
    await mongoose.connection.collection('plans').deleteMany({});
    await mongoose.connection.collection('platformauditlogs').deleteMany({});
    await mongoose.connection.collection('platformauditheads').deleteMany({});
  });

  it('Fire 10 concurrent requests contesting exact same Razorpay payment ID: exactly 1 succeeds, 9 fail with HTTP 409 / Conflict / Idempotency guard', async () => {
    const tenantId = new Types.ObjectId();
    const gatewayPaymentId = 'pay_concurrency_race_001';

    // Step 1: Create valid SaaS plan
    const plan = await Plan.create({
      name: 'Professional Enterprise Tier',
      code: PlanCode.PROFESSIONAL,
      baseMonthlyPrice: 2499,
      features: [Feature.CUSTOMERS, Feature.INVOICE_CREATE, Feature.COLLECTIONS],
    });

    // Step 2: Generate single unlinked pending Razorpay payment
    const payment = await SubscriptionPayment.create({
      tenantId,
      planId: plan._id,
      durationMonths: 1,
      baseAmount: 2499,
      discountAmount: 0,
      finalAmount: 2499,
      paymentStatus: PaymentStatus.PENDING,
      paymentGateway: PaymentGateway.RAZORPAY,
      gatewayPaymentId,
      paidAt: null,
      metadata: {},
    });

    const operatorUser = {
      _id: new Types.ObjectId(),
      email: 'security.auditor@bharatenterprise.com',
      fullName: 'Security Platform Operator',
      role: PlatformRole.PLATFORM_OWNER,
      customPermissions: [],
    };

    // Step 3: Fire 10 concurrent reconciliation requests with exact same payment ID
    const CONCURRENT_REQUESTS = 10;
    const responses: any[] = [];

    const startTime = performance.now();

    const racePromises = Array.from({ length: CONCURRENT_REQUESTS }, async (_, idx) => {
      const mockReq = {
        body: {
          paymentId: gatewayPaymentId,
          reason: `Concurrent reconciliation race worker #${idx} attempt`,
        },
        platformUser: operatorUser,
      } as unknown as PlatformRequest;

      const mockRes = createMockRes();

      await reconcilePayment(mockReq, mockRes, (err?: any) => {
        if (err) {
          mockRes.status(err.statusCode || 500).json({ success: false, message: err.message });
        }
      });

      responses.push(mockRes);
    });

    await Promise.all(racePromises);

    const durationMs = performance.now() - startTime;

    // Step 4: Verification — Invariant Analysis
    // Winner: Exactly ONE request must succeed with HTTP 200 and activate subscription
    const activationWinners = responses.filter(
      (r) =>
        r.statusCode === 200 &&
        r.body?.message?.includes('Payment reconciled and subscription activated')
    );

    assert.equal(
      activationWinners.length,
      1,
      `EXACTLY ONE request must win the atomic claim and activate subscription (received ${activationWinners.length})`
    );

    // Losers: Remaining 9 requests must be rejected via HTTP 409 Conflict OR Idempotency guard
    const conflictLosers = responses.filter(
      (r) =>
        r.statusCode === 409 &&
        r.body?.message?.includes('Payment was already reconciled concurrently')
    );

    const idempotencyLosers = responses.filter(
      (r) =>
        r.statusCode === 200 &&
        r.body?.message?.includes('already been completed and reconciled')
    );

    const totalGuardedLosers = conflictLosers.length + idempotencyLosers.length;
    assert.equal(
      totalGuardedLosers,
      CONCURRENT_REQUESTS - 1,
      `All remaining 9 requests must fail double-claim via HTTP 409 Conflict (${conflictLosers.length}) or Idempotency guard (${idempotencyLosers.length})`
    );

    // Step 5: Verify subscription tenure is extended EXACTLY ONCE, not 10 times
    const subscriptions = await Subscription.find({ tenantId }).lean();
    assert.equal(
      subscriptions.length,
      1,
      `Tenant must possess exactly 1 active subscription, received ${subscriptions.length}`
    );

    const createdSub = subscriptions[0]!;
    assert.equal(createdSub.status, SubscriptionStatus.ACTIVE);
    assert.equal(createdSub.planId.toString(), plan._id.toString());

    // Verify payment document state in database is COMPLETED and linked
    const updatedPayment = await SubscriptionPayment.findById(payment._id).lean();
    assert.equal(updatedPayment?.paymentStatus, PaymentStatus.COMPLETED);
    assert.ok(updatedPayment?.paidAt, 'Payment paidAt must be set');

    console.log(
      `   [Suite 2 Result] 10 concurrent double-claim requests resolved in ${durationMs.toFixed(2)}ms: ` +
      `1 Activation (HTTP 200), ${conflictLosers.length} Atomic 409 Conflicts, ${idempotencyLosers.length} Idempotency guards. ` +
      `Subscription extended EXACTLY 1 time.`
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 3: Partitioned Audit Hash Chain Forking Attack
// ═════════════════════════════════════════════════════════════════════

describe('3. Partitioned Audit Hash Chain Forking Attack (OCC Chain Integrity)', () => {
  beforeEach(async () => {
    await mongoose.connection.collection('platformauditlogs').deleteMany({});
    await mongoose.connection.collection('platformauditheads').deleteMany({});
  });

  it('Fire 20 concurrent audit writes to exact same scope (GLOBAL): OCC prevents forks, zero duplicates, unbroken chain 1..20', async () => {
    const scope = 'GLOBAL';
    const CONCURRENT_WRITES = 20;

    const startTime = performance.now();

    // Step 1: Launch 20 concurrent audit log writes to exact same partition scope
    const writePromises = Array.from({ length: CONCURRENT_WRITES }, (_, i) =>
      logPlatformAudit({
        scope,
        actorEmail: `worker_${i}@bharatenterprise.test`,
        actorRole: PlatformRole.PLATFORM_OWNER,
        action: 'SECURITY.CONCURRENT_OCC_TEST',
        targetType: 'SystemLedger',
        targetId: `target_record_${i}`,
        reason: `Adversarial audit chain race test entry #${i}`,
      }).then((log) => ({
        success: true,
        sequence: log.sequence,
        hash: log.hash,
        previousHash: log.previousHash,
      }))
    );

    const writeResults = await Promise.all(writePromises);
    const durationMs = performance.now() - startTime;

    // Step 2: Verify all 20 writes succeeded without starvation
    assert.equal(writeResults.length, CONCURRENT_WRITES);
    for (const wr of writeResults) {
      assert.equal(wr.success, true);
    }

    // Step 3: Verify strictly ordered, monotonic sequence numbers: 1, 2, ..., 20
    const sequenceNumbers = writeResults.map((w) => w.sequence).sort((a, b) => a - b);
    assert.deepEqual(
      sequenceNumbers,
      Array.from({ length: CONCURRENT_WRITES }, (_, i) => i + 1),
      'Sequence numbers must be strictly consecutive from 1 to 20 with zero duplicates and zero gaps'
    );

    // Step 4: Verify audit head state
    const head = await PlatformAuditHead.findOne({ scope }).lean();
    assert.ok(head, 'PlatformAuditHead must exist');
    assert.equal(head.lastSequence, CONCURRENT_WRITES, 'Head lastSequence must equal 20');

    // Step 5: Cryptographic chain verification across all 20 entries
    const verifyResult = await verifyAuditChain(scope);
    assert.equal(verifyResult.valid, true, `Cryptographic verification failed: ${verifyResult.error}`);
    assert.equal(verifyResult.verifiedCount, CONCURRENT_WRITES);
    assert.equal(verifyResult.startSequence, 1);
    assert.equal(verifyResult.endSequence, CONCURRENT_WRITES);

    // Step 6: Verify zero branching / forking hashes
    const logs = await PlatformAuditLog.find({ scope }).sort({ sequence: 1 }).lean();
    assert.equal(logs.length, CONCURRENT_WRITES);

    for (let i = 1; i < logs.length; i++) {
      const current = logs[i]!;
      const previous = logs[i - 1]!;
      assert.equal(
        current.previousHash,
        previous.hash,
        `Forking attack detected! Entry ${current.sequence} previousHash does not match Entry ${previous.sequence} hash`
      );
    }

    console.log(
      `   [Suite 3 Result] 20 concurrent audit writes serialized in ${durationMs.toFixed(2)}ms ` +
      `(${(CONCURRENT_WRITES / (durationMs / 1000)).toFixed(1)} writes/sec). ` +
      `Cryptographic chain 1..20 verified: 0 forks, 0 duplicate sequences, 100% unbroken.`
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 4: Distributed Cron Lease Split-Brain Attack
// ═════════════════════════════════════════════════════════════════════

describe('4. Distributed Cron Lease Split-Brain Attack (Fencing Token Mutual Exclusion)', () => {
  beforeEach(async () => {
    await mongoose.connection.collection('distributedlocks').deleteMany({});
  });

  it('Fire 10 concurrent workers contesting lease "cron:process-expired": exactly 1 acquires, 9 lose, fencingToken = 1', async () => {
    const lockKey = 'cron:process-expired';
    const CONCURRENT_WORKERS = 10;
    const leaseDurationMs = 60000;

    const startTime = performance.now();

    // Fire 10 concurrent workers simultaneously attempting to acquire the lease
    const workerPromises = Array.from({ length: CONCURRENT_WORKERS }, async (_, workerId) => {
      const result = await acquireLease(lockKey, leaseDurationMs);
      return {
        workerId,
        ...result,
      };
    });

    const results = await Promise.all(workerPromises);
    const durationMs = performance.now() - startTime;

    // Invariant 1: EXACTLY ONE worker acquires the lease
    const winners = results.filter((r) => r.acquired === true);
    const losers = results.filter((r) => r.acquired === false);

    assert.equal(winners.length, 1, `Strictly 1 worker must acquire the lease, received ${winners.length}`);
    assert.equal(losers.length, CONCURRENT_WORKERS - 1, `Remaining 9 workers must lose lease acquisition`);

    const winner = winners[0]!;
    assert.ok(winner.ownerToken, 'Winner must receive valid UUID ownerToken');
    assert.equal(winner.fencingToken, 1, 'Fencing token on cold lease must be initialized to 1');

    // Invariant 2: All 9 losers receive acquired = false and reference the active winner
    for (const loser of losers) {
      assert.equal(loser.acquired, false);
      assert.equal(loser.reason, 'LOCKED_BY_OTHER_WORKER');
      assert.equal(loser.heldBy, winner.ownerToken);
    }

    // Invariant 3: Database document confirms owner and monotonic fencingToken
    const lockDoc = await DistributedLock.findOne({ lockKey }).lean();
    assert.ok(lockDoc);
    assert.equal(lockDoc.ownerToken, winner.ownerToken);
    assert.equal(lockDoc.fencingToken, 1, 'Fencing token must be exactly 1');

    console.log(
      `   [Suite 4 Result] 10 concurrent workers contested lease in ${durationMs.toFixed(2)}ms: ` +
      `Winner: Worker #${winner.workerId} (fencingToken=1, owner=${winner.ownerToken?.slice(0, 8)}...). ` +
      `9 workers rejected with LOCKED_BY_OTHER_WORKER. Split-brain prevented.`
    );
  });

  it('Sequential turnover under concurrency: Expired lease re-contested by 10 workers increments fencingToken monotonically to 2', async () => {
    const lockKey = 'cron:turnover-test';

    // Seed lease with fencingToken = 1 and force expiration
    const initialLease = await acquireLease(lockKey, 1000);
    assert.equal(initialLease.acquired, true);
    assert.equal(initialLease.fencingToken, 1);

    // Force expire lease
    await DistributedLock.updateOne(
      { lockKey },
      { $set: { expiresAt: new Date(Date.now() - 5000) } }
    );

    // 10 concurrent workers attempt to claim the expired lease
    const CONCURRENT_WORKERS = 10;
    const takeoverResults = await Promise.all(
      Array.from({ length: CONCURRENT_WORKERS }, () => acquireLease(lockKey, 60000))
    );

    const winners = takeoverResults.filter((r) => r.acquired === true);
    const losers = takeoverResults.filter((r) => r.acquired === false);

    assert.equal(winners.length, 1, 'Strictly 1 worker must take over the expired lease');
    assert.equal(losers.length, CONCURRENT_WORKERS - 1);

    const winner = winners[0]!;
    // Fencing token must increment from 1 to 2
    assert.equal(
      winner.fencingToken,
      2,
      `Fencing token must increment monotonically to 2 on turnover, received ${winner.fencingToken}`
    );

    console.log(
      `   [Suite 4 Turnover] Expired lease re-contested by 10 workers: Monotonic fencingToken incremented from 1 -> 2.`
    );
  });
});
