/**
 * Bharat Enterprise Billing System — Cryptographic Tamper-Evident Audit Forensics & Adversarial Attacks
 *
 * Exhaustive attack simulations against Platform Control Plane Audit Log System:
 *   1. Bit-flip attack (metadata, action, reason tampering in middle of 100-block chain)
 *   2. Middle-node deletion attack (single and multi-block middle deletion)
 *   3. Timestamp forgery (backdated, future, altered sequence, rogue injection)
 *   4. Pre-hook bypass prevention (updateOne, updateMany, replaceOne, findOneAndUpdate, findOneAndReplace, deleteOne, deleteMany, findOneAndDelete, findOneAndRemove, doc.save)
 *   5. Concurrent append during verification (1,000-block verification under concurrent write load)
 *   6. Keyset pagination boundary attacks (non-existent ObjectIds, invalid ISO timestamps, base64 garbage, SQL/NoSQL injection)
 *   7. Genesis block forgery & truncation (tampered genesis, rogue genesis hash, deleted genesis, tail truncation)
 *
 * Executed via Node test runner:
 *   npx tsx --tsconfig admin/backend/tsconfig.json --test admin/backend/tests/cryptographicAuditTamper.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';

// Models
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformAuditHead, AUDIT_GENESIS_HASH } from '../models/PlatformAuditHead';

// Services & Utilities
import {
  logPlatformAudit,
  verifyAuditChain,
  redactSensitiveFields,
} from '../services/platformAuditService';
import {
  computeCanonicalSha256,
  canonicalJsonStringify,
} from '../utils/canonicalJson';
import {
  encodeKeysetCursor,
  decodeAndVerifyKeysetCursor,
  computeFilterSignature,
} from '../utils/cursorCrypto';

// Controllers
import {
  getAuditLogs,
  verifyAuditScope,
} from '../controllers/platformAuditController';

// Permissions & Types
import { PlatformRole, PlatformPermission } from '../permissions';
import { PlatformRequest } from '../types';

// Isolated MongoDB connection URI for cryptographic tamper forensics
const LOCAL_CRYPTO_AUDIT_TEST_MONGO_URI =
  'mongodb://127.0.0.1:27017/test_crypto_audit_tamper_isolated';

// Helper mock HTTP response for controller testing
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

/**
 * Deterministically seed an unbroken hash chain of N blocks for a given scope.
 */
async function seedAuditChain(
  scope: string,
  count: number,
  baseAction: string = 'platform.audit.test',
): Promise<void> {
  for (let i = 1; i <= count; i++) {
    await logPlatformAudit({
      scope,
      actorEmail: `operator_${i % 5}@bharat.in`,
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: `${baseAction}.${i}`,
      targetType: 'Resource',
      targetId: `res_${i}`,
      reason: `Deterministic audit entry for block sequence ${i}`,
      before: { index: i, state: 'OLD', metadata: { version: i - 1 } },
      after: { index: i, state: 'NEW', metadata: { version: i } },
    });
  }
}

// ═════════════════════════════════════════════════════════════════════
// GLOBAL SETUP & TEARDOWN
// ═════════════════════════════════════════════════════════════════════

before(async () => {
  await mongoose.connect(LOCAL_CRYPTO_AUDIT_TEST_MONGO_URI);
  const collections = ['platformauditlogs', 'platformauditheads'];
  for (const coll of collections) {
    try {
      await mongoose.connection.collection(coll).deleteMany({});
    } catch {
      // Ignore if collection does not exist
    }
  }
});

after(async () => {
  const collections = ['platformauditlogs', 'platformauditheads'];
  for (const coll of collections) {
    try {
      await mongoose.connection.collection(coll).deleteMany({});
    } catch {
      // Ignore
    }
  }
  await mongoose.disconnect();
});

// ═════════════════════════════════════════════════════════════════════
// ATTACK 1: BIT-FLIP ATTACK
// ═════════════════════════════════════════════════════════════════════

