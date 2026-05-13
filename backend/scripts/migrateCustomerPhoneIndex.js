/**
 * One-time migration script for customer phone uniqueness.
 *
 * Old behavior: global unique index on customers.phone
 * New behavior: unique per tenant on { tenantId, phone }
 *
 * Run: npm run migrate:customer-phone-index
 */

const mongoose = require('mongoose');
require('dotenv').config();

const TARGET_INDEX_NAME = 'tenantId_1_phone_1';

const isGlobalPhoneUniqueIndex = (index) => (
  index
  && index.unique === true
  && index.key
  && Object.keys(index.key).length === 1
  && index.key.phone === 1
);

const isTenantPhoneIndex = (index) => (
  index
  && index.key
  && index.key.tenantId === 1
  && index.key.phone === 1
);

async function migrateCustomerPhoneIndex() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const customers = db.collection('customers');

  const currentIndexes = await customers.indexes();
  console.log('Current indexes:', currentIndexes.map((idx) => idx.name));

  const legacyGlobalIndexes = currentIndexes.filter(isGlobalPhoneUniqueIndex);
  for (const index of legacyGlobalIndexes) {
    console.log(`Dropping legacy global phone index: ${index.name}`);
    await customers.dropIndex(index.name);
  }

  let tenantPhoneIndex = (await customers.indexes()).find(isTenantPhoneIndex);

  if (tenantPhoneIndex && !tenantPhoneIndex.unique) {
    console.log(`Dropping non-unique tenant phone index: ${tenantPhoneIndex.name}`);
    await customers.dropIndex(tenantPhoneIndex.name);
    tenantPhoneIndex = null;
  }

  if (!tenantPhoneIndex) {
    console.log('Creating unique tenant phone index on { tenantId, phone }');
    await customers.createIndex(
      { tenantId: 1, phone: 1 },
      { unique: true, name: TARGET_INDEX_NAME }
    );
  } else {
    console.log(`Tenant phone unique index already present: ${tenantPhoneIndex.name}`);
  }

  const finalIndexes = await customers.indexes();
  console.log('Final indexes:', finalIndexes.map((idx) => idx.name));
}

migrateCustomerPhoneIndex()
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

