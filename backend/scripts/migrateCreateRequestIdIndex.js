/**
 * Migration: Drop the old global unique index on Invoice.createRequestId
 * and create the new tenant-scoped compound index with a partial filter.
 *
 * Usage:
 *   node scripts/migrateCreateRequestIdIndex.js
 *
 * What it does:
 *   1. Connects to the database
 *   2. Drops the old global `createRequestId_1` index if it exists
 *   3. Drops ALL stale compound indexes on { tenantId, createRequestId }
 *      that do not exactly match the target options
 *   4. Creates the correct compound index with unique + partialFilterExpression
 */

require('dotenv').config();
const mongoose = require('mongoose');

const TARGET_KEY = { tenantId: 1, createRequestId: 1 };
const TARGET_PARTIAL_FILTER = { createRequestId: { $exists: true, $type: 'string' } };
const TARGET_INDEX_NAME = 'tenantId_1_createRequestId_1';

/**
 * Deep-compare two plain objects for structural equality.
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key, i) => key === keysB[i] && deepEqual(a[key], b[key]));
}

/**
 * Check whether an index exactly matches the target specification.
 */
function isExactTargetIndex(idx) {
  return (
    deepEqual(idx.key, TARGET_KEY) &&
    idx.unique === true &&
    deepEqual(idx.partialFilterExpression, TARGET_PARTIAL_FILTER)
  );
}

/**
 * Check whether an index has the same compound key as the target
 * but with wrong/different options.
 */
function isStaleCompoundIndex(idx) {
  return deepEqual(idx.key, TARGET_KEY) && !isExactTargetIndex(idx);
}

function printIndexes(indexes) {
  indexes.forEach((idx) => {
    const flags = [
      idx.unique ? 'unique' : '',
      idx.sparse ? 'sparse' : '',
      idx.partialFilterExpression ? 'partial' : ''
    ].filter(Boolean).join(', ');
    console.log('  %s -> %s%s', idx.name, JSON.stringify(idx.key), flags ? ` (${flags})` : '');
  });
}

async function migrate() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  const db = mongoose.connection.db;
  const collection = db.collection('invoices');

  // ---- List current indexes ----
  let indexes = await collection.indexes();
  console.log('Current indexes on invoices collection:');
  printIndexes(indexes);

  let needsCreate = true;

  // ---- Step 1: Drop old global createRequestId_1 index ----
  const oldGlobalIndex = indexes.find((idx) => idx.name === 'createRequestId_1');
  if (oldGlobalIndex) {
    console.log('\n[WARN] Dropping old global index: createRequestId_1...');
    await collection.dropIndex('createRequestId_1');
    console.log('  [OK] Dropped.');
  }

  // ---- Step 2: Drop ALL stale compound indexes on same key ----
  // Re-fetch after possible drop above
  indexes = await collection.indexes();
  const staleIndexes = indexes.filter(isStaleCompoundIndex);

  if (staleIndexes.length > 0) {
    for (const stale of staleIndexes) {
      const reasons = [];
      if (!stale.unique) reasons.push('not unique');
      if (!stale.partialFilterExpression) reasons.push('no partial filter');
      else if (!deepEqual(stale.partialFilterExpression, TARGET_PARTIAL_FILTER)) reasons.push('wrong partial filter');
      if (stale.sparse) reasons.push('has sparse (should use partial filter instead)');

      console.log('\n[WARN] Dropping stale compound index: %s (%s)...', stale.name, reasons.join(', '));
      await collection.dropIndex(stale.name);
      console.log('  [OK] Dropped.');
    }
  }

  // ---- Step 3: Check if exact target index already exists ----
  indexes = await collection.indexes();
  const exactMatch = indexes.find(isExactTargetIndex);

  if (exactMatch) {
    console.log('\n[OK] Correct index already exists: %s', exactMatch.name);
    needsCreate = false;
  }

  // ---- Step 4: Create target index if needed ----
  if (needsCreate) {
    console.log('\nCreating index: %s (unique, partial filter)...', TARGET_INDEX_NAME);
    await collection.createIndex(TARGET_KEY, {
      unique: true,
      partialFilterExpression: TARGET_PARTIAL_FILTER,
      name: TARGET_INDEX_NAME
    });
    console.log('  [OK] Created.');
  }

  // ---- Verify ----
  indexes = await collection.indexes();
  const verified = indexes.find(isExactTargetIndex);
  if (verified) {
    console.log('\n[OK] Verified: %s (unique, partial filter)', verified.name);
    console.log('  partialFilterExpression: %s', JSON.stringify(verified.partialFilterExpression));
  } else {
    console.log('\n[FAIL] Verification failed. Target index not found. Check indexes manually:');
    printIndexes(indexes);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

migrate().catch(async (err) => {
  console.error('[FAIL] Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
