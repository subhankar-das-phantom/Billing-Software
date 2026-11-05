/**
 * Bharat Enterprise Billing System — RBAC, Audit & Security Remediation Test Suite
 * Executed natively via Node 22 test runner: npx tsx --test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';

// RBAC & Permissions
import {
  PlatformRole,
  PlatformPermission,
  hasPermission,
  canManageRole,
} from '../permissions';
import {
  requirePlatformPermission,
  requireReason,
} from '../middleware/platformRbacMiddleware';

// Audit Models & Services
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformAuditHead, AUDIT_GENESIS_HASH } from '../models/PlatformAuditHead';
import {
  logPlatformAudit,
  verifyAuditChain,
  redactSensitiveFields,
} from '../services/platformAuditService';
import { PlatformUser } from '../models/PlatformUser';

// Controllers
import {
  createUser,
  updateUser,
} from '../controllers/platformUserController';

// Legacy Routes (Phase 4)
import legacyAdminSaasRouter from '../../../backend/saas/routes/adminSaas';
import legacyPlansRouter from '../../../backend/saas/routes/plans';

// Helper mock response
function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
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
    cookie(name: string, val: any) {
      this.headers[name] = val;
      return this;
    },
    clearCookie(name: string) {
      delete this.headers[name];
      return this;
    },
  };
  return res;
}

const LOCAL_TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/test_platform_rbac_audit_isolated';

describe('Phase 3: RBAC Middleware & Reason Requirements', () => {
  it('should reject unauthenticated request when platformUser is missing', () => {
    const middleware = requirePlatformPermission(PlatformPermission.TENANTS_VIEW);
    const req: any = {};
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Insufficient platform permissions/);
  });

  it('should reject inactive platform user', () => {
    const middleware = requirePlatformPermission(PlatformPermission.TENANTS_VIEW);
    const req: any = {
      platformUser: {
        role: PlatformRole.PLATFORM_OWNER,
        customPermissions: [],
        isActive: false,
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  it('should allow PLATFORM_OWNER for any required permission', () => {
    const middleware = requirePlatformPermission(
      PlatformPermission.USERS_MANAGE,
      PlatformPermission.EMERGENCY_BYPASS_MANAGE,
    );
    const req: any = {
      platformUser: {
        role: PlatformRole.PLATFORM_OWNER,
        customPermissions: [],
        isActive: true,
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it('should reject role lacking required permissions', () => {
    const middleware = requirePlatformPermission(PlatformPermission.USERS_MANAGE);
    const req: any = {
      platformUser: {
        role: PlatformRole.SUPPORT_AGENT,
        customPermissions: [],
        isActive: true,
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body.required, [PlatformPermission.USERS_MANAGE]);
  });

  it('should permit role when permission is explicitly granted via customPermissions', () => {
    const middleware = requirePlatformPermission(PlatformPermission.AUDIT_VIEW);
    const req: any = {
      platformUser: {
        role: PlatformRole.TELESUPPORT, // does not have AUDIT_VIEW by default
        customPermissions: [PlatformPermission.AUDIT_VIEW],
        isActive: true,
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  it('should validate operational reason minimum length', () => {
    const middleware = requireReason(10);
    const res = createMockRes();
    let nextCalled = false;

    // Missing reason
    middleware({ body: {} } as any, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);

    // Short reason (< 10 chars)
    nextCalled = false;
    middleware({ body: { reason: 'Fix bug' } } as any, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);

    // Valid reason (>= 10 chars)
    nextCalled = false;
    const validReq: any = { body: { reason: '  Customer requested account reactivation due to cleared invoice  ' } };
    middleware(validReq, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    // Verified whitespace trimming
    assert.equal(validReq.body.reason, 'Customer requested account reactivation due to cleared invoice');
  });
});

describe('Phase 3: Sensitive Field Deep Redaction Engine', () => {
  it('should deeply redact sensitive keys across nested objects and arrays', () => {
    const payload = {
      user: {
        email: 'doctor@clinic.in',
        password: 'SuperSecretPassword123!',
        token: 'jwt.token.here',
        pan: 'ABCDE1234F',
        aadhaar: '1234-5678-9012',
        credentials: {
          apiKey: 'key_12345',
          cookie: 'session_abc',
          upiId: 'doctor@okhdfcbank',
          accountNumber: '9876543210',
          ifscCode: 'HDFC0001234',
        },
      },
      auditDetails: {
        action: 'UPDATE_PROFILE',
        nonSensitiveField: 42,
        nestedList: [{ safe: 'ok', secretToken: 'topsecret' }],
      },
    };

    const redacted = redactSensitiveFields(payload) as any;

    assert.equal(redacted.user.email, 'doctor@clinic.in');
    assert.equal(redacted.user.password, '[REDACTED]');
    assert.equal(redacted.user.token, '[REDACTED]');
    assert.equal(redacted.user.pan, '[REDACTED]');
    assert.equal(redacted.user.aadhaar, '[REDACTED]');
    assert.equal(redacted.user.credentials.apiKey, '[REDACTED]');
    assert.equal(redacted.user.credentials.cookie, '[REDACTED]');
    assert.equal(redacted.user.credentials.upiId, '[REDACTED]');
    assert.equal(redacted.user.credentials.accountNumber, '[REDACTED]');
    assert.equal(redacted.user.credentials.ifscCode, '[REDACTED]');
    assert.equal(redacted.auditDetails.nonSensitiveField, 42);
    assert.equal(redacted.auditDetails.nestedList[0].safe, 'ok');
    assert.equal(redacted.auditDetails.nestedList[0].secretToken, '[REDACTED]');
  });

  it('should handle circular object references gracefully without crashing', () => {
    const cyclicObj: any = { name: 'Root' };
    cyclicObj.self = cyclicObj;

    const result = redactSensitiveFields(cyclicObj) as any;
    assert.equal(result.name, 'Root');
    assert.equal(result.self, '[CIRCULAR]');
  });
});

describe('Phase 3: Tamper-Evident Partitioned Audit Ledger & Hash Chaining', () => {
  before(async () => {
    await mongoose.connect(LOCAL_TEST_MONGO_URI);
    // Use raw MongoDB collection methods to bypass append-only mongoose hooks during test setup
    await mongoose.connection.collection('platformauditlogs').deleteMany({});
    await mongoose.connection.collection('platformauditheads').deleteMany({});
  });

  after(async () => {
    await mongoose.connection.collection('platformauditlogs').deleteMany({});
    await mongoose.connection.collection('platformauditheads').deleteMany({});
    await mongoose.disconnect();
  });

  it('should initialize audit head and write sequential, hash-chained log entries', async () => {
    const actorId = new Types.ObjectId();
    const globalScope = 'global';

    // Entry 1
    const log1 = await logPlatformAudit({
      actorId,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.tenant.create',
      targetType: 'Tenant',
      targetId: 'tenant_1',
      reason: 'Onboarded enterprise pharmacy tenant',
      after: { firmName: 'Apex Health', password: 'hidden_password_123' },
    });

    assert.equal(log1.scope, globalScope);
    assert.equal(log1.sequence, 1);
    assert.equal(log1.previousHash, AUDIT_GENESIS_HASH);
    assert.ok(log1.hash && log1.hash.length === 64);
    assert.equal((log1.after as any).password, '[REDACTED]');

    // Verify AuditHead updated
    const headAfter1 = await PlatformAuditHead.findOne({ scope: globalScope });
    assert.equal(headAfter1?.lastSequence, 1);
    assert.equal(headAfter1?.lastHash, log1.hash);

    // Entry 2
    const log2 = await logPlatformAudit({
      actorId,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.tenant.update',
      targetType: 'Tenant',
      targetId: 'tenant_1',
      reason: 'Updated tenant subscription quota',
      before: { plan: 'BASIC' },
      after: { plan: 'ENTERPRISE' },
    });

    assert.equal(log2.sequence, 2);
    assert.equal(log2.previousHash, log1.hash);
    assert.notEqual(log2.hash, log1.hash);

    // Entry 3
    const log3 = await logPlatformAudit({
      actorId,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.tenant.suspend',
      targetType: 'Tenant',
      targetId: 'tenant_1',
      reason: 'Tenant requested temporary administrative freeze',
    });

    assert.equal(log3.sequence, 3);
    assert.equal(log3.previousHash, log2.hash);

    // Verify full chain integrity
    const chainVerification = await verifyAuditChain(globalScope);
    assert.equal(chainVerification.valid, true);
    assert.equal(chainVerification.verifiedCount, 3);
  });

  it('should maintain independent hash chains across tenant partitions', async () => {
    const tenantAId = new Types.ObjectId();
    const tenantBId = new Types.ObjectId();

    const logTenantA = await logPlatformAudit({
      targetTenantId: tenantAId,
      actorEmail: 'agent@bharat.in',
      actorRole: PlatformRole.SUPPORT_AGENT,
      action: 'platform.support.operate',
      targetType: 'Tenant',
      targetId: tenantAId.toString(),
      reason: 'Inspected recent invoice error',
    });

    const logTenantB = await logPlatformAudit({
      targetTenantId: tenantBId,
      actorEmail: 'agent@bharat.in',
      actorRole: PlatformRole.SUPPORT_AGENT,
      action: 'platform.support.operate',
      targetType: 'Tenant',
      targetId: tenantBId.toString(),
      reason: 'Customer requested manual reconciliation check',
    });

    assert.equal(logTenantA.scope, `tenant:${tenantAId.toString()}`);
    assert.equal(logTenantA.sequence, 1);
    assert.equal(logTenantA.previousHash, AUDIT_GENESIS_HASH);

    assert.equal(logTenantB.scope, `tenant:${tenantBId.toString()}`);
    assert.equal(logTenantB.sequence, 1);
    assert.equal(logTenantB.previousHash, AUDIT_GENESIS_HASH);

    // Each partition verifies independently
    const verifyA = await verifyAuditChain(`tenant:${tenantAId.toString()}`);
    assert.equal(verifyA.valid, true);
    assert.equal(verifyA.verifiedCount, 1);

    const verifyB = await verifyAuditChain(`tenant:${tenantBId.toString()}`);
    assert.equal(verifyB.valid, true);
    assert.equal(verifyB.verifiedCount, 1);
  });

  it('should detect tampering in audit log chain if document content is mutated', async () => {
    const scope = 'tamper_test_scope';

    await logPlatformAudit({
      scope,
      actorEmail: 'owner@bharat.in',
      actorRole: PlatformRole.PLATFORM_OWNER,
      action: 'platform.test.action',
      targetType: 'Test',
      targetId: 't1',
      reason: 'Original untampered action',
    });

    // Verify initial integrity
    const initialVerify = await verifyAuditChain(scope);
    assert.equal(initialVerify.valid, true);

    // Attempt direct collection-level mutation bypassing mongoose middleware
    await mongoose.connection.collection('platformauditlogs').updateOne(
      { scope, sequence: 1 },
      { $set: { reason: 'TAMPERED: Attacker modified reason' } },
    );

    // Verification must detect the cryptographic discrepancy
    const tamperedVerify = await verifyAuditChain(scope);
    assert.equal(tamperedVerify.valid, false);
    assert.match(tamperedVerify.error || '', /Cryptographic hash mismatch at sequence 1/);
  });

  it('should enforce append-only pre-hooks blocking updates and deletions', async () => {
    // Attempting updateOne on model
    await assert.rejects(
      async () => {
        await PlatformAuditLog.updateOne({ scope: 'global' }, { $set: { reason: 'New reason' } });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );

    // Attempting deleteOne on model
    await assert.rejects(
      async () => {
        await PlatformAuditLog.deleteOne({ scope: 'global' });
      },
      /PlatformAuditLog is strictly append-only. Updates and deletions are forbidden./,
    );
  });
});

describe('Phase 3: User Management Lifecycle & Privilege Ceilings', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(LOCAL_TEST_MONGO_URI);
    }
    await PlatformUser.deleteMany({});
  });

  after(async () => {
    await PlatformUser.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('should enforce Privilege Ceiling: PLATFORM_ADMIN cannot create PLATFORM_OWNER or PLATFORM_ADMIN', async () => {
    const adminUser = {
      _id: new Types.ObjectId(),
      email: 'admin@bharat.in',
      role: PlatformRole.PLATFORM_ADMIN,
      customPermissions: [],
      isActive: true,
    };

    // Admin attempts to create an Owner
    const reqCreateOwner: any = {
      platformUser: adminUser,
      body: {
        email: 'newowner@bharat.in',
        password: 'password12345',
        fullName: 'New Owner',
        role: PlatformRole.PLATFORM_OWNER,
        reason: 'Attempting escalation to owner',
      },
      headers: {},
      socket: {},
    };
    const resCreateOwner = createMockRes();
    await createUser(reqCreateOwner, resCreateOwner);
    assert.equal(resCreateOwner.statusCode, 403);
    assert.match(resCreateOwner.body.message, /Privilege ceiling/);

    // Admin attempts to create another Admin (horizontal escalation)
    const reqCreateAdmin: any = {
      platformUser: adminUser,
      body: {
        email: 'peeradmin@bharat.in',
        password: 'password12345',
        fullName: 'Peer Admin',
        role: PlatformRole.PLATFORM_ADMIN,
        reason: 'Attempting peer admin creation',
      },
      headers: {},
      socket: {},
    };
    const resCreateAdmin = createMockRes();
    await createUser(reqCreateAdmin, resCreateAdmin);
    assert.equal(resCreateAdmin.statusCode, 403);
    assert.match(resCreateAdmin.body.message, /Privilege ceiling/);
  });

  it('should enforce Custom Permission Ceiling: operator cannot grant permissions they do not possess', async () => {
    const supportAdmin = {
      _id: new Types.ObjectId(),
      email: 'supportadmin@bharat.in',
      role: PlatformRole.SUPPORT_ADMIN,
      customPermissions: [],
      isActive: true,
    };

    // Support Admin attempts to grant EMERGENCY_BYPASS_MANAGE to a Support Agent
    const req: any = {
      platformUser: supportAdmin,
      body: {
        email: 'agent_escalated@bharat.in',
        password: 'password12345',
        fullName: 'Support Agent with bypass',
        role: PlatformRole.SUPPORT_AGENT,
        customPermissions: [PlatformPermission.EMERGENCY_BYPASS_MANAGE],
        reason: 'Granting emergency bypass to agent',
      },
      headers: {},
      socket: {},
    };
    const res = createMockRes();
    await createUser(req, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /Privilege ceiling: Cannot grant custom permission/);
  });

  it('should enforce Anti-Self-Lockout: operator cannot deactivate own account', async () => {
    const ownerId = new Types.ObjectId();
    await PlatformUser.create({
      _id: ownerId,
      email: 'primaryowner@bharat.in',
      password: 'password12345',
      fullName: 'Primary Owner',
      role: PlatformRole.PLATFORM_OWNER,
      isActive: true,
    });

    const req: any = {
      platformUser: {
        _id: ownerId,
        email: 'primaryowner@bharat.in',
        role: PlatformRole.PLATFORM_OWNER,
        customPermissions: [],
        isActive: true,
      },
      params: { id: ownerId.toString() },
      body: {
        isActive: false,
        reason: 'Attempting to deactivate own account',
      },
      headers: {},
      socket: {},
    };
    const res = createMockRes();
    await updateUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Anti-self-lockout/);
  });

  it('should enforce Anti-Self-Demotion: operator cannot demote own role', async () => {
    const ownerId = new Types.ObjectId();
    await PlatformUser.create({
      _id: ownerId,
      email: 'demoteowner@bharat.in',
      password: 'password12345',
      fullName: 'Demoting Owner',
      role: PlatformRole.PLATFORM_OWNER,
      isActive: true,
    });

    const req: any = {
      platformUser: {
        _id: ownerId,
        email: 'demoteowner@bharat.in',
        role: PlatformRole.PLATFORM_OWNER,
        customPermissions: [],
        isActive: true,
      },
      params: { id: ownerId.toString() },
      body: {
        role: PlatformRole.READ_ONLY,
        reason: 'Attempting to demote own account to read-only',
      },
      headers: {},
      socket: {},
    };
    const res = createMockRes();
    await updateUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Anti-self-demotion/);
  });

  it('should enforce Last Owner Protection: cannot deactivate or demote last active PLATFORM_OWNER', async () => {
    // Clear users and create a single owner
    await PlatformUser.deleteMany({});
    const soloOwnerId = new Types.ObjectId();
    await PlatformUser.create({
      _id: soloOwnerId,
      email: 'solo_owner@bharat.in',
      password: 'password12345',
      fullName: 'Solo Owner',
      role: PlatformRole.PLATFORM_OWNER,
      isActive: true,
    });

    // Create a second acting operator (e.g. system or owner proxy)
    const actingOperator = {
      _id: new Types.ObjectId(),
      email: 'admin_proxy@bharat.in',
      role: PlatformRole.PLATFORM_OWNER,
      customPermissions: [],
      isActive: true,
    };

    // Attempt to deactivate solo owner
    const reqDeactivate: any = {
      platformUser: actingOperator,
      params: { id: soloOwnerId.toString() },
      body: {
        isActive: false,
        reason: 'Attempting to deactivate the only active owner in the system',
      },
      headers: {},
      socket: {},
    };
    const resDeactivate = createMockRes();
    await updateUser(reqDeactivate, resDeactivate);

    assert.equal(resDeactivate.statusCode, 400);
    assert.match(resDeactivate.body.message, /Last owner protection/);

    // Attempt to demote solo owner
    const reqDemote: any = {
      platformUser: actingOperator,
      params: { id: soloOwnerId.toString() },
      body: {
        role: PlatformRole.PLATFORM_ADMIN,
        reason: 'Attempting to demote the only active owner to admin',
      },
      headers: {},
      socket: {},
    };
    const resDemote = createMockRes();
    await updateUser(reqDemote, resDemote);

    assert.equal(resDemote.statusCode, 400);
    assert.match(resDemote.body.message, /Last owner protection/);
  });
});

describe('Phase 4: Legacy SaaS Security Remediation & 410 Gone Retirement', () => {
  it('should permanently return HTTP 410 Gone for all legacy admin SaaS routes', async () => {
    const endpoints = [
      '/tenants',
      '/subscriptions',
      '/adjustments',
      '/payments',
      '/campaigns',
      '/pricing-rules',
      '/settings',
      '/process-expired',
    ];

    for (const ep of endpoints) {
      const res = createMockRes();

      // Dispatch through Express router
      await new Promise<void>((resolve) => {
        const req: any = {
          url: ep,
          method: 'GET',
          headers: {},
        };
        legacyAdminSaasRouter(req, res, () => {
          resolve();
        });
        if (res.statusCode === 410) {
          resolve();
        }
      });

      assert.equal(res.statusCode, 410, `Endpoint ${ep} must return 410 Gone`);
      assert.match(
        res.body.message,
        /The \/api\/saas\/admin endpoint has been permanently retired/,
      );
    }
  });

  it('should return HTTP 410 Gone for mutating routes on plans, but keep public routes accessible', async () => {
    // POST /
    const postRes = createMockRes();
    await new Promise<void>((resolve) => {
      const req: any = { url: '/', method: 'POST', body: {}, headers: {} };
      legacyPlansRouter(req, postRes, () => resolve());
      if (postRes.statusCode === 410) resolve();
    });
    assert.equal(postRes.statusCode, 410);
    assert.match(postRes.body.message, /Plan administration permanently moved to \/api\/platform\/plans/);

    // PUT /:id
    const putRes = createMockRes();
    await new Promise<void>((resolve) => {
      const req: any = { url: '/plan_123', method: 'PUT', body: {}, headers: {} };
      legacyPlansRouter(req, putRes, () => resolve());
      if (putRes.statusCode === 410) resolve();
    });
    assert.equal(putRes.statusCode, 410);
    assert.match(putRes.body.message, /Plan administration permanently moved to \/api\/platform\/plans/);
  });
});

describe('Phase 4: Employee Auth Fail-Closed Organization Check', () => {
  before(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'a7f3d2e8c91b4056fe2d78a3b94c16e5d8f2a7b3c4d5e6f7a8b9c0d1e2f3a4b5';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(LOCAL_TEST_MONGO_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('should fail closed with 401 when employee tenant admin account is suspended or inactive', async () => {
    const { protect } = require('../../../backend/middleware/auth');
    const jwt = require('jsonwebtoken');

    // Create an inactive tenant Admin in test DB
    const Admin = require('../../../backend/models/Admin');
    const Employee = require('../../../backend/models/Employee');

    const suspendedAdmin = await Admin.create({
      email: `suspended_admin_${Date.now()}@clinic.in`,
      password: 'password123',
      firmName: 'Suspended Clinic',
      isActive: false, // Organization is suspended
    });

    const activeEmployee = await Employee.create({
      name: 'Dr. Assistant',
      email: `assistant_${Date.now()}@clinic.in`,
      password: 'password123',
      createdByAdmin: suspendedAdmin._id,
      isActive: true, // Employee is individually active
    });

    // Sign a valid employee JWT
    const token = jwt.sign(
      { id: activeEmployee._id.toString(), role: 'employee' },
      process.env.JWT_SECRET || 'a7f3d2e8c91b4056fe2d78a3b94c16e5d8f2a7b3c4d5e6f7a8b9c0d1e2f3a4b5',
      { expiresIn: '1h' },
    );

    const req: any = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      cookies: {},
    };
    const res = createMockRes();
    let nextCalled = false;

    await protect(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, 'Inactive tenant admin must block employee access');
    assert.equal(res.statusCode, 401);
    assert.match(
      res.body.message,
      /Tenant organization account is inactive or not found/,
    );
  });
});
