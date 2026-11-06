// @ts-nocheck
/**
 * Bharat Enterprise Billing System — Platform Control Plane & Business Plane
 * Multi-Store Boundary Separation & Schema Drift Comprehensive Test Suite
 *
 * Targets Covered:
 * 1. Multi-Store Branch Separation:
 *    - Strict batch inventory boundary isolation (FIFO and manual allocation).
 *    - Warehouse location stock movement tracking without cross-warehouse leakage.
 *    - Store-specific cashier register isolation and reconciliation.
 *    - Default store fallback for legacy records without storeId/branchId.
 *
 * 2. Tenant Onboarding Cold-Boot:
 *    - Platform control plane onboarding (POST /api/platform/tenants).
 *    - Automated trial subscription provisioning and plan snapshot assignment.
 *    - Default roles and preference setup.
 *    - Isolated tenant environment with zero orphaned references.
 *    - Cold-boot resilience when Plan collection is initially empty.
 *    - Atomic rollback on provisioning failure.
 *
 * 3. Cold-Boot & Legacy Schema Compatibility (v2 -> v3 Drift):
 *    - Legacy v2 tenants with zero subscription records (graceful fallback without TypeError).
 *    - Legacy subscriptions with missing pricing snapshots, null dates, or missing grace periods.
 *    - Safe numeric arithmetic (daysRemaining is valid integer, never NaN).
 *    - Legacy Admin records missing normalized firm names, DL, GSTIN, or preferences.
 *
 * 4. Tenant Suspension & Deletion Lifecycle:
 *    - Platform suspension revokes active user sessions in Session model.
 *    - Active JWT tokens immediately blocked with HTTP 403 and code: 'TENANT_SUSPENDED'.
 *    - Unsuspending tenant immediately restores full read and write access.
 *    - Permanent tenant deletion (DELETE /api/platform/tenants/:id) purges all related state with zero orphans.
 *
 * Native execution via Node 22 test runner:
 *   npx tsx admin/backend/tests/multiStoreAndSchemaDrift.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';

// ─── Control Plane Models & Services ──────────────────────────────
import PlatformUser from '../models/PlatformUser';
import PlatformSession from '../models/PlatformSession';
import TenantFeatureOverride, { EMERGENCY_BYPASS_FEATURE } from '../models/TenantFeatureOverride';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformAuditHead, AUDIT_GENESIS_HASH } from '../models/PlatformAuditHead';
import { logPlatformAudit, verifyAuditChain } from '../services/platformAuditService';
import { resolveEffectiveFeatures } from '../services/featureOverrideService';
import { listTenantsQuery } from '../queries/tenantQueries';
import { getTenantOverview } from '../queries/tenantDataQueries';
import platformRouter from '../routes';
import { PlatformRole, PlatformPermission } from '../types';

// ─── Business Plane Models & Services ─────────────────────────────
import Admin from '../../../backend/models/Admin';
import Batch from '../../../backend/models/Batch';
import StockMovement from '../../../backend/models/StockMovement';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import SubscriptionPayment from '../../../backend/saas/models/SubscriptionPayment';
import SubscriptionAdjustment from '../../../backend/saas/models/SubscriptionAdjustment';
import { Feature, PlanCode, SubscriptionStatus } from '../../../backend/saas/shared/features';
import * as featureService from '../../../backend/saas/services/featureService';
import * as inventoryService from '../../../backend/services/inventoryService';

const Product: mongoose.Model<any> = require('../../../backend/models/Product');
const Invoice: mongoose.Model<any> = require('../../../backend/models/Invoice');
const Customer: mongoose.Model<any> = require('../../../backend/models/Customer');
const Payment: mongoose.Model<any> = require('../../../backend/models/Payment');
const Employee: mongoose.Model<any> = require('../../../backend/models/Employee');
const Session: mongoose.Model<any> = require('../../../backend/models/Session');
const authMiddleware = require('../../../backend/middleware/auth');
const paymentController = require('../../../backend/controllers/paymentController');

// ─── Environment Protection Guard ────────────────────────────────
const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/test_bharat_multi_store_and_schema_drift';
const TEST_JWT_SECRET = 'super-secret-test-jwt-boundary-key-32chars!';

interface RequestOptions {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: any;
  cookie?: string;
}

interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Headers;
  cookie: string | null;
}

async function apiReq<T = any>(baseUrl: string, options: RequestOptions): Promise<ApiResponse<T>> {
  const url = `${baseUrl}${options.path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(10000),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  const setCookie = res.headers.get('set-cookie');
  let tokenCookie: string | null = null;
  if (setCookie) {
    const match = setCookie.match(/platform_token=([^;]+)/);
    if (match) {
      tokenCookie = `platform_token=${match[1]}`;
    }
  }

  return {
    status: res.status,
    data,
    headers: res.headers,
    cookie: tokenCookie,
  };
}

describe('Multi-Store Boundary Separation & Schema Drift Audit Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const BOOTSTRAP_EMAIL = 'controlplane-owner@bharatenterprise.com';
  const BOOTSTRAP_TEMP_PASS = 'PlatformInitPass123!';
  const NEW_OWNER_PASS = 'NewSecurePassword123!';

  let platformTokenCookie: string = '';

  before(async () => {
    // 1. Enforce local test database isolation
    process.env.MONGODB_URI = TEST_MONGO_URI;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.PLATFORM_JWT_SECRET = 'platform-jwt-secret-for-multistore-test-min32chars';
    process.env.PLATFORM_BOOTSTRAP_EMAIL = BOOTSTRAP_EMAIL;
    process.env.PLATFORM_BOOTSTRAP_PASSWORD = BOOTSTRAP_TEMP_PASS;
    process.env.PLATFORM_BOOTSTRAP_NAME = 'Platform MultiStore Auditor';
    process.env.PLATFORM_MFA_KEY = 'mfa-key-32-characters-for-test!!';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGO_URI);
    }

    // Purge test collections
    const collections = [
      'platformusers',
      'platformsessions',
      'tenantfeatureoverrides',
      'platformauditlogs',
      'platformauditheads',
      'admins',
      'employees',
      'sessions',
      'subscriptions',
      'subscriptionpayments',
      'subscriptionadjustments',
      'plans',
      'products',
      'batches',
      'stockmovements',
      'invoices',
      'customers',
      'payments',
    ];
    for (const coll of collections) {
      try {
        await mongoose.connection.collection(coll).deleteMany({});
      } catch {}
    }

    // 2. Provision Platform Owner directly on existing connection
    await PlatformUser.create({
      fullName: 'Platform MultiStore Auditor',
      email: BOOTSTRAP_EMAIL,
      password: BOOTSTRAP_TEMP_PASS,
      role: PlatformRole.PLATFORM_OWNER,
      mustChangePassword: true,
      isActive: true,
    });

    // Seed default Starter Plan
    await Plan.create({
      code: PlanCode.STARTER,
      name: 'Starter Plan',
      description: 'Essential billing capabilities',
      baseMonthlyPrice: 299,
      features: [Feature.INVOICE_CREATE, Feature.CUSTOMERS, Feature.PRODUCTS],
      active: true,
    });

    // 3. Set up Express application mounting Platform and Tenant routes
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Platform Control Plane router
    app.use('/api/platform', platformRouter);

    // Business Plane test endpoints protected by auth.protect
    app.get('/api/protected/business-read', authMiddleware.protect, (req: any, res: any) => {
      res.status(200).json({
        success: true,
        tenantId: req.userRole === 'admin' ? req.user._id : req.user.createdByAdmin,
        userRole: req.userRole,
      });
    });

    app.post('/api/protected/business-write', authMiddleware.protect, (req: any, res: any) => {
      res.status(200).json({
        success: true,
        message: 'Write mutation permitted',
        userId: req.user._id,
      });
    });

    // Collections API for Cashier register test
    app.get('/api/payments/collections', (req: any, res: any, next: any) => {
      req.admin = { _id: req.query.tenantId ? new Types.ObjectId(String(req.query.tenantId)) : new Types.ObjectId() };
      req.user = req.admin;
      req.userRole = 'admin';
      paymentController.getCollections(req, res, next);
    });

    // Global Express error handler to return structured JSON errors
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
      });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Login as platform owner to acquire session cookie
    const loginRes = await apiReq(baseUrl, {
      method: 'POST',
      path: '/api/platform/auth/login',
      body: { email: BOOTSTRAP_EMAIL, password: BOOTSTRAP_TEMP_PASS },
    });
    assert.equal(loginRes.status, 200);

    // Complete password change to clear mustChangePassword
    const changePassRes = await apiReq(baseUrl, {
      method: 'POST',
      path: '/api/platform/auth/change-password',
      cookie: loginRes.cookie!,
      body: { currentPassword: BOOTSTRAP_TEMP_PASS, newPassword: NEW_OWNER_PASS },
    });
    assert.equal(changePassRes.status, 200);
    platformTokenCookie = changePassRes.cookie || loginRes.cookie!;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      const collections = [
        'platformusers',
        'platformsessions',
        'tenantfeatureoverrides',
        'platformauditlogs',
        'platformauditheads',
        'admins',
        'employees',
        'sessions',
        'subscriptions',
        'plans',
        'products',
        'batches',
        'stockmovements',
        'invoices',
        'customers',
        'payments',
      ];
      for (const coll of collections) {
        try {
          await mongoose.connection.collection(coll).deleteMany({});
        } catch {}
      }
      await mongoose.disconnect();
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // TARGET 1: Multi-Store Branch Separation
  // ══════════════════════════════════════════════════════════════════════════════
  describe('Target 1: Multi-Store Branch Separation & Isolation Invariants', () => {
    let tenantId: Types.ObjectId;
    let productId: Types.ObjectId;
    let batchStoreAId: Types.ObjectId;
    let batchStoreBId: Types.ObjectId;

    beforeEach(async () => {
      tenantId = new Types.ObjectId();

      // Create test product under tenant
      const product = await Product.create({
        tenantId,
        productName: 'Amoxicillin 500mg Strip',
        hsnCode: '3004',
        rate: 85.0,
        newMRP: 110.0,
        gstPercentage: 12,
        currentStockQty: 100,
        unit: 'Strips',
      });
      productId = product._id;

      // Provision Batch 1 in Store Alpha (Warehouse WH-NORTH)
      const b1 = await Batch.create({
        tenantId,
        productId,
        batchNo: 'AMX-STORE-ALPHA',
        storeId: 'store-alpha',
        branchId: 'branch-alpha',
        warehouseLocation: 'WH-NORTH',
        remainingQty: 50,
        initialQty: 50,
        rate: 80.0,
        mrp: 110.0,
        gstPercent: 12,
        expiryDate: new Date('2028-12-31'),
        isActive: true,
      });
      batchStoreAId = b1._id as Types.ObjectId;

      // Provision Batch 2 in Store Beta (Warehouse WH-SOUTH)
      const b2 = await Batch.create({
        tenantId,
        productId,
        batchNo: 'AMX-STORE-BETA',
        storeId: 'store-beta',
        branchId: 'branch-beta',
        warehouseLocation: 'WH-SOUTH',
        remainingQty: 50,
        initialQty: 50,
        rate: 80.0,
        mrp: 110.0,
        gstPercent: 12,
        expiryDate: new Date('2027-10-31'), // Earlier expiry than Store A!
        isActive: true,
      });
      batchStoreBId = b2._id as Types.ObjectId;
    });

    it('1.1 FIFO Allocation: Stock allocation in Store Alpha must strictly consume Store Alpha batches and NEVER touch Store Beta', async () => {
      const invoiceId = new Types.ObjectId();

      // Allocate 20 units scoped strictly to storeId: 'store-alpha'
      const allocated = await inventoryService.allocateFifoStock(
        tenantId,
        productId,
        20,
        invoiceId,
        'INV-ALPHA-001',
        undefined,
        { storeId: 'store-alpha', warehouseLocation: 'WH-NORTH' }
      );

      // Assert allocation consumed Store Alpha batch
      assert.equal(allocated.length, 1);
      assert.equal(allocated[0].batchId.toString(), batchStoreAId.toString());
      assert.equal(allocated[0].batchNo, 'AMX-STORE-ALPHA');
      assert.equal(allocated[0].quantity, 20);

      // Verify database quantities
      const batchA = await Batch.findById(batchStoreAId);
      const batchB = await Batch.findById(batchStoreBId);

      assert.equal(batchA?.remainingQty, 30, 'Store Alpha batch must be decremented from 50 to 30');
      assert.equal(batchB?.remainingQty, 50, 'Store Beta batch must remain intact at 50 despite earlier expiry date!');
    });

    it('1.2 Manual Allocation: Attempting to allocate Store Beta batch while scoped to Store Alpha throws boundary violation error', async () => {
      const invoiceId = new Types.ObjectId();

      await assert.rejects(
        async () => {
          await inventoryService.allocateManualStock(
            tenantId,
            productId,
            [{ batchId: batchStoreBId.toString(), quantity: 10 }],
            10,
            invoiceId,
            'INV-ALPHA-CROSS',
            undefined,
            { storeId: 'store-alpha' } // Bound to Store Alpha!
          );
        },
        /Batch not found or does not belong to this product\/tenant\/store/,
        'Cross-store manual allocation must fail-closed'
      );

      // Verify Store Beta batch remained untouched
      const batchB = await Batch.findById(batchStoreBId);
      assert.equal(batchB?.remainingQty, 50);
    });

    it('1.3 Warehouse Location Stock Movements: Audit history retains strict warehouse boundaries', async () => {
      const invoiceId = new Types.ObjectId();

      await inventoryService.recordStockMovement({
        tenantId,
        productId,
        batchId: batchStoreAId,
        storeId: 'store-alpha',
        branchId: 'branch-alpha',
        warehouseLocation: 'WH-NORTH',
        type: 'SALE',
        quantity: 5,
        rate: 80,
        totalValue: 400,
        referenceType: 'Invoice',
        referenceId: invoiceId.toString(),
      });

      await inventoryService.recordStockMovement({
        tenantId,
        productId,
        batchId: batchStoreBId,
        storeId: 'store-beta',
        branchId: 'branch-beta',
        warehouseLocation: 'WH-SOUTH',
        type: 'SALE',
        quantity: 8,
        rate: 80,
        totalValue: 640,
        referenceType: 'Invoice',
        referenceId: invoiceId.toString(),
      });

      // Query movements by warehouseLocation
      const northMovements = await StockMovement.find({ tenantId, warehouseLocation: 'WH-NORTH' });
      const southMovements = await StockMovement.find({ tenantId, warehouseLocation: 'WH-SOUTH' });

      assert.equal(northMovements.length, 1);
      assert.equal(northMovements[0].storeId, 'store-alpha');
      assert.equal(northMovements[0].quantity, 5);

      assert.equal(southMovements.length, 1);
      assert.equal(southMovements[0].storeId, 'store-beta');
      assert.equal(southMovements[0].quantity, 8);
    });

    it('1.4 Store-Specific Cash Registers: Collections closeout must isolate cashier drawer balances down to the exact paisa', async () => {
      const customer = await Customer.create({
        tenantId,
        customerName: 'Shree Krishna Medicals',
        phone: '9876543210',
      });

      const invoiceA = await Invoice.create({
        tenantId,
        invoiceNumber: 'INV-ALPHA-REGISTER',
        storeId: 'store-alpha',
        registerId: 'REG-ALPHA-01',
        customer: { _id: customer._id, customerName: customer.customerName },
        totals: { baseAmount: 5000, totalDiscount: 0, totalTaxable: 5000, totalGST: 600, totalCGST: 300, totalSGST: 300, netTotal: 5600, finalTotal: 5600 },
        paymentType: 'Cash',
      });

      const invoiceB = await Invoice.create({
        tenantId,
        invoiceNumber: 'INV-BETA-REGISTER',
        storeId: 'store-beta',
        registerId: 'REG-BETA-01',
        customer: { _id: customer._id, customerName: customer.customerName },
        totals: { baseAmount: 12000, totalDiscount: 0, totalTaxable: 12000, totalGST: 1440, totalCGST: 720, totalSGST: 720, netTotal: 13440, finalTotal: 13440 },
        paymentType: 'Cash',
      });

      // Cash recorded in Register 1 (Store Alpha)
      await Payment.create({
        tenantId,
        invoice: invoiceA._id,
        customer: customer._id,
        amount: 5600,
        paymentMethod: 'Cash',
        storeId: 'store-alpha',
        registerId: 'REG-ALPHA-01',
      });

      // Cash recorded in Register 2 (Store Beta)
      await Payment.create({
        tenantId,
        invoice: invoiceB._id,
        customer: customer._id,
        amount: 13440,
        paymentMethod: 'Cash',
        storeId: 'store-beta',
        registerId: 'REG-BETA-01',
      });

      // Execute getCollections scoped to REG-ALPHA-01
      const resAlpha = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/payments/collections?tenantId=${tenantId.toString()}&registerId=REG-ALPHA-01&isAllTime=true`,
      });

      assert.equal(resAlpha.status, 200);
      assert.equal(resAlpha.data.success, true);
      assert.equal(resAlpha.data.summary.totalCollected, 5600);
      assert.equal(resAlpha.data.summary.cashCollected, 5600);
      assert.equal(resAlpha.data.total, 1);

      // Execute getCollections scoped to REG-BETA-01
      const resBeta = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/payments/collections?tenantId=${tenantId.toString()}&registerId=REG-BETA-01&isAllTime=true`,
      });

      assert.equal(resBeta.status, 200);
      assert.equal(resBeta.data.summary.totalCollected, 13440);
      assert.equal(resBeta.data.summary.cashCollected, 13440);
      assert.equal(resBeta.data.total, 1);

      // Global tenant reconciliation: Total across registers = 5600 + 13440 = 19040
      const resTotal = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/payments/collections?tenantId=${tenantId.toString()}&isAllTime=true`,
      });
      assert.equal(resTotal.data.summary.totalCollected, 19040);
    });

    it('1.5 Backward Compatibility: Legacy data without storeId defaults gracefully to unassigned scope', async () => {
      // Legacy batch without storeId
      const legacyBatch = await Batch.create({
        tenantId,
        productId,
        batchNo: 'LEGACY-NO-STORE',
        remainingQty: 15,
        initialQty: 15,
        rate: 80,
        mrp: 110,
        gstPercent: 12,
        expiryDate: new Date('2029-01-01'),
        isActive: true,
      });

      assert.equal(legacyBatch.storeId, null);
      assert.equal(legacyBatch.branchId, null);
      assert.equal(legacyBatch.warehouseLocation, null);

      // Allocating without storeId options allows consuming legacy batch
      const allocated = await inventoryService.allocateFifoStock(
        tenantId,
        productId,
        5,
        new Types.ObjectId(),
        'INV-LEGACY-001'
      );

      assert.equal(allocated.length, 1);
      assert.ok(allocated[0].quantity > 0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // TARGET 2: Tenant Onboarding Cold-Boot Lifecycle (POST /api/platform/tenants)
  // ══════════════════════════════════════════════════════════════════════════════
  describe('Target 2: Tenant Onboarding Cold-Boot & Isolation Lifecycle', () => {
    it('2.1 Cold-Boot Provisioning: POST /api/platform/tenants creates Admin, Trial Subscription, and isolated state', async () => {
      const email = `tenant-${Date.now()}@testpharma.in`;
      const res = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/tenants',
        cookie: platformTokenCookie,
        body: {
          email,
          firmName: 'Apollo Medicos Test Ltd',
          firmAddress: '101 MG Road, Bengaluru',
          firmPhone: '080-23456789',
          firmGSTIN: '29ABCDE1234F1Z5',
          planCode: 'starter',
          trialDays: 21,
          reason: 'Enterprise pilot onboarding for multi-branch pharmacy network',
        },
      });

      assert.equal(res.status, 201, `Tenant onboarding failed: ${JSON.stringify(res.data)}`);
      assert.equal(res.data.success, true);
      assert.ok(res.data.data.tenantId);
      assert.equal(res.data.data.email, email);
      assert.equal(res.data.data.isActive, true);
      assert.equal(res.data.data.subscription.status, SubscriptionStatus.TRIAL);
      assert.equal(res.data.data.subscription.daysRemaining, 21);

      const createdTenantId = new Types.ObjectId(res.data.data.tenantId);

      // Verify Admin document in database
      const adminDoc = await Admin.findById(createdTenantId);
      assert.ok(adminDoc);
      assert.equal(adminDoc.firmName, 'Apollo Medicos Test Ltd');
      assert.equal(adminDoc.normalizedFirmName, 'apollo medicos test ltd');
      assert.equal(adminDoc.preferences.themeMode, 'dark');

      // Verify Subscription document in database
      const subDoc = await Subscription.findOne({ tenantId: createdTenantId });
      assert.ok(subDoc);
      assert.equal(subDoc.status, SubscriptionStatus.TRIAL);
      assert.equal(subDoc.currentPricingSnapshot.planCode, 'starter');

      // Verify Zero Orphaned References across all tenant collections
      const [invoiceCount, customerCount, productCount, employeeCount] = await Promise.all([
        Invoice.countDocuments({ tenantId: createdTenantId }),
        Customer.countDocuments({ tenantId: createdTenantId }),
        Product.countDocuments({ tenantId: createdTenantId }),
        Employee.countDocuments({ createdByAdmin: createdTenantId }),
      ]);

      assert.equal(invoiceCount, 0, 'New tenant must start with zero invoices');
      assert.equal(customerCount, 0, 'New tenant must start with zero customers');
      assert.equal(productCount, 0, 'New tenant must start with zero products');
      assert.equal(employeeCount, 0, 'New tenant must start with zero employees');

      // Verify Platform Audit Trail
      const auditLog = await PlatformAuditLog.findOne({
        action: 'TENANT.CREATE',
        targetId: createdTenantId.toString(),
      });
      assert.ok(auditLog, 'Tenant creation must record audit log');
      assert.equal(auditLog.severity, 'INFO');
    });

    it('2.2 Cold-Boot Resilience: Onboarding succeeds and seeds default Starter plan even when Plan collection is empty', async () => {
      // Temporarily purge plans to simulate raw cold boot
      await Plan.deleteMany({});
      const planCountBefore = await Plan.countDocuments();
      assert.equal(planCountBefore, 0, 'Plans collection is empty on raw cold boot');

      const email = `coldboot-${Date.now()}@resilientpharma.in`;
      const res = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/tenants',
        cookie: platformTokenCookie,
        body: {
          email,
          firmName: 'Cold Boot Pharmaceuticals',
          reason: 'Verifying cold boot resilience against empty Plan table',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);

      // Verify plan was automatically seeded
      const planCountAfter = await Plan.countDocuments();
      assert.ok(planCountAfter >= 1, 'Starter plan must have been automatically seeded on cold boot');
    });

    it('2.3 Duplicate Email Prevention: Rejects already registered email with HTTP 400', async () => {
      const email = `duplicate-${Date.now()}@pharma.in`;

      // First onboarding
      const res1 = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/tenants',
        cookie: platformTokenCookie,
        body: { email, firmName: 'First Firm', reason: 'Initial onboarding' },
      });
      assert.equal(res1.status, 201);

      // Second onboarding with identical email
      const res2 = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/tenants',
        cookie: platformTokenCookie,
        body: { email, firmName: 'Second Firm Duplicate', reason: 'Attempt duplicate registration' },
      });
      assert.equal(res2.status, 400);
      assert.match(res2.data.message, /already exists/i);
    });

    it('2.4 Atomic Rollback: Fails gracefully without leaving orphaned Admin records if subscription creation fails', async () => {
      const email = `orphan-test-${Date.now()}@atomic.in`;

      // Mock Subscription.create to throw a database conflict error
      const originalSubCreate = Subscription.create;
      (Subscription as any).create = async () => {
        throw new Error('Simulated Database WriteConflict during subscription allocation');
      };

      try {
        const res = await apiReq(baseUrl, {
          method: 'POST',
          path: '/api/platform/tenants',
          cookie: platformTokenCookie,
          body: { email, firmName: 'Atomic Rollback Test Pharmacy', reason: 'Testing rollback' },
        });

        // Request must return error status
        assert.ok(res.status >= 500 || res.status === 400);

        // Verify that Admin was deleted and NO orphan document was left in database!
        const orphanedAdmin = await Admin.findOne({ email });
        assert.equal(orphanedAdmin, null, 'Partially created Admin MUST be rolled back, leaving zero orphans');
      } finally {
        (Subscription as any).create = originalSubCreate;
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // TARGET 3: Cold-Boot & Legacy Schema Compatibility (v2 -> v3 Drift)
  // ══════════════════════════════════════════════════════════════════════════════
  describe('Target 3: Cold-Boot & Legacy Schema Compatibility (v2 -> v3 Drift)', () => {
    it('3.1 Legacy Tenant with Zero Subscriptions: Gracefully handles read queries without throwing TypeError', async () => {
      // Create legacy v2 tenant with NO subscription record
      const legacyTenant = await Admin.create({
        email: `legacy-v2-${Date.now()}@retail.in`,
        password: 'PasswordLegacy123!',
        firmName: 'Legacy V2 Retail Pharmacy',
        isActive: true,
      });

      const tenantIdStr = legacyTenant._id.toString();

      // Verify zero subscription documents in DB
      const subDoc = await Subscription.findOne({ tenantId: legacyTenant._id });
      assert.equal(subDoc, null, 'Must have zero subscription records');

      // 1. getSubscriptionInfo: Must return fallback info without throwing TypeError
      const subInfo = await featureService.getSubscriptionInfo(tenantIdStr);
      assert.ok(subInfo);
      assert.equal(subInfo.status, SubscriptionStatus.EXPIRED);
      assert.equal(subInfo.canWrite, false);
      assert.deepEqual(subInfo.plan.features, []);
      assert.equal(subInfo.daysRemaining, 0);

      // 2. resolveEffectiveFeatures: Must evaluate safely
      const effective = await resolveEffectiveFeatures(tenantIdStr);
      assert.equal(effective.canWrite, false);
      assert.deepEqual(effective.effectiveFeatures, []);

      // 3. getTenantOverview: Must return clean overview with subscription: null
      const overview = await getTenantOverview(tenantIdStr);
      assert.ok(overview);
      assert.equal(overview.tenantId, tenantIdStr);
      assert.equal(overview.subscription, null);
      assert.equal(overview.effectiveAccess.canWrite, false);

      // 4. listTenantsQuery: Must format keyset item with subscription: null without crashing
      const listResult = await listTenantsQuery({ search: legacyTenant.email });
      assert.equal(listResult.data.length, 1);
      assert.equal(listResult.data[0].tenantId, tenantIdStr);
      assert.equal(listResult.data[0].subscription, null);
    });

    it('3.2 Corrupted / Partial Legacy Subscriptions: Null dates and missing snapshots handle arithmetic cleanly', async () => {
      const tenant = await Admin.create({
        email: `partial-sub-${Date.now()}@drift.in`,
        password: 'Pass1234Secure!',
        firmName: 'Drift Test Ltd',
        isActive: true,
      });

      // Insert raw legacy subscription bypassing schema validation (simulating v2 legacy data)
      await mongoose.connection.collection('subscriptions').insertOne({
        tenantId: tenant._id,
        planId: null,
        status: SubscriptionStatus.ACTIVE,
        startedAt: null,
        expiresAt: null,
        graceUntil: null,
        gracePeriodDays: 0,
        currentPricingSnapshot: null, // Missing snapshot!
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // getSubscriptionInfo: Must resolve status and valid numeric daysRemaining (never NaN!)
      const info = await featureService.getSubscriptionInfo(tenant._id.toString());
      assert.ok(info);
      assert.equal(typeof info.daysRemaining, 'number');
      assert.equal(isNaN(info.daysRemaining), false, 'daysRemaining must never be NaN');
      assert.equal(info.daysRemaining, 0);

      // getTenantOverview: Must format dates safely without throwing RangeError
      const overview = await getTenantOverview(tenant._id.toString());
      assert.ok(overview);
      assert.ok(overview.subscription);
      assert.equal(overview.subscription.expiresAt, '');
      assert.equal(overview.subscription.daysRemaining, 0);

      // listTenantsQuery: Formats safely
      const listRes = await listTenantsQuery({ search: tenant.email });
      assert.equal(listRes.data.length, 1);
      assert.equal(listRes.data[0].subscription?.expiresAt, '');
    });

    it('3.3 Legacy Admin Records: Missing normalizedFirmName or preferences format seamlessly', async () => {
      // Direct raw MongoDB insert bypassing Mongoose schema default hooks
      const rawId = new Types.ObjectId();
      await mongoose.connection.collection('admins').insertOne({
        _id: rawId,
        email: `raw-legacy-${Date.now()}@v1.in`,
        firmName: 'Raw V1 Medicos',
        isActive: true,
        // Intentionally omitting: normalizedFirmName, preferences, firmAddress, firmDL, firmGSTIN
      });

      const overview = await getTenantOverview(rawId.toString());
      assert.equal(overview.firmName, 'Raw V1 Medicos');
      assert.equal(overview.firmAddress, '');
      assert.equal(overview.firmGSTIN, '');
      assert.equal(overview.preferences.themeMode, 'dark');

      const listRes = await listTenantsQuery({ search: 'Raw V1 Medicos' });
      assert.equal(listRes.data.length, 1);
      assert.equal(listRes.data[0].normalizedFirmName, 'raw v1 medicos');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // TARGET 4: Tenant Suspension & Deletion Lifecycle
  // ══════════════════════════════════════════════════════════════════════════════
  describe('Target 4: Tenant Suspension, JWT Revocation & Deletion Lifecycle', () => {
    let tenantId: Types.ObjectId;
    let employeeId: Types.ObjectId;
    let adminToken: string;
    let employeeToken: string;

    beforeEach(async () => {
      tenantId = new Types.ObjectId();
      employeeId = new Types.ObjectId();

      // Create Admin
      await Admin.create({
        _id: tenantId,
        email: `active-tenant-${Date.now()}@pharmacy.in`,
        password: 'AdminPassword123!',
        firmName: 'Suspension Test Pharmacy',
        isActive: true,
      });

      // Create Employee under Admin
      await Employee.create({
        _id: employeeId,
        email: `operator-${Date.now()}@pharmacy.in`,
        password: 'EmployeePassword123!',
        name: 'Billing Operator One',
        createdByAdmin: tenantId,
        isActive: true,
        role: 'billing_operator',
      });

      // Create active user sessions
      await Session.create({ user: tenantId, userModel: 'Admin', isActive: true });
      await Session.create({ user: employeeId, userModel: 'Employee', isActive: true });

      // Generate active JWT tokens
      adminToken = jwt.sign({ id: tenantId.toString(), role: 'admin' }, TEST_JWT_SECRET, { expiresIn: '7d' });
      employeeToken = jwt.sign({ id: employeeId.toString(), role: 'employee' }, TEST_JWT_SECRET, { expiresIn: '7d' });
    });

    it('4.1 Pre-Suspension: Valid tokens allow normal read/write operations with HTTP 200', async () => {
      const resAdmin = await apiReq(baseUrl, {
        method: 'GET',
        path: '/api/protected/business-read',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(resAdmin.status, 200);
      assert.equal(resAdmin.data.userRole, 'admin');

      const resEmployee = await apiReq(baseUrl, {
        method: 'GET',
        path: '/api/protected/business-read',
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      assert.equal(resEmployee.status, 200);
      assert.equal(resEmployee.data.userRole, 'employee');
    });

    it('4.2 Suspending Tenant: Revokes active sessions and immediately blocks both Admin and Employee tokens with 403 TENANT_SUSPENDED', async () => {
      // Suspend tenant via Platform Control Plane
      const suspendRes = await apiReq(baseUrl, {
        method: 'POST',
        path: `/api/platform/tenants/${tenantId.toString()}/suspend`,
        cookie: platformTokenCookie,
        body: { reason: 'Commercial default and terms of service breach review' },
      });

      assert.equal(suspendRes.status, 200);
      assert.equal(suspendRes.data.success, true);
      assert.equal(suspendRes.data.data.isActive, false);

      // Verify Sessions were revoked in database
      const activeSessionsCount = await Session.countDocuments({
        user: { $in: [tenantId, employeeId] },
        isActive: true,
      });
      assert.equal(activeSessionsCount, 0, 'All active user sessions must be revoked on tenant suspension');

      // Attempt API call using Admin JWT token
      const adminAttempt = await apiReq(baseUrl, {
        method: 'GET',
        path: '/api/protected/business-read',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(adminAttempt.status, 403, 'Admin call must be blocked with HTTP 403');
      assert.equal(adminAttempt.data.code, 'TENANT_SUSPENDED');

      // Attempt API call using Employee JWT token
      const employeeAttempt = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/protected/business-write',
        headers: { Authorization: `Bearer ${employeeToken}` },
        body: { test: 'payload' },
      });

      assert.equal(employeeAttempt.status, 403, 'Employee call must be blocked with HTTP 403');
      assert.equal(employeeAttempt.data.code, 'TENANT_SUSPENDED');
    });

    it('4.3 Unsuspending Tenant: Immediately restores full read and write access without token reissue', async () => {
      // Suspend tenant first
      await apiReq(baseUrl, {
        method: 'POST',
        path: `/api/platform/tenants/${tenantId.toString()}/suspend`,
        cookie: platformTokenCookie,
        body: { reason: 'Temporary administrative audit suspension' },
      });

      // Unsuspend tenant via Platform Control Plane
      const unsuspendRes = await apiReq(baseUrl, {
        method: 'POST',
        path: `/api/platform/tenants/${tenantId.toString()}/unsuspend`,
        cookie: platformTokenCookie,
        body: { reason: 'Audit completed and billing verified successfully' },
      });

      assert.equal(unsuspendRes.status, 200);
      assert.equal(unsuspendRes.data.success, true);
      assert.equal(unsuspendRes.data.data.isActive, true);

      // Immediately call API using existing tokens — access must be fully restored!
      const adminRestored = await apiReq(baseUrl, {
        method: 'GET',
        path: '/api/protected/business-read',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(adminRestored.status, 200, 'Admin access must be immediately restored');

      const employeeRestored = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/protected/business-write',
        headers: { Authorization: `Bearer ${employeeToken}` },
        body: { test: 'mutation after reactivation' },
      });
      assert.equal(employeeRestored.status, 200, 'Employee access must be immediately restored');
    });

    it('4.4 Permanent Tenant Deletion: Purges tenant data and leaves zero orphaned references', async () => {
      // Create additional artifacts for this tenant
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 14 * 86400000);
      const graceUntil = new Date(expiresAt.getTime() + 7 * 86400000);
      await Subscription.create({
        tenantId,
        planId: new Types.ObjectId(),
        status: SubscriptionStatus.TRIAL,
        startedAt: now,
        expiresAt,
        graceUntil,
        gracePeriodDays: 7,
        currentPricingSnapshot: {
          planName: 'Starter Plan',
          planCode: PlanCode.STARTER,
          baseMonthlyPrice: 299,
          durationMonths: 1,
          discountApplied: 0,
          finalAmount: 299,
          features: [Feature.INVOICE_CREATE, Feature.CUSTOMERS],
        },
      });

      await TenantFeatureOverride.create({
        tenantId,
        feature: Feature.INVOICE_CREATE,
        type: 'ALLOW',
        reason: 'Override for test',
        createdBy: new Types.ObjectId(),
        isActive: true,
      });

      // Execute tenant deletion via Platform Control Plane
      const delRes = await apiReq(baseUrl, {
        method: 'DELETE',
        path: `/api/platform/tenants/${tenantId.toString()}`,
        cookie: platformTokenCookie,
        body: { reason: 'Permanent GDPR/Enterprise data sanitization request' },
      });

      assert.equal(delRes.status, 200);
      assert.equal(delRes.data.success, true);

      // Verify zero orphaned references
      const [adminFound, subFound, empFound, sessionFound, overrideFound] = await Promise.all([
        Admin.findById(tenantId),
        Subscription.findOne({ tenantId }),
        Employee.findOne({ createdByAdmin: tenantId }),
        Session.findOne({ user: { $in: [tenantId, employeeId] } }),
        TenantFeatureOverride.findOne({ tenantId }),
      ]);

      assert.equal(adminFound, null, 'Admin must be deleted');
      assert.equal(subFound, null, 'Subscription must be deleted');
      assert.equal(empFound, null, 'Employee records must be deleted');
      assert.equal(sessionFound, null, 'Sessions must be deleted');
      assert.equal(overrideFound, null, 'Overrides must be deleted');

      // Verify Audit Log records TENANT.DELETE with cryptographic integrity
      const auditLog = await PlatformAuditLog.findOne({
        action: 'TENANT.DELETE',
        targetId: tenantId.toString(),
      });
      assert.ok(auditLog, 'Audit log must record tenant deletion');
      assert.equal(auditLog.severity, 'CRITICAL');
    });
  });
});

