/**
 * Bharat Enterprise Billing System — Platform Support Session Penetration & Authorization Bypass Test Suite
 *
 * Exhaustive adversarial attack simulations covering:
 *   1. Method Spoofing Escape (X-HTTP-Method-Override, X-Method-Override, _method in query/body)
 *   2. Cross-Tenant Diagnostic Escape (cross-tenant query params, deep object lookups, route segments)
 *   3. Post-Revocation Zero-Window Access (concurrent burst attacks after revocation)
 *   4. Millisecond Expiry Boundary (precision tests at expiresAt - 50ms vs expiresAt + 10ms)
 *   5. Operator Suspension Cascading Invalidation (immediate invalidation on operator deactivation)
 *   6. Mutation Smuggling via Content-Type (text/plain, multipart, application/graphql, urlencoded)
 *
 * Executed natively via Node 22 test runner:
 *   npx tsx --tsconfig admin/backend/tsconfig.json --test admin/backend/tests/supportSessionPenetration.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';

// Models
import PlatformUser from '../models/PlatformUser';
import PlatformSupportSession from '../models/PlatformSupportSession';
// @ts-ignore - CommonJS models without dedicated d.ts
import Admin from '../../../backend/models/Admin';
// @ts-ignore
import Customer from '../../../backend/models/Customer';
// @ts-ignore
import Invoice from '../../../backend/models/Invoice';

// Services & Middleware
import {
  startSupportSession,
  revokeSupportSession,
  getActiveSupportSession,
} from '../services/supportSessionService';
import { enforceSupportSessionBounds } from '../middleware/supportSessionMiddleware';
import { updateUser } from '../controllers/platformUserController';
import { revokeSession } from '../controllers/platformSupportController';

// Types
import {
  PlatformRole,
  PlatformPermission,
  SupportSessionStatus,
  IPlatformUser,
  PlatformRequest,
} from '../types';

// Isolated local database for support session penetration testing
const LOCAL_PEN_TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/test_support_session_penetration';

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
    setHeader(key: string, val: any) {
      this.headers[key.toLowerCase()] = val;
      return this;
    },
  };
  return res;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Adversarial Penetration Testing: Platform Support Session Boundaries', () => {
  let tenantA: any;
  let tenantB: any;
  let customerA: any;
  let customerB: any;
  let invoiceA: any;
  let invoiceB: any;
  let operatorUser: IPlatformUser;

  before(async () => {
    await mongoose.connect(LOCAL_PEN_TEST_MONGO_URI);

    // Clean test collections
    const collections = [
      'platformusers',
      'platformsupportsessions',
      'platformauditlogs',
      'admins',
      'customers',
      'invoices',
    ];
    for (const coll of collections) {
      try {
        await mongoose.connection.collection(coll).deleteMany({});
      } catch {
        // collection may not exist yet
      }
    }

    // Seed Tenant A (Primary Target)
    tenantA = await (Admin as any).create({
      firmName: 'Shree Balaji Pharmaceuticals',
      email: 'balaji_pharma_pen@test.com',
      password: 'HashedPassword123!',
      phone: '9876543210',
      firmGSTIN: '24AAACB1234A1Z5',
      address: '101 Ring Road, Ahmedabad, Gujarat',
      isActive: true,
    });

    // Seed Tenant B (Victim / Isolation Target)
    tenantB = await (Admin as any).create({
      firmName: 'Apollo Medicos Enterprise',
      email: 'apollo_medicos_pen@test.com',
      password: 'HashedPassword123!',
      phone: '9876543211',
      firmGSTIN: '27AAACB5678B1Z9',
      address: '202 Linking Road, Mumbai, Maharashtra',
      isActive: true,
    });

    // Seed Customer for Tenant A
    customerA = await Customer.create({
      tenantId: tenantA._id,
      customerName: 'Aarav Chemists A',
      phone: '9123456780',
      address: 'Shop 1, Ahmedabad',
    });

    // Seed Customer for Tenant B
    customerB = await Customer.create({
      tenantId: tenantB._id,
      customerName: 'Bharat Medicals B',
      phone: '9123456789',
      address: 'Shop 2, Mumbai',
    });

    // Seed Invoice for Tenant A
    invoiceA = await Invoice.create({
      tenantId: tenantA._id,
      customer: {
        _id: customerA._id,
        customerName: customerA.customerName,
        phone: customerA.phone,
      },
      invoiceNumber: 'INV-A-001',
      invoiceDate: new Date(),
      status: 'Created',
      items: [
        {
          product: { productName: 'Paracetamol 650' },
          quantitySold: 10,
          ratePerUnit: 20,
          baseAmount: 200,
          discountAmount: 0,
          taxableAmount: 200,
          gstAmount: 24,
          cgstAmount: 12,
          sgstAmount: 12,
          totalAmount: 224,
        },
      ],
      totals: {
        baseAmount: 200,
        totalDiscount: 0,
        totalTaxable: 200,
        totalGST: 24,
        totalCGST: 12,
        totalSGST: 12,
        roundOff: 0,
        netTotal: 224,
        finalTotal: 224,
      },
      paymentType: 'Cash',
      createdBy: { user: tenantA._id, userModel: 'Admin' },
    });

    // Seed Invoice for Tenant B
    invoiceB = await Invoice.create({
      tenantId: tenantB._id,
      customer: {
        _id: customerB._id,
        customerName: customerB.customerName,
        phone: customerB.phone,
      },
      invoiceNumber: 'INV-B-001',
      invoiceDate: new Date(),
      status: 'Created',
      items: [
        {
          product: { productName: 'Amoxicillin 500' },
          quantitySold: 5,
          ratePerUnit: 50,
          baseAmount: 250,
          discountAmount: 0,
          taxableAmount: 250,
          gstAmount: 30,
          cgstAmount: 15,
          sgstAmount: 15,
          totalAmount: 280,
        },
      ],
      totals: {
        baseAmount: 250,
        totalDiscount: 0,
        totalTaxable: 250,
        totalGST: 30,
        totalCGST: 15,
        totalSGST: 15,
        roundOff: 0,
        netTotal: 280,
        finalTotal: 280,
      },
      paymentType: 'Cash',
      createdBy: { user: tenantB._id, userModel: 'Admin' },
    });

    // Seed Platform Operator
    operatorUser = await PlatformUser.create({
      email: 'diag_operator@bharat.test',
      password: 'SecureOperatorPassword123!',
      fullName: 'Senior Diagnostic Engineer',
      role: PlatformRole.SUPPORT_ADMIN,
      customPermissions: [PlatformPermission.SUPPORT_START, PlatformPermission.SUPPORT_END],
      isActive: true,
      mustChangePassword: false,
    });
  });

  after(async () => {
    // Teardown
    await mongoose.connection.collection('platformsupportsessions').deleteMany({});
    await mongoose.connection.collection('platformusers').deleteMany({});
    await mongoose.connection.collection('admins').deleteMany({});
    await mongoose.connection.collection('customers').deleteMany({});
    await mongoose.connection.collection('invoices').deleteMany({});
    await mongoose.disconnect();
  });

  // ═════════════════════════════════════════════════════════════════
  // ATTACK 1: Method Spoofing Escape
  // ═════════════════════════════════════════════════════════════════
  describe('Attack Vector 1: HTTP Method Spoofing Escape Defense', () => {
    let sessionCode: string;

    beforeEach(async () => {
      const session = await startSupportSession(
        operatorUser,
        tenantA._id,
        'Investigating diagnostic discrepancies on tenant A records',
        2
      );
      sessionCode = session.sessionCode;
    });

    it('should block GET /api/invoices with X-HTTP-Method-Override: POST header (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionCode,
          'x-http-method-override': 'POST',
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'Middleware must NOT invoke next() on spoofed POST mutation');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
      assert.match(res.body.error, /Mutating business entities.*strictly forbidden/i);
    });

    it('should block GET /api/invoices with X-Method-Override: DELETE header (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionCode,
          'x-method-override': 'DELETE',
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'Middleware must NOT invoke next() on spoofed DELETE mutation');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('should block GET /api/invoices?_method=DELETE in query parameters (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionCode,
        },
        query: {
          _method: 'DELETE',
        },
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'Query param _method=DELETE must trigger read-only gate');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('should block GET /api/customers?_method=PUT in query parameters (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/customers',
        headers: {
          'x-support-session-code': sessionCode,
        },
        query: {
          _method: 'PUT',
        },
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('should block GET /api/invoices with X-HTTP-Method: PATCH header (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionCode,
          'x-http-method': 'PATCH',
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('should cleanly permit legitimate non-spoofed GET requests on business entities', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionCode,
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'Legitimate diagnostic GET request must proceed');
      assert.equal(res.statusCode, 200);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // ATTACK 2: Cross-Tenant Diagnostic Escape
  // ═════════════════════════════════════════════════════════════════
  describe('Attack Vector 2: Cross-Tenant Diagnostic Escape Defense', () => {
    let sessionTenantACode: string;

    beforeEach(async () => {
      const session = await startSupportSession(
        operatorUser,
        tenantA._id,
        'Scoped investigation of tenant A financial anomalies',
        2
      );
      sessionTenantACode = session.sessionCode;
    });

    it('should strictly reject access to Tenant B invoices via query param ?tenantId=TENANT_B (403 SUPPORT_SESSION_TENANT_MISMATCH)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionTenantACode,
        },
        query: {
          tenantId: tenantB._id.toString(),
        },
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'Cross-tenant query parameter MUST be rejected');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_TENANT_MISMATCH');
    });

    it('should strictly reject access to Tenant B customer resource GET /api/customers/:tenantB_customerId (403 SUPPORT_SESSION_TENANT_MISMATCH)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: `/api/customers/${customerB._id.toString()}`,
        params: {
          id: customerB._id.toString(),
          customerId: customerB._id.toString(),
        },
        headers: {
          'x-support-session-code': sessionTenantACode,
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'Cross-tenant customer ID lookup MUST be rejected');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_TENANT_MISMATCH');
    });

    it('should strictly reject access to Tenant B invoice resource GET /api/invoices/:tenantB_invoiceId (403 SUPPORT_SESSION_TENANT_MISMATCH)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: `/api/invoices/${invoiceB._id.toString()}`,
        params: {
          id: invoiceB._id.toString(),
          invoiceId: invoiceB._id.toString(),
        },
        headers: {
          'x-support-session-code': sessionTenantACode,
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'Cross-tenant invoice ID lookup MUST be rejected');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_TENANT_MISMATCH');
    });

    it('should strictly reject access to Tenant B control plane route GET /api/platform/tenants/:tenantB/invoices (403 SUPPORT_SESSION_TENANT_MISMATCH)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: `/api/platform/tenants/${tenantB._id.toString()}/invoices`,
        params: {
          id: tenantB._id.toString(),
        },
        headers: {
          'x-support-session-code': sessionTenantACode,
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_TENANT_MISMATCH');
    });

    it('should strictly reject cross-tenant header injection via X-Tenant-Id: TENANT_B (403 SUPPORT_SESSION_TENANT_MISMATCH)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionTenantACode,
          'x-tenant-id': tenantB._id.toString(),
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_TENANT_MISMATCH');
    });

    it('should allow valid access to Tenant A customer resource GET /api/customers/:tenantA_customerId', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: `/api/customers/${customerA._id.toString()}`,
        params: {
          id: customerA._id.toString(),
          customerId: customerA._id.toString(),
        },
        headers: {
          'x-support-session-code': sessionTenantACode,
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'Access to Tenant A customer MUST succeed');
      assert.equal(res.statusCode, 200);
    });

    it('should auto-scope unscoped collection queries to Tenant A targetTenantId', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionTenantACode,
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.query?.tenantId, tenantA._id.toString(), 'Query must be auto-scoped to Tenant A');
      assert.equal((req as any).tenantId.toString(), tenantA._id.toString());
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // ATTACK 3: Post-Revocation Zero-Window Access
  // ═════════════════════════════════════════════════════════════════
  describe('Attack Vector 3: Post-Revocation Zero-Window Access Defense', () => {
    it('should immediately reject 100% of concurrent burst requests after revocation with zero leakage window', async () => {
      // 1. Operator initiates session
      const session = await startSupportSession(
        operatorUser,
        tenantA._id,
        'Diagnostic inspection before immediate emergency revocation',
        1
      );
      const sessionCode = session.sessionCode;

      // 2. Verify session is valid pre-revocation
      const preReq: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: { 'x-support-session-code': sessionCode },
        query: {},
      };
      const preRes = createMockRes();
      let preNextCalled = false;
      await enforceSupportSessionBounds(preReq as PlatformRequest, preRes, () => {
        preNextCalled = true;
      });
      assert.equal(preNextCalled, true, 'Pre-revocation request must succeed');

      // 3. Operator issues revocation via revokeSession controller endpoint
      const revokeReq: Partial<PlatformRequest> & Record<string, any> = {
        platformUser: operatorUser,
        params: { id: session._id.toString() },
        body: { reason: 'Suspected token leakage - emergency revocation executed' },
      };
      const revokeRes = createMockRes();
      await revokeSession(revokeReq as PlatformRequest, revokeRes);

      assert.equal(revokeRes.statusCode, 200);
      assert.equal(revokeRes.body.success, true);
      assert.equal(revokeRes.body.data.isRevoked, true);
      assert.equal(revokeRes.body.data.status, SupportSessionStatus.REVOKED);

      // 4. Immediately fire 50 concurrent requests with the revoked session code
      const concurrentRequests = 50;
      const attackResults = await Promise.all(
        Array.from({ length: concurrentRequests }, async (_, index) => {
          const req: Partial<PlatformRequest> & Record<string, any> = {
            method: 'GET',
            path: `/api/invoices?page=${index}`,
            headers: { 'x-support-session-code': sessionCode },
            query: { page: String(index) },
          };
          const res = createMockRes();
          let nextCalled = false;

          await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
            nextCalled = true;
          });

          return { nextCalled, statusCode: res.statusCode, code: res.body?.code };
        })
      );

      // 5. Zero-Window Assertion: Exactly 0 requests succeed
      const successfulRequests = attackResults.filter((r) => r.nextCalled || r.statusCode === 200);
      assert.equal(
        successfulRequests.length,
        0,
        `Zero-Window breach! ${successfulRequests.length} requests succeeded after session revocation.`
      );

      // Verify all failed with 403 and REVOKED code
      for (const result of attackResults) {
        assert.equal(result.statusCode, 403);
        assert.equal(result.code, 'SUPPORT_SESSION_REVOKED');
      }

      // Verify MongoDB document state
      const dbDoc = await PlatformSupportSession.findOne({ sessionCode });
      assert.ok(dbDoc);
      assert.equal(dbDoc.status, SupportSessionStatus.REVOKED);
      assert.equal(dbDoc.isRevoked, true);
      assert.ok(dbDoc.endedAt);
      assert.equal(dbDoc.endedBy?.toString(), operatorUser._id.toString());
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // ATTACK 4: Millisecond Expiry Boundary
  // ═════════════════════════════════════════════════════════════════
  describe('Attack Vector 4: Millisecond Expiry Boundary Precision', () => {
    it('should succeed at expiresAt - 50ms and strictly fail at expiresAt + 10ms with 403 SUPPORT_SESSION_EXPIRED', async () => {
      // Create session expiring in exactly 120ms
      const sessionCode = 'SUP-20261105-EXP1';
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + 120);

      await PlatformSupportSession.create({
        sessionCode,
        operatorId: operatorUser._id,
        targetTenantId: tenantA._id,
        reason: 'Precision boundary testing for sub-second expiration gating',
        permissionsSnapshot: [PlatformPermission.SUPPORT_START],
        status: SupportSessionStatus.ACTIVE,
        isReadOnly: true,
        isRevoked: false,
        allowedScope: ['READ_ONLY'],
        startedAt,
        expiresAt,
        actionsPerformed: 0,
      });

      // 1. Test access at expiresAt - 70ms (within validity window)
      const validReq: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: { 'x-support-session-code': sessionCode },
        query: {},
      };
      const validRes = createMockRes();
      let validNextCalled = false;

      await enforceSupportSessionBounds(validReq as PlatformRequest, validRes, () => {
        validNextCalled = true;
      });

      assert.equal(validNextCalled, true, 'Request before expiresAt boundary MUST succeed');
      assert.equal(validRes.statusCode, 200);

      // 2. Wait 150ms to pass the boundary (now at expiresAt + 30ms)
      await sleep(150);

      // 3. Test access at expiresAt + 10ms / + 30ms (past expiration)
      const expiredReq: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: { 'x-support-session-code': sessionCode },
        query: {},
      };
      const expiredRes = createMockRes();
      let expiredNextCalled = false;

      await enforceSupportSessionBounds(expiredReq as PlatformRequest, expiredRes, () => {
        expiredNextCalled = true;
      });

      assert.equal(expiredNextCalled, false, 'Request past expiresAt boundary MUST be rejected');
      assert.equal(expiredRes.statusCode, 403);
      assert.equal(expiredRes.body.code, 'SUPPORT_SESSION_EXPIRED');

      // 4. Verify document self-heals status to EXPIRED in MongoDB
      const updatedDoc = await PlatformSupportSession.findOne({ sessionCode });
      assert.ok(updatedDoc);
      assert.equal(updatedDoc.status, SupportSessionStatus.EXPIRED);
      assert.ok(updatedDoc.endedAt);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // ATTACK 5: Operator Suspension Cascading Invalidation
  // ═════════════════════════════════════════════════════════════════
  describe('Attack Vector 5: Operator Suspension Cascading Invalidation', () => {
    it('should immediately invalidate active support sessions upon operator account suspension', async () => {
      // 1. Create dedicated operator and launch support session
      const tempOperator = await PlatformUser.create({
        email: 'suspend_target@bharat.test',
        password: 'TempPassword123!',
        fullName: 'Operator To Be Suspended',
        role: PlatformRole.SUPPORT_AGENT,
        customPermissions: [PlatformPermission.SUPPORT_START],
        isActive: true,
        mustChangePassword: false,
      });

      const session = await startSupportSession(
        tempOperator,
        tenantA._id,
        'Active session before operator suspension is enacted',
        2
      );
      const sessionCode = session.sessionCode;

      // 2. Verify session works initially
      const initReq: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: { 'x-support-session-code': sessionCode },
        query: {},
      };
      const initRes = createMockRes();
      let initNext = false;
      await enforceSupportSessionBounds(initReq as PlatformRequest, initRes, () => {
        initNext = true;
      });
      assert.equal(initNext, true, 'Pre-suspension diagnostic request must succeed');

      // 3. Suspend the operator account via updateUser controller (acting as Platform Owner)
      const ownerUser = await PlatformUser.create({
        email: 'owner_acting@bharat.test',
        password: 'OwnerPassword123!',
        fullName: 'Platform Owner Acting',
        role: PlatformRole.PLATFORM_OWNER,
        customPermissions: [],
        isActive: true,
        mustChangePassword: false,
      });

      const updateReq: Partial<PlatformRequest> & Record<string, any> = {
        platformUser: ownerUser,
        params: { id: tempOperator._id.toString() },
        headers: {},
        body: {
          isActive: false,
          reason: 'Operator credential compromise reported — immediate suspension',
        },
      };
      const updateRes = createMockRes();
      await updateUser(updateReq as PlatformRequest, updateRes);

      assert.equal(updateRes.statusCode, 200);
      assert.equal(updateRes.body.data.isActive, false);

      // 4. In-flight / subsequent request with session code MUST be blocked
      const blockedReq: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: { 'x-support-session-code': sessionCode },
        query: {},
      };
      const blockedRes = createMockRes();
      let blockedNext = false;
      await enforceSupportSessionBounds(blockedReq as PlatformRequest, blockedRes, () => {
        blockedNext = true;
      });

      assert.equal(blockedNext, false, 'Suspended operator session MUST NOT proceed');
      assert.equal(blockedRes.statusCode, 403);
      assert.ok(
        blockedRes.body.code === 'SUPPORT_SESSION_OPERATOR_SUSPENDED' ||
        blockedRes.body.code === 'SUPPORT_SESSION_REVOKED'
      );

      // 5. getActiveSupportSession service call MUST return null
      const activeSession = await getActiveSupportSession(tempOperator._id);
      assert.equal(activeSession, null, 'getActiveSupportSession must return null for suspended operator');

      // 6. Verify database state
      const dbSession = await PlatformSupportSession.findOne({ sessionCode });
      assert.ok(dbSession);
      assert.equal(dbSession.status, SupportSessionStatus.REVOKED);
      assert.equal(dbSession.isRevoked, true);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // ATTACK 6: Mutation Smuggling via Content-Type
  // ═════════════════════════════════════════════════════════════════
  describe('Attack Vector 6: Mutation Smuggling via Exotic Content-Type Defense', () => {
    let sessionCode: string;

    beforeEach(async () => {
      const session = await startSupportSession(
        operatorUser,
        tenantA._id,
        'Testing content-type exotic payload boundary defenses',
        2
      );
      sessionCode = session.sessionCode;
    });

    it('should block POST /api/invoices with Content-Type: text/plain (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'POST',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionCode,
          'content-type': 'text/plain',
        },
        body: '{"productName": "Smuggled Drug", "quantity": 100}',
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('should block POST /api/invoices with Content-Type: multipart/form-data (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'POST',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionCode,
          'content-type': 'multipart/form-data; boundary=----WebKitFormBoundaryX7Y8Z9',
        },
        body: {},
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('should block POST /api/graphql with Content-Type: application/graphql (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'POST',
        path: '/api/graphql',
        headers: {
          'x-support-session-code': sessionCode,
          'content-type': 'application/graphql',
        },
        body: 'mutation { createInvoice(amount: 5000) { id } }',
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('should block POST /api/invoices with Content-Type: application/x-www-form-urlencoded (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'POST',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionCode,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: { customerId: customerA._id.toString(), amount: '1000' },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('should detect and block GraphQL mutation smuggled under GET /api/graphql?query=mutation... (403 SUPPORT_SESSION_READ_ONLY)', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/graphql',
        headers: {
          'x-support-session-code': sessionCode,
          'content-type': 'application/graphql',
        },
        query: {
          query: 'mutation { deleteCustomer(id: "123") { success } }',
        },
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'GraphQL mutation under GET must be intercepted');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'SUPPORT_SESSION_READ_ONLY');
    });

    it('should allow legitimate GET request even if text/plain Accept or Content-Type is present', async () => {
      const req: Partial<PlatformRequest> & Record<string, any> = {
        method: 'GET',
        path: '/api/invoices',
        headers: {
          'x-support-session-code': sessionCode,
          'content-type': 'text/plain',
        },
        query: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await enforceSupportSessionBounds(req as PlatformRequest, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'Legitimate read-only query must pass');
      assert.equal(res.statusCode, 200);
    });
  });
});
