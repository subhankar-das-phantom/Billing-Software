/**
 * Bharat Enterprise Billing System — Platform Control Plane Index Migration
 * Safely registers compound ESR indexes across platform and tenant collections with { background: true }.
 */

import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load backend environment configuration if running standalone
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

export interface IndexMigrationDef {
  collection: string;
  spec: Record<string, 1 | -1 | string>;
  options: mongoose.mongo.CreateIndexesOptions;
  description: string;
}

export interface IndexMigrationResult {
  collection: string;
  spec: Record<string, 1 | -1 | string>;
  durationMs: number;
  status: 'CREATED' | 'ALREADY_EXISTS' | 'FAILED';
  error?: string;
}

export const PLATFORM_ESR_INDEXES: IndexMigrationDef[] = [
  // ─── 1. Admin (Tenants) ──────────────────────────────────────────
  {
    collection: 'admins',
    spec: { isActive: 1, createdAt: -1, _id: -1 },
    options: { background: true, name: 'idx_admins_isActive_createdAt_id' },
    description: 'Equality on isActive, sort/range on createdAt and _id',
  },
  {
    collection: 'admins',
    spec: { createdAt: -1, _id: -1 },
    options: { background: true, name: 'idx_admins_createdAt_id' },
    description: 'Unfiltered keyset pagination reverse-chronological order',
  },
  {
    collection: 'admins',
    spec: { normalizedFirmName: 1, _id: 1 },
    options: { background: true, name: 'idx_admins_normalizedFirmName_id' },
    description: 'Keyset pagination and search on normalized firm name',
  },

  // ─── 2. Subscription ────────────────────────────────────────────
  {
    collection: 'subscriptions',
    spec: { tenantId: 1, status: 1, expiresAt: -1 },
    options: { background: true, name: 'idx_subscriptions_tenant_status_expires' },
    description: 'Tenant-scoped subscription resolution and status checks',
  },
  {
    collection: 'subscriptions',
    spec: { tenantId: 1, createdAt: -1 },
    options: { background: true, name: 'idx_subscriptions_tenant_createdAt' },
    description: 'Tenant subscription history timeline',
  },
  {
    collection: 'subscriptions',
    spec: { status: 1, expiresAt: -1 },
    options: { background: true, name: 'idx_subscriptions_status_expires' },
    description: 'MRR aggregation and active subscription status scans',
  },

  // ─── 3. SubscriptionPayment ─────────────────────────────────────
  {
    collection: 'subscriptionpayments',
    spec: { paymentStatus: 1, paidAt: -1, finalAmount: 1 },
    options: { background: true, name: 'idx_subpayments_status_paidAt_finalAmount' },
    description: 'Covered index scan for IST dashboard revenue aggregation',
  },
  {
    collection: 'subscriptionpayments',
    spec: { tenantId: 1, createdAt: -1 },
    options: { background: true, name: 'idx_subpayments_tenant_createdAt' },
    description: 'Tenant payment history lookup',
  },
  {
    collection: 'subscriptionpayments',
    spec: { createdAt: -1, _id: -1 },
    options: { background: true, name: 'idx_subpayments_createdAt_id' },
    description: 'Platform billing history keyset cursor ordering',
  },
  {
    collection: 'subscriptionpayments',
    spec: { gatewayPaymentId: 1 },
    options: { background: true, sparse: true, name: 'idx_subpayments_gatewayPaymentId' },
    description: 'Payment gateway webhook reconciliation lookup',
  },

  // ─── 4. PlatformUser ────────────────────────────────────────────
  {
    collection: 'platformusers',
    spec: { email: 1 },
    options: { background: true, unique: true, name: 'idx_platformusers_email_unique' },
    description: 'Unique operator email index for authentication lookups',
  },
  {
    collection: 'platformusers',
    spec: { isActive: 1, role: 1, createdAt: -1 },
    options: { background: true, name: 'idx_platformusers_isActive_role_createdAt' },
    description: 'Operator directory filtering and RBAC role audit',
  },

  // ─── 5. PlatformSession ─────────────────────────────────────────
  {
    collection: 'platformsessions',
    spec: { tokenHash: 1 },
    options: { background: true, unique: true, name: 'idx_platformsessions_tokenHash_unique' },
    description: 'High-throughput token hash verification index',
  },
  {
    collection: 'platformsessions',
    spec: { platformUserId: 1, isRevoked: 1, expiresAt: -1 },
    options: { background: true, name: 'idx_platformsessions_user_revoked_expires' },
    description: 'Active operator session resolution and revocation sweeps',
  },
  {
    collection: 'platformsessions',
    spec: { expiresAt: 1 },
    options: { background: true, expireAfterSeconds: 0, name: 'idx_platformsessions_ttl' },
    description: 'Automatic MongoDB TTL expiration index for revoked/idle sessions',
  },

  // ─── 6. PlatformAuditLog ────────────────────────────────────────
  {
    collection: 'platformauditlogs',
    spec: { createdAt: -1, _id: -1 },
    options: { background: true, name: 'idx_auditlogs_createdAt_id' },
    description: 'Global audit ledger reverse-chronological streaming',
  },
  {
    collection: 'platformauditlogs',
    spec: { targetTenantId: 1, createdAt: -1, _id: -1 },
    options: { background: true, name: 'idx_auditlogs_tenant_createdAt_id' },
    description: 'Tenant-scoped audit ledger inspection',
  },
  {
    collection: 'platformauditlogs',
    spec: { scope: 1, sequence: 1 },
    options: { background: true, unique: true, name: 'idx_auditlogs_scope_sequence_unique' },
    description: 'Unique monotonic sequence per hash-chain scope',
  },
  {
    collection: 'platformauditlogs',
    spec: { scope: 1, sequence: -1 },
    options: { background: true, name: 'idx_auditlogs_scope_sequence' },
    description: 'Hash-chain verification and sequence continuity checks',
  },

  // ─── 7. PlatformAuditHead ───────────────────────────────────────
  {
    collection: 'platformauditheads',
    spec: { scope: 1 },
    options: { background: true, unique: true, name: 'idx_auditheads_scope_unique' },
    description: 'OCC scope uniqueness for atomic sequence incrementing',
  },

  // ─── 8. TenantFeatureOverride ───────────────────────────────────
  {
    collection: 'tenantfeatureoverrides',
    spec: { tenantId: 1, feature: 1 },
    options: {
      background: true,
      unique: true,
      partialFilterExpression: { isActive: true },
      name: 'idx_featureoverrides_tenant_feature_active_unique',
    },
    description: 'Partial unique constraint preventing duplicate active overrides per feature',
  },
  {
    collection: 'tenantfeatureoverrides',
    spec: { tenantId: 1, isActive: 1, expiresAt: 1 },
    options: { background: true, name: 'idx_featureoverrides_tenant_active_expires' },
    description: 'Evaluation pipeline for effective tenant feature gating',
  },

  // ─── 9. PlatformSupportSession ──────────────────────────────────
  {
    collection: 'platformsupportsessions',
    spec: { sessionCode: 1 },
    options: { background: true, unique: true, name: 'idx_supportsessions_code_unique' },
    description: 'Unique diagnostic session code lookup index',
  },
  {
    collection: 'platformsupportsessions',
    spec: { operatorId: 1, status: 1 },
    options: { background: true, name: 'idx_supportsessions_operator_status' },
    description: 'Fast operator active session resolution',
  },
  {
    collection: 'platformsupportsessions',
    spec: { targetTenantId: 1, createdAt: -1 },
    options: { background: true, name: 'idx_supportsessions_tenant_createdAt' },
    description: 'Tenant support session history audits',
  },
  {
    collection: 'platformsupportsessions',
    spec: { status: 1, expiresAt: 1 },
    options: { background: true, name: 'idx_supportsessions_status_expires' },
    description: 'Lifecycle sweeps to detect and expire sessions',
  },

  // ─── 10. DistributedLock ────────────────────────────────────────
  {
    collection: 'distributedlocks',
    spec: { lockKey: 1 },
    options: { background: true, unique: true, name: 'idx_distributedlocks_lockKey_unique' },
    description: 'Atomic distributed lock acquisition and fencing index',
  },
];