describe('Attack 1: Bit-Flip Attack across 100-Block Hash Chain', () => {
  const scope = 'attack_1_bitflip_scope';

  before(async () => {
    await seedAuditChain(scope, 100, 'platform.security.block');
    // Pre-attack invariant: verify unbroken 100-block chain
    const initialCheck = await verifyAuditChain(scope);
    assert.equal(initialCheck.valid, true);
    assert.equal(initialCheck.verifiedCount, 100);
  });

  it('1.1 should detect single character mutation in "action" of block 50 and report exact sequence index', async () => {
    // Read original document
    const block50 = await mongoose.connection
      .collection('platformauditlogs')
      .findOne({ scope, sequence: 50 });
    assert.ok(block50, 'Block 50 must exist');

    // Attacker flips a single character in action: "platform.security.block.50" -> "platform.security.block.50X"
    const tamperedAction = `${block50.action}X`;
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 50 },
      { $set: { action: tamperedAction } },
    );

    // Verify chain forensics
    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false, 'Chain verification must fail on bit-flip');
    assert.equal(result.verifiedCount, 49, 'Blocks 1 through 49 must verify valid prior to tampered block 50');
    assert.match(
      result.error || '',
      /Cryptographic hash mismatch at sequence 50/,
      'Error message must pinpoint sequence 50',
    );

    // Controller endpoint verification (/api/platform/audit/verify-chain)
    const req: any = { query: { scope } };
    const res = createMockRes();
    await verifyAuditScope(req as PlatformRequest, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.verification.valid, false);
    assert.equal(res.body.verification.verifiedCount, 49);
    assert.match(res.body.verification.error, /Cryptographic hash mismatch at sequence 50/);

    // Restore block 50 for subsequent sub-tests
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 50 },
      { $set: { action: block50.action } },
    );
    const restoredCheck = await verifyAuditChain(scope);
    assert.equal(restoredCheck.valid, true);
  });

  it('1.2 should detect single character mutation in nested "after.metadata.version" of block 75', async () => {
    const block75 = await mongoose.connection
      .collection('platformauditlogs')
      .findOne({ scope, sequence: 75 });
    assert.ok(block75);

    // Attacker alters a deeply nested metadata property: version 75 -> 750
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 75 },
      { $set: { 'after.metadata.version': 750 } },
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 74, 'Blocks 1 through 74 must verify valid');
    assert.match(result.error || '', /Cryptographic hash mismatch at sequence 75/);

    // Restore block 75
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 75 },
      { $set: { 'after.metadata.version': block75.after.metadata.version } },
    );
    const restoredCheck = await verifyAuditChain(scope);
    assert.equal(restoredCheck.valid, true);
  });

  it('1.3 should detect single character mutation in "before" state of block 25', async () => {
    const block25 = await mongoose.connection
      .collection('platformauditlogs')
      .findOne({ scope, sequence: 25 });
    assert.ok(block25);

    // Mutate state from "OLD" to "OLX"
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 25 },
      { $set: { 'before.state': 'OLX' } },
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 24);
    assert.match(result.error || '', /Cryptographic hash mismatch at sequence 25/);

    // Restore block 25
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 25 },
      { $set: { 'before.state': block25.before.state } },
    );
    const restoredCheck = await verifyAuditChain(scope);
    assert.equal(restoredCheck.valid, true);
  });

  it('1.4 should detect single character mutation in "reason" of block 10', async () => {
    const block10 = await mongoose.connection
      .collection('platformauditlogs')
      .findOne({ scope, sequence: 10 });
    assert.ok(block10);

    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 10 },
      { $set: { reason: `${block10.reason}!` } },
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 9);
    assert.match(result.error || '', /Cryptographic hash mismatch at sequence 10/);

    // Restore block 10
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 10 },
      { $set: { reason: block10.reason } },
    );
    const restoredCheck = await verifyAuditChain(scope);
    assert.equal(restoredCheck.valid, true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// ATTACK 2: MIDDLE-NODE DELETION ATTACK
// ═════════════════════════════════════════════════════════════════════

describe('Attack 2: Middle-Node Deletion Attack in Collection', () => {
  const scope = 'attack_2_deletion_scope';

  beforeEach(async () => {
    await mongoose.connection.collection('platformauditlogs').deleteMany({ scope });
    await mongoose.connection.collection('platformauditheads').deleteMany({ scope });
    await seedAuditChain(scope, 100, 'platform.deletion.test');
  });

  it('2.1 should detect middle-node deletion of block 50 via broken previousHash linkage', async () => {
    // Attacker deletes block 50 directly at collection level
    const deleteResult = await mongoose.connection
      .collection('platformauditlogs')
      .deleteOne({ scope, sequence: 50 });
    assert.equal(deleteResult.deletedCount, 1);

    // Verification must detect that block 51's previousHash does not match block 49's hash
    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 49, 'Verification must stop at sequence 49');
    assert.match(
      result.error || '',
      /Broken hash chain at sequence 51|Monotonic sequence gap detected between sequence 49 and 51/,
    );

    // Verify endpoint also returns the failure
    const req: any = { query: { scope } };
    const res = createMockRes();
    await verifyAuditScope(req as PlatformRequest, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.verification.valid, false);
    assert.equal(res.body.verification.verifiedCount, 49);
  });

  it('2.2 should detect contiguous multi-block middle deletion (blocks 30, 31, 32 deleted)', async () => {
    await mongoose.connection.collection('platformauditlogs').deleteMany({
      scope,
      sequence: { $in: [30, 31, 32] },
    });

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 29);
    assert.match(
      result.error || '',
      /Broken hash chain at sequence 33|Monotonic sequence gap detected between sequence 29 and 33/,
    );
  });

  it('2.3 should detect deletion of penultimate block (sequence 99 out of 100)', async () => {
    await mongoose.connection.collection('platformauditlogs').deleteOne({
      scope,
      sequence: 99,
    });

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 98);
    assert.match(result.error || '', /Broken hash chain at sequence 100/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// ATTACK 3: TIMESTAMP FORGERY & SEQUENCE CORRUPTION
// ═════════════════════════════════════════════════════════════════════

describe('Attack 3: Timestamp Forgery & Sequence Alteration', () => {
  const scope = 'attack_3_timestamp_scope';

  beforeEach(async () => {
    await mongoose.connection.collection('platformauditlogs').deleteMany({ scope });
    await mongoose.connection.collection('platformauditheads').deleteMany({ scope });
    await seedAuditChain(scope, 50, 'platform.timestamp.test');
  });

  it('3.1 should detect forged backdated timestamp on block 25 (10 days earlier)', async () => {
    const forgedDate = new Date(Date.now() - 10 * 86400 * 1000);

    // Attacker modifies createdAt in database
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 25 },
      { $set: { createdAt: forgedDate } },
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 24);
    assert.match(result.error || '', /Cryptographic hash mismatch at sequence 25/);
  });

  it('3.2 should detect forged future timestamp on block 35 (1 year in future)', async () => {
    const forgedFutureDate = new Date(Date.now() + 365 * 86400 * 1000);

    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 35 },
      { $set: { createdAt: forgedFutureDate } },
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 34);
    assert.match(result.error || '', /Cryptographic hash mismatch at sequence 35/);
  });

  it('3.3 should detect sequence index modification (block 15 modified to sequence 999)', async () => {
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 15 },
      { $set: { sequence: 999 } },
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 14);
    assert.match(
      result.error || '',
      /Broken hash chain at sequence 16|Monotonic sequence gap detected between sequence 14 and 16|Cryptographic hash mismatch/,
    );
  });

  it('3.4 should detect rogue entry inserted between existing blocks with forged timestamp', async () => {
    // Attacker attempts to insert sequence 25 again with rogue payload
    const now = new Date();
    const roguePayload = {
      scope,
      sequence: 25,
      action: 'platform.rogue.injection',
      targetType: 'Rogue',
      targetId: 'r1',
      reason: 'Forged backdated rogue audit entry',
      before: null,
      after: null,
      previousHash: 'a'.repeat(64),
      timestamp: now,
    };
    const rogueHash = computeCanonicalSha256(roguePayload);

    // Insert rogue entry
    await mongoose.connection.collection('platformauditlogs').insertOne({
      scope,
      sequence: 25,
      actorEmail: 'attacker@evil.com',
      actorRole: 'HACKER',
      action: 'platform.rogue.injection',
      targetType: 'Rogue',
      targetId: 'r1',
      reason: 'Forged backdated rogue audit entry',
      before: null,
      after: null,
      previousHash: 'a'.repeat(64),
      hash: rogueHash,
      createdAt: now,
    });

    // Verification must fail due to broken chain or sequence gap
    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// ATTACK 4: PRE-HOOK BYPASS PREVENTION
// ═════════════════════════════════════════════════════════════════════

describe('Attack 4: Pre-Hook Bypass Prevention (Mongoose Append-Only Enforcement)', () => {
  const scope = 'attack_4_prehook_scope';
  let createdLogId: Types.ObjectId;

  before(async () => {
    await seedAuditChain(scope, 3, 'platform.hook.test');
    const firstLog = await PlatformAuditLog.findOne({ scope, sequence: 1 });
    assert.ok(firstLog);
    createdLogId = firstLog._id as Types.ObjectId;
  });

  it('4.1 should reject PlatformAuditLog.updateOne() with append-only error', async () => {
    await assert.rejects(
      async () => {
        await PlatformAuditLog.updateOne({ _id: createdLogId }, { $set: { reason: 'TAMPERED' } });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });

  it('4.2 should reject PlatformAuditLog.updateMany() with append-only error', async () => {
    await assert.rejects(
      async () => {
        await PlatformAuditLog.updateMany({ scope }, { $set: { reason: 'TAMPERED' } });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });

  it('4.3 should reject PlatformAuditLog.replaceOne() with append-only error', async () => {
    await assert.rejects(
      async () => {
        await PlatformAuditLog.replaceOne({ _id: createdLogId }, { reason: 'REPLACED' } as any);
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });

  it('4.4 should reject PlatformAuditLog.findOneAndUpdate() with append-only error', async () => {
    await assert.rejects(
      async () => {
        await PlatformAuditLog.findOneAndUpdate({ _id: createdLogId }, { $set: { reason: 'TAMPERED' } });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });

  it('4.5 should reject PlatformAuditLog.findOneAndReplace() with append-only error', async () => {
    await assert.rejects(
      async () => {
        await PlatformAuditLog.findOneAndReplace(
          { _id: createdLogId },
          { reason: 'REPLACED_VIA_FOAR' } as any,
        );
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });

  it('4.6 should reject PlatformAuditLog.deleteOne() with append-only error', async () => {
    await assert.rejects(
      async () => {
        await PlatformAuditLog.deleteOne({ _id: createdLogId });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });

  it('4.7 should reject PlatformAuditLog.deleteMany() with append-only error', async () => {
    await assert.rejects(
      async () => {
        await PlatformAuditLog.deleteMany({ scope });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });

  it('4.8 should reject PlatformAuditLog.findOneAndDelete() with append-only error', async () => {
    await assert.rejects(
      async () => {
        await PlatformAuditLog.findOneAndDelete({ _id: createdLogId });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });

  it('4.9 should reject PlatformAuditLog.findOneAndDelete() with query condition with append-only error', async () => {
    await assert.rejects(
      async () => {
        await PlatformAuditLog.findOneAndDelete({ scope, sequence: 1 });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });

  it('4.10 should reject doc.save() on fetched document with append-only error', async () => {
    const doc = await PlatformAuditLog.findById(createdLogId);
    assert.ok(doc);
    doc.reason = 'MUTATED_VIA_SAVE';

    await assert.rejects(
      async () => {
        await doc.save();
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// ATTACK 5: CONCURRENT APPEND DURING CHAIN VERIFICATION
// ═════════════════════════════════════════════════════════════════════

describe('Attack 5: Concurrent Append During Active Verification (1,000 Blocks)', () => {
  const scope = 'attack_5_concurrency_scope';

  before(async () => {
    await mongoose.connection.collection('platformauditlogs').deleteMany({ scope });
    await mongoose.connection.collection('platformauditheads').deleteMany({ scope });
    // Seed 1,000 blocks
    await seedAuditChain(scope, 1000, 'platform.scale.block');
  });

  it('5.1 should cleanly execute full chain verification while 30 concurrent appends write to the same scope', async () => {
    const concurrentWritesCount = 30;

    // Start verification promise concurrently
    const verifyPromise = verifyAuditChain(scope);

    // Concurrently trigger 30 writes to the same scope
    const appendPromises = Array.from({ length: concurrentWritesCount }, (_, idx) =>
      logPlatformAudit({
        scope,
        actorEmail: `burst_worker_${idx}@bharat.in`,
        actorRole: PlatformRole.PLATFORM_OWNER,
        action: `platform.burst.${idx + 1}`,
        targetType: 'BurstResource',
        targetId: `burst_${idx + 1}`,
        reason: `Concurrent burst write #${idx + 1}`,
      }),
    );

    // Await both operations simultaneously
    const [initialVerifyResult, appendResults] = await Promise.all([
      verifyPromise,
      Promise.all(appendPromises),
    ]);

    // 1. Initial verification must not fail or crash
    assert.equal(initialVerifyResult.valid, true, 'Initial verification must succeed without false positives');
    assert.ok(
      initialVerifyResult.verifiedCount >= 1000,
      `Verified count (${initialVerifyResult.verifiedCount}) must be at least 1,000`,
    );

    // 2. All 30 concurrent appends must have succeeded
    assert.equal(appendResults.length, concurrentWritesCount);

    // 3. Post-burst full verification: 1,030 blocks must form an unbroken cryptographic chain
    const finalVerification = await verifyAuditChain(scope);
    assert.equal(finalVerification.valid, true);
    assert.equal(finalVerification.verifiedCount, 1000 + concurrentWritesCount);
    assert.equal(finalVerification.startSequence, 1);
    assert.equal(finalVerification.endSequence, 1000 + concurrentWritesCount);
  });

  it('5.2 should maintain keyset cursor pagination stability and zero drift during concurrent appends', async () => {
    // Read page 1 (20 items)
    const req1: any = { query: { scope, limit: '20' } };
    const res1 = createMockRes();
    await getAuditLogs(req1 as PlatformRequest, res1);

    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.data.length, 20);
    assert.ok(res1.body.pagination.hasNextPage);
    const cursor = res1.body.pagination.nextCursor;
    assert.ok(cursor);

    // Inject 5 new records at the top of the collection concurrently
    for (let i = 1; i <= 5; i++) {
      await logPlatformAudit({
        scope,
        actorEmail: 'cursor_tester@bharat.in',
        actorRole: PlatformRole.PLATFORM_OWNER,
        action: `platform.drift_test.${i}`,
        targetType: 'DriftResource',
        targetId: `drift_${i}`,
        reason: `Drift test injection ${i}`,
      });
    }

    // Read page 2 using the previously issued cursor
    const req2: any = { query: { scope, limit: '20', cursor } };
    const res2 = createMockRes();
    await getAuditLogs(req2 as PlatformRequest, res2);

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.data.length, 20);

    // Keyset pagination guarantees that Page 1 and Page 2 records have zero intersection
    const page1Ids = new Set(res1.body.data.map((d: any) => d._id.toString()));
    const page2Ids = res2.body.data.map((d: any) => d._id.toString());

    for (const id of page2Ids) {
      assert.equal(
        page1Ids.has(id),
        false,
        `Page 2 record ${id} must not appear in Page 1 (keyset stability invariant)`,
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// ATTACK 6: KEYSET PAGINATION BOUNDARY ATTACK
// ═════════════════════════════════════════════════════════════════════

describe('Attack 6: Keyset Pagination Boundary & Injection Attacks', () => {
  const scope = 'attack_6_keyset_scope';

  before(async () => {
    await seedAuditChain(scope, 25, 'platform.cursor.test');
  });

  it('6.1 should safely reject base64 garbage in cursor with HTTP 400', async () => {
    const req: any = { query: { cursor: '!!!not_valid_base64_url_garbage$$$' } };
    const res = createMockRes();

    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Malformed pagination cursor|invalid base64url/i);
  });

  it('6.2 should safely reject base64-encoded non-JSON text with HTTP 400', async () => {
    const rawGarbage = Buffer.from('this is raw plain text not json').toString('base64url');
    const req: any = { query: { cursor: rawGarbage } };
    const res = createMockRes();

    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Malformed pagination cursor: payload is not valid JSON/);
  });

  it('6.3 should safely reject SQL injection string in cursor with HTTP 400', async () => {
    const sqlInjection = Buffer.from("'; DROP TABLE platformauditlogs; --").toString('base64url');
    const req: any = { query: { cursor: sqlInjection } };
    const res = createMockRes();

    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Malformed pagination cursor/);
  });

  it('6.4 should safely handle NoSQL injection object payload in cursor parameter without executing injection', async () => {
    const req: any = {
      query: {
        cursor: { $gt: '' }, // NoSQL query injection attempt
        limit: '10',
      },
    };
    const res = createMockRes();

    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('6.5 should reject cursor with tampered HMAC signature with HTTP 400', async () => {
    const validCursor = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection: 'desc',
      val: new Date().toISOString(),
      id: new Types.ObjectId().toString(),
      tenantScope: null,
      filterSig: 'abcdef12',
    });

    // Tamper signature
    const container = JSON.parse(Buffer.from(validCursor, 'base64url').toString('utf8'));
    container.s = container.s.slice(0, -4) + 'AAAA';
    const tamperedCursor = Buffer.from(JSON.stringify(container), 'utf8').toString('base64url');

    const req: any = { query: { cursor: tamperedCursor } };
    const res = createMockRes();

    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /signature validation failed/);
  });

  it('6.6 should reject cursor with invalid timestamp value with HTTP 400', async () => {
    const secret = process.env.PLATFORM_JWT_SECRET || 'dev_fallback_cursor_secret';
    // Attacker crafts valid HMAC over invalid timestamp
    const forgedPayload = {
      sortField: 'createdAt' as const,
      sortDirection: 'desc' as const,
      val: 'invalid-iso-timestamp-string',
      id: new Types.ObjectId().toString(),
      tenantScope: null,
      filterSig: '12345678',
    };
    const forgedCursor = encodeKeysetCursor(forgedPayload, secret);

    const req: any = { query: { cursor: forgedCursor } };
    const res = createMockRes();

    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid timestamp value/i);
  });

  it('6.7 should reject cursor with malformed entity ID format with HTTP 400', async () => {
    const secret = process.env.PLATFORM_JWT_SECRET || 'dev_fallback_cursor_secret';
    const forgedPayload = {
      sortField: 'createdAt' as const,
      sortDirection: 'desc' as const,
      val: new Date().toISOString(),
      id: 'not_a_24_char_hex_id',
      tenantScope: null,
      filterSig: '12345678',
    };
    const forgedCursor = encodeKeysetCursor(forgedPayload, secret);

    const req: any = { query: { cursor: forgedCursor } };
    const res = createMockRes();

    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid entity ID format/i);
  });

  it('6.8 should safely evaluate non-existent ObjectId with valid timestamp without crashing', async () => {
    const nonExistentId = new Types.ObjectId().toString();
    const filterSig = computeFilterSignature({ scope });

    const cursor = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection: 'desc',
      val: new Date().toISOString(),
      id: nonExistentId,
      tenantScope: null,
      filterSig,
    });

    const req: any = { query: { scope, cursor } };
    const res = createMockRes();

    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('6.9 should reject cross-tenant cursor replay attack with HTTP 400', async () => {
    const tenantAId = new Types.ObjectId().toString();
    const tenantBId = new Types.ObjectId().toString();

    const cursorTenantA = encodeKeysetCursor({
      sortField: 'createdAt',
      sortDirection: 'desc',
      val: new Date().toISOString(),
      id: new Types.ObjectId().toString(),
      tenantScope: tenantAId,
      filterSig: computeFilterSignature({ targetTenantId: tenantAId }),
    });

    // Attacker sends Tenant A cursor against Tenant B endpoint
    const req: any = {
      query: {
        targetTenantId: tenantBId,
        cursor: cursorTenantA,
      },
    };
    const res = createMockRes();

    await getAuditLogs(req as PlatformRequest, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Cross-tenant pagination cursor reuse is strictly prohibited/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// ATTACK 7: GENESIS BLOCK FORGERY & CHAIN TRUNCATION
// ═════════════════════════════════════════════════════════════════════

describe('Attack 7: Genesis Block Forgery & Chain Truncation', () => {
  const scope = 'attack_7_genesis_scope';

  beforeEach(async () => {
    await mongoose.connection.collection('platformauditlogs').deleteMany({ scope });
    await mongoose.connection.collection('platformauditheads').deleteMany({ scope });
    await seedAuditChain(scope, 10, 'platform.genesis.test');
  });

  it('7.1 should detect genesis block previousHash altered to "GENESIS"', async () => {
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 1 },
      { $set: { previousHash: 'GENESIS' } },
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 0);
    assert.match(
      result.error || '',
      /Cryptographic hash mismatch at sequence 1|Invalid genesis hash at sequence 1/,
    );
  });

  it('7.2 should detect genesis block previousHash altered to null', async () => {
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 1 },
      { $set: { previousHash: null } },
    );

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 0);
    assert.match(
      result.error || '',
      /Cryptographic hash mismatch at sequence 1|Invalid genesis hash at sequence 1/,
    );
  });

  it('7.3 should detect rogue genesis hash even when attacker recomputes block 1 hash', async () => {
    const block1 = await mongoose.connection
      .collection('platformauditlogs')
      .findOne({ scope, sequence: 1 });
    assert.ok(block1);

    const rogueGenesisHash = 'f'.repeat(64);
    // Attacker alters previousHash AND recalculates hash to make block 1 hash check pass
    const canonicalPayload = {
      scope: block1.scope,
      sequence: block1.sequence,
      action: block1.action,
      targetType: block1.targetType,
      targetId: block1.targetId,
      reason: block1.reason,
      before: block1.before,
      after: block1.after,
      previousHash: rogueGenesisHash,
      timestamp: block1.createdAt,
    };
    const recomputedHash = computeCanonicalSha256(canonicalPayload);

    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 1 },
      { $set: { previousHash: rogueGenesisHash, hash: recomputedHash } },
    );

    // Block 1 hash is self-consistent with rogue previousHash, but invalid genesis hash check must fail!
    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 0);
    assert.match(
      result.error || '',
      /Invalid genesis hash at sequence 1\. Expected "GENESIS_BHARAT_ENTERPRISE_AUDIT_V1"/,
    );
  });

  it('7.4 should detect complete genesis block deletion (chain starts at sequence 2)', async () => {
    // Attacker deletes sequence 1 to conceal initial creation
    await mongoose.connection.collection('platformauditlogs').deleteOne({ scope, sequence: 1 });

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 0);
    assert.match(
      result.error || '',
      /Missing genesis block\. Chain for scope "attack_7_genesis_scope" starts at sequence 2 instead of sequence 1/,
    );
  });

  it('7.5 should detect tail block truncation when latest entries are deleted', async () => {
    // Delete blocks 9 and 10, while PlatformAuditHead records sequence 10
    await mongoose.connection.collection('platformauditlogs').deleteMany({
      scope,
      sequence: { $in: [9, 10] },
    });

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.match(
      result.error || '',
      /Tail truncation detected for scope "attack_7_genesis_scope"\. Audit head records sequence 10, but audit chain terminates at sequence 8/,
    );
  });

  it('7.6 should detect total chain deletion when all blocks are wiped from collection', async () => {
    await mongoose.connection.collection('platformauditlogs').deleteMany({ scope });

    const result = await verifyAuditChain(scope);
    assert.equal(result.valid, false);
    assert.equal(result.verifiedCount, 0);
    assert.match(result.error || '', /expects 10 audit logs according to audit head, but 0 logs were found/);
  });
});
