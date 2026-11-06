/**
 * Bharat Enterprise Billing System — Platform Control Plane E2E Lifecycle Workflows
 * Comprehensive end-to-end simulation test suite covering:
 * 1. Super Admin Platform Owner Journey (Bootstrap -> MustChangePassword -> MFA -> Login -> Session Persistence)
 * 2. Tenant Diagnostic Support Session Lifecycle (Start -> Deep Inspection -> Read-Only Mutation Gating -> End -> Expired Gating)
 * 3. Tenant Feature Overrides & Emergency Commercial Bypass Lifecycle (Expired Tenant -> 24h Bypass -> 100h Rejection -> Revocation)
 * 4. Cryptographic Audit Ledger Verification Lifecycle (5 Actions -> Monotonic Sequences -> Hash Chaining -> Verify-Chain API)
 *
 * Executed natively via Node 22 test runner:
 *   npx tsx admin/backend/tests/e2eLifecycleWorkflows.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
const cookieParser: any = require('cookie-parser');
import mongoose, { Types } from 'mongoose';

// Platform Auth & CLI Provisioning
import { bootstrapPlatformOwner } from '../scripts/bootstrapPlatformOwner';
import PlatformUser from '../models/PlatformUser';
import PlatformSession from '../models/PlatformSession';
import PlatformSupportSession from '../models/PlatformSupportSession';
import TenantFeatureOverride, { EMERGENCY_BYPASS_FEATURE } from '../models/TenantFeatureOverride';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformAuditHead, AUDIT_GENESIS_HASH } from '../models/PlatformAuditHead';
import * as mfaService from '../auth/mfaService';
import * as platformAuthService from '../auth/platformAuthService';
import { logPlatformAudit } from '../services/platformAuditService';
import { resolveEffectiveFeatures } from '../services/featureOverrideService';

// Control Plane Routing & Middleware
import platformRouter from '../routes';
import { enforceSupportSessionBounds } from '../middleware/supportSessionMiddleware';
import { PlatformRole, PlatformPermission, SupportSessionStatus } from '../types';

// Tenant Domain Models
import Admin from '../../../backend/models/Admin';
import Subscription from '../../../backend/saas/models/Subscription';
import { SubscriptionStatus, Feature, PlanCode } from '../../../backend/saas/shared/features';
const Product: mongoose.Model<any> = require('../../../backend/models/Product');
const Invoice: mongoose.Model<any> = require('../../../backend/models/Invoice');
const Customer: mongoose.Model<any> = require('../../../backend/models/Customer');

const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/test_bharat_e2e_lifecycle_workflows';

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

describe('E2E Lifecycle Workflows & Operator Journeys', () => {
  let server: http.Server;
  let baseUrl: string;

  const BOOTSTRAP_EMAIL = 'superowner@bharatplatform.com';
  const BOOTSTRAP_TEMP_PASSWORD = 'InitialTempPass123!';
  const NEW_STRONG_PASSWORD = 'BrandNewStrongPassword123!';

  let ownerTokenCookie: string | null = null;
  let ownerTotpSecret: string = '';
  let targetTenantId: Types.ObjectId;
  let activeSupportSessionCode: string = '';
  let activeSupportSessionId: string = '';

  before(async () => {
    // 1. Configure environment overrides for test isolation
    process.env.MONGODB_URI = TEST_MONGO_URI;
    process.env.PLATFORM_JWT_SECRET = 'e2e-workflow-super-secret-key-32bytes-min';
    process.env.PLATFORM_BOOTSTRAP_EMAIL = BOOTSTRAP_EMAIL;
    process.env.PLATFORM_BOOTSTRAP_PASSWORD = BOOTSTRAP_TEMP_PASSWORD;
    process.env.PLATFORM_BOOTSTRAP_NAME = 'Platform Super Owner';
    process.env.PLATFORM_MFA_KEY = 'mfa-test-encryption-key-32-chars-long!';

    // Connect to test DB and purge old state
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGO_URI);
    }
    const collections = [
      'platformusers',
      'platformsessions',
      'platformsupportsessions',
      'tenantfeatureoverrides',
      'platformauditlogs',
      'platformauditheads',
      'admins',
      'subscriptions',
      'products',
      'invoices',
      'customers',
    ];
    for (const coll of collections) {
      try {
        await mongoose.connection.collection(coll).deleteMany({});
      } catch {
        // collection might not exist yet
      }
    }

    // Disconnect so bootstrapPlatformOwner() can execute its own connection lifecycle
    await mongoose.disconnect();

    // 2. Initialize Express Test Server
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Diagnostic Support Session Bounds Enforcement (protects all paths)
    app.use(enforceSupportSessionBounds);

    // Mount Platform Control Plane
    app.use('/api/platform', platformRouter);

    // Mount Mock Tenant Business Mutation Endpoints to simulate business plane
    app.post('/api/invoices', (_req, res) => {
      res.status(201).json({ success: true, message: 'Invoice created successfully' });
    });
    app.post('/api/customers', (_req, res) => {
      res.status(201).json({ success: true, message: 'Customer created successfully' });
    });
    app.put('/api/customers/:id', (_req, res) => {
      res.status(200).json({ success: true, message: 'Customer updated successfully' });
    });

    // Start HTTP server on dynamic ephemeral port
    server = app.listen(0);
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      const collections = [
        'platformusers',
        'platformsessions',
        'platformsupportsessions',
        'tenantfeatureoverrides',
        'platformauditlogs',
        'platformauditheads',
        'admins',
        'subscriptions',
        'products',
        'invoices',
        'customers',
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
  // JOURNEY 1: Super Admin Platform Owner Provisioning, Auth & MFA Lifecycle
  // ══════════════════════════════════════════════════════════════════════════════
  describe('Journey 1: Super Admin Platform Owner Lifecycle', () => {
    it('Step 1.1: Provision Platform Owner via bootstrapPlatformOwner CLI', async () => {
      // Execute provisioner script
      await bootstrapPlatformOwner();

      // Reconnect to verify state in DB
      await mongoose.connect(TEST_MONGO_URI);

      const owner = await PlatformUser.findOne({ email: BOOTSTRAP_EMAIL });
      assert.ok(owner, 'Platform Owner user must exist in database');
      assert.equal(owner.role, PlatformRole.PLATFORM_OWNER);
      assert.equal(owner.mustChangePassword, true, 'Initial provisioned owner must have mustChangePassword=true');
      assert.equal(owner.mfaEnabled, false, 'Initial owner must have mfaEnabled=false');
      assert.equal(owner.isActive, true);
    });

    it('Step 1.2: Execute initial login with temporary password -> mustChangePassword === true', async () => {
      const res = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/auth/login',
        body: {
          email: BOOTSTRAP_EMAIL,
          password: BOOTSTRAP_TEMP_PASSWORD,
        },
      });

      assert.equal(res.status, 200, 'Initial login should succeed');
      assert.equal(res.data.success, true);
      assert.equal(res.data.mfaRequired, false, 'MFA should not be required on first temporary login');
      assert.ok(res.data.user, 'User object should be returned');
      assert.equal(res.data.user.mustChangePassword, true, 'User must have mustChangePassword=true in response');
      assert.ok(res.cookie, 'platform_token cookie must be set');

      ownerTokenCookie = res.cookie;
    });

    it('Step 1.3: Attempt accessing protected route prior to password change -> blocked with HTTP 403', async () => {
      assert.ok(ownerTokenCookie, 'Must have active session cookie');

      const res = await apiReq(baseUrl, {
        method: 'GET',
        path: '/api/platform/tenants',
        cookie: ownerTokenCookie,
      });

      assert.equal(res.status, 403, 'Access to protected resources must be blocked with HTTP 403');
      assert.equal(res.data.success, false);
      assert.equal(res.data.code, 'PASSWORD_CHANGE_REQUIRED');
      assert.match(res.data.error, /You must change your temporary platform password/i);
    });

    it('Step 1.4: Resolve password change -> verify mustChangePassword === false and route unblocked', async () => {
      const res = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/auth/change-password',
        cookie: ownerTokenCookie!,
        body: {
          currentPassword: BOOTSTRAP_TEMP_PASSWORD,
          newPassword: NEW_STRONG_PASSWORD,
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.match(res.data.message, /Password changed successfully/i);

      // Verify in DB that mustChangePassword is now false
      const owner = await PlatformUser.findOne({ email: BOOTSTRAP_EMAIL });
      assert.ok(owner);
      assert.equal(owner.mustChangePassword, false);

      // Verify that protected resource is now accessible without 403 PASSWORD_CHANGE_REQUIRED
      const accessRes = await apiReq(baseUrl, {
        method: 'GET',
        path: '/api/platform/tenants',
        cookie: ownerTokenCookie!,
      });
      assert.equal(accessRes.status, 200, 'Protected route must now be accessible');
      assert.equal(accessRes.data.success, true);
    });

    it('Step 1.5: Setup MFA -> receive secret, generate valid TOTP, verify -> receive backup codes', async () => {
      const setupRes = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/auth/mfa/setup',
        cookie: ownerTokenCookie!,
      });

      assert.equal(setupRes.status, 200);
      assert.equal(setupRes.data.success, true);
      assert.ok(setupRes.data.secret, 'Must receive base32 secret');
      assert.equal(setupRes.data.secret.length, 32);
      assert.match(setupRes.data.otpAuthUri, /^otpauth:\/\/totp\//);
      assert.ok(Array.isArray(setupRes.data.backupCodes), 'Must receive backup codes array');
      assert.equal(setupRes.data.backupCodes.length, 8, 'Must generate exactly 8 single-use recovery codes');

      ownerTotpSecret = setupRes.data.secret;

      // Compute valid 6-digit TOTP code
      const currentStep = Math.floor(Date.now() / 1000 / 30);
      const totpCode = mfaService.computeTotpCode(ownerTotpSecret, currentStep);

      // Verify TOTP code to confirm enrollment via /api/platform/auth/mfa/verify
      const verifyRes = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/auth/mfa/verify',
        cookie: ownerTokenCookie!,
        body: {
          code: totpCode,
        },
      });

      assert.equal(verifyRes.status, 200, 'MFA confirmation must succeed');
      assert.equal(verifyRes.data.success, true);

      // Verify in database that mfaEnabled is now true
      const owner = await PlatformUser.findOne({ email: BOOTSTRAP_EMAIL });
      assert.ok(owner);
      assert.equal(owner.mfaEnabled, true, 'User must have mfaEnabled=true after verification');
    });

    it('Step 1.6: Log out -> session invalidated and cookie cleared', async () => {
      const logoutRes = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/auth/logout',
        cookie: ownerTokenCookie!,
      });

      assert.equal(logoutRes.status, 200);
      assert.equal(logoutRes.data.success, true);

      // Verify previous token is rejected
      const meRes = await apiReq(baseUrl, {
        method: 'GET',
        path: '/api/platform/auth/me',
        cookie: ownerTokenCookie!,
      });
      assert.equal(meRes.status, 401, 'Logged out session token must return 401 Unauthorized');
    });

    it('Step 1.7: Log in with MFA challenge & verify session persistence', async () => {
      // Step A: Submit credentials
      const loginRes = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/auth/login',
        body: {
          email: BOOTSTRAP_EMAIL,
          password: NEW_STRONG_PASSWORD,
        },
      });

      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.data.success, true);
      assert.equal(loginRes.data.mfaRequired, true, 'Login must challenge for MFA');
      assert.ok(loginRes.data.mfaPendingToken, 'Must provide short-lived mfaPendingToken');

      // Step B: Submit TOTP challenge response
      const currentStep = Math.floor(Date.now() / 1000 / 30);
      const freshTotpCode = mfaService.computeTotpCode(ownerTotpSecret, currentStep);

      const mfaVerifyRes = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/auth/mfa/verify',
        body: {
          mfaPendingToken: loginRes.data.mfaPendingToken,
          code: freshTotpCode,
        },
      });

      assert.equal(mfaVerifyRes.status, 200);
      assert.equal(mfaVerifyRes.data.success, true);
      assert.ok(mfaVerifyRes.cookie, 'Must issue verified platform_token cookie');
      assert.equal(mfaVerifyRes.data.user.email, BOOTSTRAP_EMAIL);

      ownerTokenCookie = mfaVerifyRes.cookie;

      // Step C: Verify session persistence and active state via /auth/me
      const meRes = await apiReq(baseUrl, {
        method: 'GET',
        path: '/api/platform/auth/me',
        cookie: ownerTokenCookie!,
      });

      assert.equal(meRes.status, 200);
      assert.equal(meRes.data.success, true);
      assert.equal(meRes.data.user.email, BOOTSTRAP_EMAIL);
      assert.equal(meRes.data.user.mfaEnabled, true);
      assert.equal(meRes.data.session.isRevoked, false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // JOURNEY 2: Tenant Diagnostic Support Session Lifecycle
  // ══════════════════════════════════════════════════════════════════════════════
  describe('Journey 2: Tenant Diagnostic Support Session Lifecycle', () => {
    before(async () => {
      // Seed a tenant with Admin, Products, Invoices, and Customers
      targetTenantId = new Types.ObjectId();

      await (Admin as any).create({
        _id: targetTenantId,
        name: 'Target Pharmacy Admin',
        email: 'target.pharmacy@testtenant.in',
        password: 'Password123!',
        firmName: 'Shree Radhe Medicos',
        phone: '9876543210',
        isActive: true,
      });

      await Product.create([
        {
          tenantId: targetTenantId,
          productName: 'Paracetamol 650mg',
          hsnCode: '30049099',
          newMRP: 30.0,
          rate: 24.5,
          stock: 100,
        },
        {
          tenantId: targetTenantId,
          productName: 'Amoxicillin 500mg',
          hsnCode: '30041000',
          newMRP: 85.0,
          rate: 70.0,
          stock: 50,
        },
      ]);

      await Customer.create([
        {
          tenantId: targetTenantId,
          customerName: 'Aarav Patel',
          phone: '9822011223',
          address: 'Station Road, Pune',
        },
        {
          tenantId: targetTenantId,
          customerName: 'Deepak Sharma',
          phone: '9822099887',
          address: 'MG Road, Pune',
        },
      ]);

      await Invoice.create({
        tenantId: targetTenantId,
        invoiceNumber: 'INV-2026-0001',
        invoiceDate: new Date(),
        status: 'Created',
        paymentStatus: 'Paid',
        customer: {
          customerName: 'Aarav Patel',
        },
        totals: {
          baseAmount: 250,
          totalDiscount: 0,
          totalTaxable: 250,
          totalGST: 30,
          totalCGST: 15,
          totalSGST: 15,
          netTotal: 280,
        },
        items: [
          {
            product: { productName: 'Paracetamol 650mg' },
            quantitySold: 10,
            ratePerUnit: 25,
            baseAmount: 250,
            discountAmount: 0,
            taxableAmount: 250,
            gstAmount: 30,
            cgstAmount: 15,
            sgstAmount: 15,
            totalAmount: 280,
          },
        ],
      });
    });

    it('Step 2.1: Platform Operator starts support session -> receives sessionCode SUP-...', async () => {
      const res = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/support/start',
        cookie: ownerTokenCookie!,
        body: {
          targetTenantId: targetTenantId.toString(),
          reason: 'Customer reported discrepancy in ledger balance calculation',
          durationHours: 1,
        },
      });

      assert.equal(res.status, 201, 'Starting support session must return 201 Created');
      assert.equal(res.data.success, true);
      assert.ok(res.data.data, 'Session data must be returned');

      activeSupportSessionCode = res.data.data.sessionCode;
      activeSupportSessionId = res.data.data._id;

      assert.match(
        activeSupportSessionCode,
        /^SUP-\d{8}-[A-F0-9]{4}$/,
        'Session code must conform to format SUP-YYYYMMDD-XXXX'
      );
      assert.equal(res.data.data.status, SupportSessionStatus.ACTIVE);
      assert.equal(res.data.data.isReadOnly, true);
    });

    it('Step 2.2: Operator inspects tenant products, invoices, and customers using x-support-session-code', async () => {
      // 1. Inspect Products
      const productsRes = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/platform/tenants/${targetTenantId}/products`,
        cookie: ownerTokenCookie!,
        headers: {
          'x-support-session-code': activeSupportSessionCode,
        },
      });
      assert.equal(productsRes.status, 200);
      assert.equal(productsRes.data.success, true);
      assert.ok(Array.isArray(productsRes.data.data));
      assert.equal(productsRes.data.data.length, 2);

      // 2. Inspect Invoices
      const invoicesRes = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/platform/tenants/${targetTenantId}/invoices`,
        cookie: ownerTokenCookie!,
        headers: {
          'x-support-session-code': activeSupportSessionCode,
        },
      });
      assert.equal(invoicesRes.status, 200);
      assert.equal(invoicesRes.data.success, true);
      assert.ok(Array.isArray(invoicesRes.data.data));
      assert.equal(invoicesRes.data.data.length, 1);

      // 3. Inspect Customers
      const customersRes = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/platform/tenants/${targetTenantId}/customers`,
        cookie: ownerTokenCookie!,
        headers: {
          'x-support-session-code': activeSupportSessionCode,
        },
      });
      assert.equal(customersRes.status, 200);
      assert.equal(customersRes.data.success, true);
      assert.ok(Array.isArray(customersRes.data.data));
      assert.equal(customersRes.data.data.length, 2);

      // Verify that actionsPerformed has been tracked in database
      const dbSession = await PlatformSupportSession.findById(activeSupportSessionId);
      assert.ok(dbSession);
      assert.ok(dbSession.actionsPerformed >= 3, 'Actions performed count must be at least 3');
    });

    it('Step 2.3: Operator attempts to mutate invoice or customer -> HTTP 403 SUPPORT_SESSION_READ_ONLY', async () => {
      // Attempt 1: Attempt to create an invoice with support session code
      const invoiceMutRes = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': activeSupportSessionCode,
        },
        body: {
          invoiceNumber: 'MALICIOUS-INV-001',
          totalAmount: 10000,
        },
      });
      assert.equal(invoiceMutRes.status, 403, 'Mutating invoice must be blocked with HTTP 403');
      assert.equal(invoiceMutRes.data.code, 'SUPPORT_SESSION_READ_ONLY');
      assert.match(invoiceMutRes.data.error, /Mutating business entities .* is strictly forbidden/i);

      // Attempt 2: Attempt to create a customer with support session code
      const custCreateRes = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/customers',
        headers: {
          'x-support-session-code': activeSupportSessionCode,
        },
        body: {
          customerName: 'Fake Customer',
          phone: '9999999999',
        },
      });
      assert.equal(custCreateRes.status, 403, 'Creating customer must be blocked with HTTP 403');
      assert.equal(custCreateRes.data.code, 'SUPPORT_SESSION_READ_ONLY');

      // Attempt 3: Attempt to update an existing customer with support session code
      const custUpdateRes = await apiReq(baseUrl, {
        method: 'PUT',
        path: '/api/customers/64f1a2b3c4d5e6f7a8b9c0d1',
        headers: {
          'x-support-session-code': activeSupportSessionCode,
        },
        body: {
          customerName: 'Modified Name',
        },
      });
      assert.equal(custUpdateRes.status, 403, 'Updating customer must be blocked with HTTP 403');
      assert.equal(custUpdateRes.data.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('Step 2.4: Operator ends support session via POST /api/platform/support/:id/end', async () => {
      const res = await apiReq(baseUrl, {
        method: 'POST',
        path: `/api/platform/support/${activeSupportSessionId}/end`,
        cookie: ownerTokenCookie!,
        body: {
          reason: 'Diagnostic inspection concluded successfully',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.status, SupportSessionStatus.ENDED);
      assert.ok(res.data.data.endedAt, 'Session must record endedAt timestamp');

      // Verify in DB
      const dbSession = await PlatformSupportSession.findById(activeSupportSessionId);
      assert.ok(dbSession);
      assert.equal(dbSession.status, SupportSessionStatus.ENDED);
    });

    it('Step 2.5: Subsequent inspection with the same code -> HTTP 403 SUPPORT_SESSION_EXPIRED', async () => {
      const res = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/platform/tenants/${targetTenantId}/products`,
        cookie: ownerTokenCookie!,
        headers: {
          'x-support-session-code': activeSupportSessionCode,
        },
      });

      assert.equal(res.status, 403, 'Inspection with ended/expired code must return HTTP 403');
      assert.equal(res.data.code, 'SUPPORT_SESSION_EXPIRED');
      assert.match(res.data.error, /Support session has expired or is no longer active/i);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // JOURNEY 3: Tenant Feature Overrides & Emergency Commercial Bypass Lifecycle
  // ══════════════════════════════════════════════════════════════════════════════
  describe('Journey 3: Tenant Feature Overrides & Emergency Commercial Bypass Lifecycle', () => {
    let expiredTenantId: Types.ObjectId;

    before(async () => {
      expiredTenantId = new Types.ObjectId();

      await (Admin as any).create({
        _id: expiredTenantId,
        name: 'Expired Clinic Admin',
        email: 'expired.clinic@care.in',
        password: 'Password123!',
        firmName: 'LifeLine Hospital Meds',
        phone: '9811223344',
        isActive: true,
      });

      // Expired Subscription (ended 10 days ago, grace period ended 3 days ago)
      await (Subscription as any).create({
        tenantId: expiredTenantId,
        planId: new Types.ObjectId(),
        status: SubscriptionStatus.EXPIRED,
        billingCycle: 'MONTHLY',
        startedAt: new Date(Date.now() - 30 * 86400000),
        currentPricingSnapshot: {
          planName: 'Business Plan',
          planCode: PlanCode.BUSINESS,
          baseMonthlyPrice: 499,
          durationMonths: 1,
          finalAmount: 499,
          features: [Feature.INVOICE_CREATE, Feature.CUSTOMERS, Feature.PRODUCTS],
        },
        expiresAt: new Date(Date.now() - 10 * 86400000),
        graceUntil: new Date(Date.now() - 3 * 86400000),
      });
    });

    it('Step 3.1: Confirm expired tenant has canWrite === false initially', async () => {
      const initialFeatures = await resolveEffectiveFeatures(expiredTenantId);
      assert.equal(initialFeatures.canWrite, false, 'Expired tenant must not have write privileges initially');
      assert.equal(initialFeatures.emergencyBypass.active, false);

      const res = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/platform/feature-overrides/tenant/${expiredTenantId}`,
        cookie: ownerTokenCookie!,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.effectiveAccess.canWrite, false);
      assert.equal(res.data.data.effectiveAccess.emergencyBypass.active, false);
    });

    it('Step 3.2: Grant EMERGENCY_BYPASS with duration 24 hours -> verify canWrite === true', async () => {
      const res = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/feature-overrides/emergency-bypass',
        cookie: ownerTokenCookie!,
        body: {
          tenantId: expiredTenantId.toString(),
          reason: 'Emergency hospital pharmacy billing system critical bypass during server restore',
          durationHours: 24,
        },
      });

      assert.equal(res.status, 201, 'Granting emergency bypass must return 201 Created');
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.feature, EMERGENCY_BYPASS_FEATURE);
      assert.equal(res.data.data.isActive, true);

      // Verify that effective features now resolves canWrite = true
      const resolved = await resolveEffectiveFeatures(expiredTenantId);
      assert.equal(resolved.canWrite, true, 'canWrite must be restored via emergency bypass');
      assert.equal(resolved.emergencyBypass.active, true);
      assert.ok(resolved.emergencyBypass.expiresAt);

      // Verify via API query
      const checkRes = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/platform/feature-overrides/tenant/${expiredTenantId}`,
        cookie: ownerTokenCookie!,
      });
      assert.equal(checkRes.status, 200);
      assert.equal(checkRes.data.data.effectiveAccess.canWrite, true);
      assert.equal(checkRes.data.data.effectiveAccess.emergencyBypass.active, true);
    });

    it('Step 3.3: Attempt to grant emergency bypass for 100 hours -> rejected (exceeds 72h max ceiling)', async () => {
      const res = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/feature-overrides/emergency-bypass',
        cookie: ownerTokenCookie!,
        body: {
          tenantId: expiredTenantId.toString(),
          reason: 'Excessive duration attempt beyond statutory ceiling',
          durationHours: 100,
        },
      });

      assert.equal(res.status, 400, 'Exceeding 72 hours duration ceiling must return 400 Bad Request');
      assert.equal(res.data.success, false);
      assert.match(res.data.message, /Emergency bypass duration must be between 1 and 72 hours/i);
    });

    it('Step 3.4: Revoke emergency bypass -> verify canWrite === false', async () => {
      const res = await apiReq(baseUrl, {
        method: 'POST',
        path: '/api/platform/feature-overrides/emergency-bypass/revoke',
        cookie: ownerTokenCookie!,
        body: {
          tenantId: expiredTenantId.toString(),
          reason: 'Emergency commercial billing settlement finalized and invoices cleared',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.match(res.data.message, /Emergency commercial bypass revoked successfully/i);

      // Verify that effective features now locks write access again
      const resolved = await resolveEffectiveFeatures(expiredTenantId);
      assert.equal(resolved.canWrite, false, 'canWrite must be false after revocation');
      assert.equal(resolved.emergencyBypass.active, false);

      // Verify via API query
      const checkRes = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/platform/feature-overrides/tenant/${expiredTenantId}`,
        cookie: ownerTokenCookie!,
      });
      assert.equal(checkRes.status, 200);
      assert.equal(checkRes.data.data.effectiveAccess.canWrite, false);
      assert.equal(checkRes.data.data.effectiveAccess.emergencyBypass.active, false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // JOURNEY 4: Cryptographic Audit Ledger Verification Lifecycle
  // ══════════════════════════════════════════════════════════════════════════════
  describe('Journey 4: Cryptographic Audit Ledger Verification Lifecycle', () => {
    const AUDIT_TEST_SCOPE = 'audit-lifecycle-verification-scope';
    let operatorId: Types.ObjectId;

    before(async () => {
      const owner = await PlatformUser.findOne({ email: BOOTSTRAP_EMAIL });
      assert.ok(owner);
      operatorId = owner._id;

      // Clear any prior audit records in this specific test scope via collection driver
      await mongoose.connection.collection('platformauditlogs').deleteMany({ scope: AUDIT_TEST_SCOPE });
      await mongoose.connection.collection('platformauditheads').deleteOne({ scope: AUDIT_TEST_SCOPE });
    });

    it('Step 4.1: Perform 5 distinct administrative operations across different scopes', async () => {
      const operations = [
        {
          action: 'TENANT.ORGANIZATION_SUSPEND',
          targetType: 'Tenant',
          targetId: 'tenant-audit-001',
          severity: 'CRITICAL' as const,
          reason: 'System audit compliance suspension due to KYC mismatch',
        },
        {
          action: 'PLAN.PRICING_RULE_UPDATE',
          targetType: 'Plan',
          targetId: 'plan-starter-tier',
          severity: 'INFO' as const,
          reason: 'Adjusted quarterly promotional rate per annual business roadmap',
        },
        {
          action: 'OPERATOR.CUSTOM_PERMISSIONS_GRANT',
          targetType: 'PlatformUser',
          targetId: operatorId.toString(),
          severity: 'WARNING' as const,
          reason: 'Granted temporary escalated support permissions for incident response',
        },
        {
          action: 'COMMERCIAL.EMERGENCY_BYPASS_AUTHORIZED',
          targetType: 'TenantFeatureOverride',
          targetId: 'override-bypass-001',
          severity: 'CRITICAL' as const,
          reason: 'Authorized 24h operational grace for disaster recovery drill',
        },
        {
          action: 'COMMERCIAL.EMERGENCY_BYPASS_TERMINATED',
          targetType: 'TenantFeatureOverride',
          targetId: 'override-bypass-001',
          severity: 'INFO' as const,
          reason: 'Normal transaction flow resumed following system drill',
        },
      ];

      for (const op of operations) {
        await logPlatformAudit({
          scope: AUDIT_TEST_SCOPE,
          action: op.action,
          actorId: operatorId,
          actorEmail: BOOTSTRAP_EMAIL,
          actorRole: PlatformRole.PLATFORM_OWNER,
          targetType: op.targetType,
          targetId: op.targetId,
          severity: op.severity,
          reason: op.reason,
          after: { opTimestamp: new Date().toISOString() },
        });
      }
    });

    it('Step 4.2: Verify strictly monotonic sequence numbers (1..5) and hash continuity', async () => {
      const logs = await PlatformAuditLog.find({ scope: AUDIT_TEST_SCOPE })
        .sort({ sequence: 1 })
        .lean();

      assert.equal(logs.length, 5, 'Exactly 5 audit entries must be written');

      // Verify strictly monotonic sequence numbers: 1, 2, 3, 4, 5
      for (let i = 0; i < logs.length; i++) {
        const expectedSeq = i + 1;
        assert.equal(
          logs[i]!.sequence,
          expectedSeq,
          `Log index ${i} must have monotonic sequence = ${expectedSeq}`
        );
      }

      // Verify Record 1 links to AUDIT_GENESIS_HASH
      assert.equal(
        logs[0]!.previousHash,
        AUDIT_GENESIS_HASH,
        'First audit entry previousHash must strictly equal AUDIT_GENESIS_HASH'
      );

      // Verify previousHash of record N strictly matches hash of record N - 1
      for (let i = 1; i < logs.length; i++) {
        const currentRecord = logs[i]!;
        const previousRecord = logs[i - 1]!;

        assert.equal(
          currentRecord.previousHash,
          previousRecord.hash,
          `Record sequence ${currentRecord.sequence} previousHash must match Record sequence ${previousRecord.sequence} hash`
        );
      }
    });

    it('Step 4.3: Execute audit chain verification query GET /api/platform/audit/verify-chain -> 100% integrity', async () => {
      const res = await apiReq(baseUrl, {
        method: 'GET',
        path: `/api/platform/audit/verify-chain?scope=${AUDIT_TEST_SCOPE}`,
        cookie: ownerTokenCookie!,
      });

      assert.equal(res.status, 200, 'Audit chain verification endpoint must return HTTP 200');
      assert.equal(res.data.success, true);
      assert.ok(res.data.verification, 'Must return verification payload');

      const { verification } = res.data;
      assert.equal(verification.valid, true, 'Cryptographic audit chain must be 100% valid');
      assert.equal(verification.scope, AUDIT_TEST_SCOPE);
      assert.equal(verification.verifiedCount, 5, 'Chain verification must validate all 5 sequential records');
      assert.equal(verification.startSequence, 1);
      assert.equal(verification.endSequence, 5);
    });
  });
});
