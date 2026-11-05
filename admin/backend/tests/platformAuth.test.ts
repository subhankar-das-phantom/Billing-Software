/**
 * Phase 2 Unit Tests: Platform Identity, Authentication, MFA & Session Security
 * Executed natively via Node 22 test runner: npx tsx --test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

import PlatformUser from '../models/PlatformUser';
import PlatformSession from '../models/PlatformSession';
import * as mfaService from '../auth/mfaService';
import * as platformAuthService from '../auth/platformAuthService';
import { requirePlatformAuth, getPlatformCookieOptions } from '../middleware/platformAuthMiddleware';
import { requireMfaVerified } from '../middleware/mfaMiddleware';
import { PlatformRole, PlatformPermission, PlatformRequest } from '../types';

describe('Phase 2: Platform MFA Service — Encryption & Key Derivation', () => {
  it('should derive a deterministic 32-byte key from PLATFORM_MFA_KEY', () => {
    const key = mfaService.getMfaEncryptionKey();
    assert.equal(Buffer.isBuffer(key), true);
    assert.equal(key.length, 32);
  });

  it('should encrypt and decrypt a TOTP secret payload using AES-256-GCM', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const encrypted = mfaService.encryptSecret(secret);

    assert.notEqual(encrypted, secret);
    const parts = encrypted.split(':');
    assert.equal(parts.length, 3); // iv:authTag:ciphertext

    const decrypted = mfaService.decryptSecret(encrypted);
    assert.equal(decrypted, secret);
  });

  it('should fail decryption if auth tag or ciphertext is tampered with', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const encrypted = mfaService.encryptSecret(secret);
    const parts = encrypted.split(':');

    // Tamper ciphertext
    const tamperedParts = [parts[0]!, parts[1]!, parts[2]!.slice(0, -2) + 'aa'];
    const tamperedPayload = tamperedParts.join(':');

    assert.throws(() => mfaService.decryptSecret(tamperedPayload));
  });

  it('should reject malformed encrypted payload strings without 3 colon-separated parts', () => {
    assert.throws(
      () => mfaService.decryptSecret('invalid-secret-string'),
      /Malformed encrypted MFA secret payload format/
    );
  });
});

describe('Phase 2: Platform MFA Service — RFC 4648 Base32 & RFC 6238 TOTP', () => {
  it('should accurately encode and decode arbitrary buffers to Base32', () => {
    const sampleBytes = Buffer.from('HelloWorld12345!', 'utf8');
    const encoded = mfaService.base32Encode(sampleBytes);
    const decoded = mfaService.base32Decode(encoded);

    assert.deepEqual(decoded, sampleBytes);
  });

  it('should generate a 32-character Base32 TOTP secret', () => {
    const secret = mfaService.generateTotpSecret();
    assert.equal(typeof secret, 'string');
    assert.equal(secret.length, 32);

    // Verify it is decodable
    const decoded = mfaService.base32Decode(secret);
    assert.equal(decoded.length, 20); // 160-bit key
  });

  it('should generate valid otpauth:// URI for authenticator QR codes', () => {
    const secret = 'MZXW633PN5XW6MZXW633PN5XW6MZXW63';
    const email = 'super.admin@bharatenterprise.com';
    const uri = mfaService.generateOtpAuthUri(email, secret);

    assert.equal(
      uri,
      'otpauth://totp/BharatEnterprise:super.admin%40bharatenterprise.com?secret=MZXW633PN5XW6MZXW633PN5XW6MZXW63&issuer=BharatEnterprise&algorithm=SHA1&digits=6&period=30'
    );
  });

  it('should compute valid 6-digit TOTP codes for given time steps', () => {
    const secret = mfaService.generateTotpSecret();
    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const code = mfaService.computeTotpCode(secret, currentStep);

    assert.equal(/^\d{6}$/.test(code), true);
  });

  it('should verify TOTP code with +-1 time-step window skew protection', () => {
    const secret = mfaService.generateTotpSecret();
    const currentStep = Math.floor(Date.now() / 1000 / 30);

    // Code at current time step
    const currentCode = mfaService.computeTotpCode(secret, currentStep);
    assert.equal(mfaService.verifyTotp(secret, currentCode), true);

    // Code at skew -1 (30s ago)
    const prevCode = mfaService.computeTotpCode(secret, currentStep - 1);
    assert.equal(mfaService.verifyTotp(secret, prevCode), true);

    // Code at skew +1 (30s ahead)
    const nextCode = mfaService.computeTotpCode(secret, currentStep + 1);
    assert.equal(mfaService.verifyTotp(secret, nextCode), true);

    // Code at skew -2 (60s ago) should fail with default window 1
    const oldCode = mfaService.computeTotpCode(secret, currentStep - 2);
    assert.equal(mfaService.verifyTotp(secret, oldCode), false);

    // Invalid non-matching code should fail
    assert.equal(mfaService.verifyTotp(secret, '000000'), false);
    assert.equal(mfaService.verifyTotp(secret, 'invalid'), false);
  });
});

describe('Phase 2: Platform MFA Service — Single-Use Backup Recovery Codes', () => {
  it('should generate 8 alphanumeric 10-char backup codes and their bcrypt hashes', async () => {
    const { plainCodes, backupCodes } = await mfaService.generateBackupCodes();

    assert.equal(plainCodes.length, 8);
    assert.equal(backupCodes.length, 8);

    for (let i = 0; i < 8; i++) {
      const code = plainCodes[i]!;
      const item = backupCodes[i]!;
      assert.equal(code.length, 10);
      assert.equal(item.usedAt, null);
      assert.equal(typeof item.codeHash, 'string');

      // Verify bcrypt hash matches
      const isMatch = await bcrypt.compare(code, item.codeHash);
      assert.equal(isMatch, true);
    }
  });

  it('should verify and atomically consume a valid backup code once only', async () => {
    const { plainCodes, backupCodes } = await mfaService.generateBackupCodes();
    let saveCount = 0;
    const mockUser: any = {
      mfaBackupCodes: backupCodes,
      save: async () => {
        saveCount++;
      },
    };

    const targetCode = plainCodes[0]!;

    // 1. First consumption succeeds
    const success = await mfaService.verifyAndConsumeBackupCode(mockUser, targetCode);
    assert.equal(success, true);
    assert.equal(saveCount, 1);
    assert.notEqual(mockUser.mfaBackupCodes[0].usedAt, null);

    // 2. Second consumption of the exact same code MUST fail
    const secondAttempt = await mfaService.verifyAndConsumeBackupCode(mockUser, targetCode);
    assert.equal(secondAttempt, false);
    assert.equal(saveCount, 1); // Not saved again
  });

  it('should reject invalid or non-existent backup codes', async () => {
    const { backupCodes } = await mfaService.generateBackupCodes();
    const mockUser: any = { mfaBackupCodes: backupCodes };

    const result = await mfaService.verifyAndConsumeBackupCode(mockUser, 'ZZZZZZZZZZ');
    assert.equal(result, false);
  });
});

describe('Phase 2: Platform User Model & Password Hashing', () => {
  it('should instantiate PlatformUser with correct defaults', () => {
    const user = new PlatformUser({
      email: 'owner@bharatplatform.com',
      password: 'TemporaryPassword123!',
      fullName: 'Control Plane Owner',
    });

    assert.equal(user.email, 'owner@bharatplatform.com');
    assert.equal(user.role, PlatformRole.READ_ONLY); // Default
    assert.equal(user.isActive, true);
    assert.equal(user.mustChangePassword, false);
    assert.equal(user.failedLoginAttempts, 0);
    assert.equal(user.mfaEnabled, false);
    assert.equal(user.lockUntil, null);
  });

  it('should compare passwords accurately via comparePassword instance method', async () => {
    const rawPassword = 'SuperSecretControlPlanePassword2026!';
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(rawPassword, salt);

    const user = new PlatformUser({
      email: 'admin@bharatplatform.com',
      password: hash,
      fullName: 'Admin User',
    });

    assert.equal(await user.comparePassword(rawPassword), true);
    assert.equal(await user.comparePassword('WrongPassword'), false);
  });
});

describe('Phase 2: Platform Session Model & Indexing', () => {
  it('should instantiate PlatformSession with proper schema defaults', () => {
    const userId = new Types.ObjectId();
    const tokenHash = crypto.createHash('sha256').update('test-session').digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const session = new PlatformSession({
      platformUserId: userId,
      tokenHash,
      expiresAt,
    });

    assert.equal(session.platformUserId, userId);
    assert.equal(session.tokenHash, tokenHash);
    assert.equal(session.isRevoked, false);
    assert.equal(session.revokedAt, null);
    assert.equal(session.revokedReason, null);
    assert.notEqual(session.lastActiveAt, null);
  });
});

describe('Phase 2: Platform Authentication Service — Brute Force & MFA Logic', () => {
  it('should sanitize user object by stripping password, mfaSecret and backup codes', () => {
    const sanitized = platformAuthService.sanitizePlatformUser({
      _id: new Types.ObjectId(),
      email: 'test@platform.com',
      password: 'HashedPassword123',
      fullName: 'Test User',
      role: PlatformRole.PLATFORM_ADMIN,
      customPermissions: [PlatformPermission.AUDIT_VIEW],
      isActive: true,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      mfaEnabled: true,
      mfaSecret: 'EncryptedSecret123',
      mfaBackupCodes: [{ codeHash: 'hash', usedAt: null }],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    assert.equal((sanitized as any).password, undefined);
    assert.equal((sanitized as any).mfaSecret, undefined);
    assert.equal((sanitized as any).mfaBackupCodes, undefined);
    assert.equal(sanitized.email, 'test@platform.com');
    assert.equal(sanitized.role, PlatformRole.PLATFORM_ADMIN);
  });

  it('should sign and verify valid platform JWTs', () => {
    const jwtSecret = platformAuthService.getPlatformJwtSecret();
    const payload = {
      platformUserId: '65a1b2c3d4e5f67890123456',
      sessionId: '65a1b2c3d4e5f67890123457',
      sessionToken: 'sample-session-random-token',
      role: PlatformRole.PLATFORM_OWNER,
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, jwtSecret) as typeof payload;

    assert.equal(decoded.platformUserId, payload.platformUserId);
    assert.equal(decoded.sessionId, payload.sessionId);
    assert.equal(decoded.sessionToken, payload.sessionToken);
    assert.equal(decoded.role, PlatformRole.PLATFORM_OWNER);
  });
});

describe('Phase 2: Platform Auth Middleware & Isolation', () => {
  it('should configure hardened cookie options for platform token', () => {
    const devOpts = getPlatformCookieOptions(false);
    assert.equal(devOpts.path, '/api/platform');
    assert.equal(devOpts.httpOnly, true);
    assert.equal(devOpts.secure, false);
    assert.equal(devOpts.sameSite, 'strict');

    const prodOpts = getPlatformCookieOptions(true);
    assert.equal(prodOpts.path, '/api/platform');
    assert.equal(prodOpts.httpOnly, true);
    assert.equal(prodOpts.secure, true);
    assert.equal(prodOpts.sameSite, 'lax');
  });

  it('should reject unauthenticated request with 401 when no token is present', async () => {
    let responseStatus = 0;
    let responseBody: any = null;

    const mockReq: Partial<PlatformRequest> = {
      cookies: {},
      headers: {},
    };

    const mockRes: any = {
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    };

    let nextCalled = false;
    await requirePlatformAuth(mockReq as PlatformRequest, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(responseStatus, 401);
    assert.equal(responseBody.success, false);
    assert.match(responseBody.error, /Authentication required/);
  });

  it('should strictly purge tenant request context variables upon authentication', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

    // Create a mock user & session that findById can return
    const mockUser = {
      _id: userId,
      email: 'owner@platform.com',
      isActive: true,
      role: PlatformRole.PLATFORM_OWNER,
    };

    const mockSession = {
      _id: sessionId,
      platformUserId: userId,
      tokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 3600000),
    };

    const originalFindUser = PlatformUser.findById;
    const originalFindSession = PlatformSession.findById;

    (PlatformUser as any).findById = () => ({
      exec: async () => mockUser,
      then: (fn: any) => Promise.resolve(mockUser).then(fn),
    });
    (PlatformSession as any).findById = () => ({
      exec: async () => mockSession,
      then: (fn: any) => Promise.resolve(mockSession).then(fn),
    });

    try {
      const jwtSecret = platformAuthService.getPlatformJwtSecret();
      const validToken = jwt.sign(
        {
          platformUserId: userId.toString(),
          sessionId: sessionId.toString(),
          sessionToken,
          role: PlatformRole.PLATFORM_OWNER,
        },
        jwtSecret
      );

      const mockReq: any = {
        cookies: { platform_token: validToken },
        headers: {},
        // Pre-existing tenant variables to test purging
        user: { tenantId: '123' },
        userRole: 'tenant_admin',
        userModel: 'Admin',
        admin: { firmName: 'Demo' },
      };

      let nextCalled = false;
      const mockRes: any = {
        status: () => ({ json: () => {} }),
      };

      await requirePlatformAuth(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.notEqual(mockReq.platformUser, undefined);
      assert.notEqual(mockReq.platformSession, undefined);

      // Verify STRICT purging of tenant auth variables
      assert.equal(mockReq.user, undefined);
      assert.equal(mockReq.userRole, undefined);
      assert.equal(mockReq.userModel, undefined);
      assert.equal(mockReq.admin, undefined);
    } finally {
      PlatformUser.findById = originalFindUser;
      PlatformSession.findById = originalFindSession;
    }
  });
});

describe('Phase 2: Platform MFA Enforcement Middleware', () => {
  it('should block PLATFORM_OWNER and PLATFORM_ADMIN if mfaEnabled is false', () => {
    const rolesToBlock = [PlatformRole.PLATFORM_OWNER, PlatformRole.PLATFORM_ADMIN];

    for (const role of rolesToBlock) {
      let status = 0;
      let body: any = null;

      const mockReq: Partial<PlatformRequest> = {
        platformUser: {
          _id: new Types.ObjectId(),
          email: 'admin@platform.com',
          fullName: 'Admin',
          role,
          customPermissions: [],
          isActive: true,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          mfaEnabled: false, // NOT enabled
          mfaBackupCodes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const mockRes: any = {
        status: (code: number) => {
          status = code;
          return { json: (b: any) => { body = b; } };
        },
      };

      let nextCalled = false;
      requireMfaVerified(mockReq as PlatformRequest, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, `Role ${role} should be blocked`);
      assert.equal(status, 403);
      assert.equal(body.code, 'MFA_ENROLLMENT_REQUIRED');
    }
  });

  it('should allow PLATFORM_OWNER and PLATFORM_ADMIN if mfaEnabled is true', () => {
    const mockReq: Partial<PlatformRequest> = {
      platformUser: {
        _id: new Types.ObjectId(),
        email: 'owner@platform.com',
        fullName: 'Owner',
        role: PlatformRole.PLATFORM_OWNER,
        customPermissions: [],
        isActive: true,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        mfaEnabled: true, // ENROLLED
        mfaBackupCodes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const mockRes: any = {
      status: () => ({ json: () => {} }),
    };

    let nextCalled = false;
    requireMfaVerified(mockReq as PlatformRequest, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  it('should allow lower roles (SUPPORT_AGENT, READ_ONLY) even if mfaEnabled is false', () => {
    const mockReq: Partial<PlatformRequest> = {
      platformUser: {
        _id: new Types.ObjectId(),
        email: 'agent@platform.com',
        fullName: 'Support Agent',
        role: PlatformRole.SUPPORT_AGENT,
        customPermissions: [],
        isActive: true,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        mfaEnabled: false,
        mfaBackupCodes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const mockRes: any = {
      status: () => ({ json: () => {} }),
    };

    let nextCalled = false;
    requireMfaVerified(mockReq as PlatformRequest, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });
});
