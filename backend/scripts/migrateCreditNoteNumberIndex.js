/**
 * One-time migration script for credit note number uniqueness.
 *
 * Old behavior: global unique index on creditnotes.creditNoteNumber
 * New behavior: unique per tenant on { tenantId, creditNoteNumber }
 *
 * Run: npm run migrate:credit-note-number-index
 */

const mongoose = require('mongoose');
require('dotenv').config();

const TARGET_INDEX_NAME = 'tenantId_1_creditNoteNumber_1';

const isGlobalCreditNoteNumberUniqueIndex = (index) => (
  index
  && index.unique === true
  && index.key
  && Object.keys(index.key).length === 1
  && index.key.creditNoteNumber === 1
);

const isTenantCreditNoteNumberIndex = (index) => (
  index
  && index.key
  && index.key.tenantId === 1
  && index.key.creditNoteNumber === 1
);

async function migrateCreditNoteNumberIndex() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const creditNotes = db.collection('creditnotes');

  const currentIndexes = await creditNotes.indexes();
  console.log('Current indexes:', currentIndexes.map((idx) => idx.name));

  const legacyGlobalIndexes = currentIndexes.filter(isGlobalCreditNoteNumberUniqueIndex);
  for (const index of legacyGlobalIndexes) {
    console.log(`Dropping legacy global credit note index: ${index.name}`);
    await creditNotes.dropIndex(index.name);
  }

  let tenantCreditNoteIndex = (await creditNotes.indexes()).find(isTenantCreditNoteNumberIndex);

  if (tenantCreditNoteIndex && !tenantCreditNoteIndex.unique) {
    console.log(`Dropping non-unique tenant credit note index: ${tenantCreditNoteIndex.name}`);
    await creditNotes.dropIndex(tenantCreditNoteIndex.name);
    tenantCreditNoteIndex = null;
  }

  if (!tenantCreditNoteIndex) {
    console.log('Creating unique tenant credit note index on { tenantId, creditNoteNumber }');
    await creditNotes.createIndex(
      { tenantId: 1, creditNoteNumber: 1 },
      { unique: true, name: TARGET_INDEX_NAME }
    );
  } else {
    console.log(`Tenant credit note unique index already present: ${tenantCreditNoteIndex.name}`);
  }

  const finalIndexes = await creditNotes.indexes();
  console.log('Final indexes:', finalIndexes.map((idx) => idx.name));
}

migrateCreditNoteNumberIndex()
  .then(async () => {
    await mongoose.disconnect();
    console.log('Migration completed successfully.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });

