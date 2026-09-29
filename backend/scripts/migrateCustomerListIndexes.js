/**
 * Ensures indexes used by the customer directory and live outstanding balance lookup.
 *
 * Run: npm run migrate:customer-list-indexes
 */

const mongoose = require('mongoose');
require('dotenv').config();

const indexes = [
  {
    collection: 'customers',
    name: 'customer_list_tenant_status_created_at',
    key: { tenantId: 1, isActive: 1, createdAt: -1 }
  },
  {
    collection: 'manualentries',
    name: 'manual_entry_customer_opening_balance',
    key: { tenantId: 1, customer: 1, entryType: 1, paymentType: 1 }
  }
];

const sameKey = (index, expectedKey) => {
  const actualEntries = Object.entries(index.key || {});
  const expectedEntries = Object.entries(expectedKey);
  return actualEntries.length === expectedEntries.length
    && expectedEntries.every(([field, direction]) => index.key[field] === direction);
};

async function migrateCustomerListIndexes() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  for (const indexDefinition of indexes) {
    const collection = db.collection(indexDefinition.collection);
    const existingIndexes = await collection.indexes();
    const existingIndex = existingIndexes.find(index => sameKey(index, indexDefinition.key));

    if (existingIndex) {
      console.log(`${indexDefinition.collection}: index already present (${existingIndex.name})`);
      continue;
    }

    console.log(`${indexDefinition.collection}: creating ${indexDefinition.name}`);
    await collection.createIndex(indexDefinition.key, { name: indexDefinition.name });
  }
}

migrateCustomerListIndexes()
  .then(async () => {
    await mongoose.disconnect();
    console.log('Customer list index migration completed successfully.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Customer list index migration failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