/**
 * Executes the compound index migration across all platform collections.
 */
export async function migratePlatformIndexes(): Promise<IndexMigrationResult[]> {
  const results: IndexMigrationResult[] = [];
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('MongoDB database connection is not ready.');
  }

  console.log(`Starting registration of ${PLATFORM_ESR_INDEXES.length} compound ESR indexes...`);

  for (const def of PLATFORM_ESR_INDEXES) {
    const coll = db.collection(def.collection);
    const start = performance.now();

    try {
      await coll.createIndex(def.spec as any, def.options);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;

      console.log(
        `✓ [INDEX CREATED] ${def.collection}: ${JSON.stringify(def.spec)} (${durationMs}ms)`
      );

      results.push({
        collection: def.collection,
        spec: def.spec,
        durationMs,
        status: 'CREATED',
      });
    } catch (err: any) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      // Handle benign "already exists with different options" or identical index
      if (err.codeName === 'IndexOptionsConflict' || err.message?.includes('already exists')) {
        console.warn(
          `⚠ [INDEX EXISTS] ${def.collection}: ${JSON.stringify(def.spec)} (${durationMs}ms)`
        );
        results.push({
          collection: def.collection,
          spec: def.spec,
          durationMs,
          status: 'ALREADY_EXISTS',
          error: err.message,
        });
      } else {
        console.error(
          `✗ [INDEX FAILED] ${def.collection}: ${JSON.stringify(def.spec)} - ${err.message}`
        );
        results.push({
          collection: def.collection,
          spec: def.spec,
          durationMs,
          status: 'FAILED',
          error: err.message,
        });
      }
    }
  }

  console.log(
    `Index migration completed: ${results.filter((r) => r.status === 'CREATED').length} created, ${results.filter((r) => r.status === 'ALREADY_EXISTS').length} existing, ${results.filter((r) => r.status === 'FAILED').length} failed.`
  );

  return results;
}

// Direct execution CLI harness
if (require.main === module) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  mongoose
    .connect(uri)
    .then(async () => {
      console.log('Connected to MongoDB. Running platform index migration...');
      await migratePlatformIndexes();
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration execution failed:', err);
      process.exit(1);
    });
}
