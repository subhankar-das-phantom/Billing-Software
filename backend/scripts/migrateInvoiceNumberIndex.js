/**
 * One-time migration script for invoiceNumber uniqueness.
 *
 * Previous schema used a global unique index on invoiceNumber.
 * Multi-tenant mode now requires invoiceNumber to be unique per tenant.
 *
 * This script:
 * 1) Drops global unique invoiceNumber index (if present)
 * 2) Ensures unique compound index on { tenantId, invoiceNumber }
 *
 * Run: npm run migrate:invoice-index
 */

const mongoose = require('mongoose');
require('dotenv').config();

const TARGET_INDEX_NAME = 'tenantId_1_invoiceNumber_1';

const isGlobalInvoiceNumberIndex = (index) => (
  index
  && index.unique === true
  && index.key
  && Object.keys(index.key).length === 1
  && index.key.invoiceNumber === 1
);

const isTenantInvoiceNumberIndex = (index) => (
  index
  && index.key
  && index.key.tenantId === 1
  && index.key.invoiceNumber === 1
);

async function migrateInvoiceNumberIndex() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collection = db.collection('invoices');

  const currentIndexes = await collection.indexes();
  console.log('Current indexes:', currentIndexes.map((idx) => idx.name));

  const globalIndexes = currentIndexes.filter(isGlobalInvoiceNumberIndex);
  for (const index of globalIndexes) {
    console.log(`Dropping legacy global index: ${index.name}`);
    await collection.dropIndex(index.name);
  }

  let tenantScopedIndex = (await collection.indexes()).find(isTenantInvoiceNumberIndex);

  if (tenantScopedIndex && !tenantScopedIndex.unique) {
    console.log(`Dropping non-unique tenant invoice index: ${tenantScopedIndex.name}`);
    await collection.dropIndex(tenantScopedIndex.name);
    tenantScopedIndex = null;
  }

  if (!tenantScopedIndex) {
    console.log('Creating tenant-scoped unique index on { tenantId, invoiceNumber }');
    await collection.createIndex(
      { tenantId: 1, invoiceNumber: 1 },
      { unique: true, name: TARGET_INDEX_NAME }
    );
  } else {
    console.log(`Tenant-scoped unique index already present: ${tenantScopedIndex.name}`);
  }

  const finalIndexes = await collection.indexes();
  console.log('Final indexes:', finalIndexes.map((idx) => idx.name));
}

migrateInvoiceNumberIndex()
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

