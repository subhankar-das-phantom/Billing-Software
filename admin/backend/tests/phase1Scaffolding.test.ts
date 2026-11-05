/**
 * Phase 1 Unit Tests: Canonical JSON, Keyset Cursor HMAC, and RBAC Engine
 * Executed natively via Node 22 test runner: npx tsx --test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJsonStringify, computeCanonicalSha256 } from '../utils/canonicalJson';
import {
  encodeKeysetCursor,
  decodeAndVerifyKeysetCursor,
  computeFilterSignature,
} from '../utils/cursorCrypto';
import {
  PlatformRole,
  PlatformPermission,
  hasPermission,
  canManageRole,
} from '../permissions';
import type { IKeysetCursor } from '../types';

describe('Phase 1 Scaffolding: Canonical JSON Serializer', () => {
  it('should recursively sort keys regardless of object key insertion order', () => {
    const objA = { z: 1, a: { d: 4, b: 2, c: { y: 9, x: 8 } } };
    const objB = { a: { b: 2, c: { x: 8, y: 9 }, d: 4 }, z: 1 };

    const canonicalA = canonicalJsonStringify(objA);
    const canonicalB = canonicalJsonStringify(objB);

    assert.equal(canonicalA, canonicalB);
    assert.equal(
      canonicalA,
      '{"a":{"b":2,"c":{"x":8,"y":9},"d":4},"z":1}',
    );
  });

  it('should consistently normalize Date instances to ISO 8601 strings', () => {
    const fixedDate = new Date('2026-11-04T00:00:00.000Z');
    const result = canonicalJsonStringify({ timestamp: fixedDate });

    assert.equal(result, '{"timestamp":"2026-11-04T00:00:00.000Z"}');
  });

  it('should reject non-finite numeric values (NaN, Infinity)', () => {
    assert.throws(() => canonicalJsonStringify({ val: NaN }), /Unsupported non-finite numeric value/);
    assert.throws(() => canonicalJsonStringify({ val: Infinity }), /Unsupported non-finite numeric value/);
  });

  it('should reject cyclic object references', () => {
    const cyclicObj: Record<string, unknown> = { name: 'test' };
    cyclicObj.self = cyclicObj;

    assert.throws(() => canonicalJsonStringify(cyclicObj), /Cyclic structure detected/);
  });

  it('should produce identical SHA-256 digests for structurally identical objects', () => {
    const hash1 = computeCanonicalSha256({ role: 'admin', active: true });
    const hash2 = computeCanonicalSha256({ active: true, role: 'admin' });

    assert.equal(hash1, hash2);
  });
});

describe('Phase 1 Scaffolding: Cryptographic Keyset Cursor', () => {
  const secret = 'test_super_secret_key_32_bytes_long_12345';
  const sampleCursor: IKeysetCursor = {
    sortField: 'createdAt',
    sortDirection: 'desc',
    val: 1730678400000,
    id: '65a1b2c3d4e5f67890123456',
    tenantScope: '65a1b2c3d4e5f67890123456',
    filterSig: 'a1b2c3d4',
  };

  it('should encode and decode a valid cursor token successfully', () => {
    const token = encodeKeysetCursor(sampleCursor, secret);
    const decoded = decodeAndVerifyKeysetCursor(token, {
      secret,
      expectedSortField: 'createdAt',
      expectedSortDirection: 'desc',
      expectedTenantScope: '65a1b2c3d4e5f67890123456',
      currentFilterSig: 'a1b2c3d4',
    });

    assert.deepEqual(decoded, sampleCursor);
  });

  it('should reject cursor if HMAC signature is tampered', () => {
    const validToken = encodeKeysetCursor(sampleCursor, secret);
    // Tamper the token by modifying characters
    const tamperedToken = validToken.slice(0, -4) + 'AAAA';

    assert.throws(
      () => decodeAndVerifyKeysetCursor(tamperedToken, { secret }),
      /signature validation failed|Malformed pagination cursor/,
    );
  });

  it('should reject cursor if filter signature context changes', () => {
    const token = encodeKeysetCursor(sampleCursor, secret);

    assert.throws(
      () =>
        decodeAndVerifyKeysetCursor(token, {
          secret,
          currentFilterSig: 'different_sig',
        }),
      /Cursor filter context mismatch/,
    );
  });

  it('should reject cursor if tenant scope is cross-reused', () => {
    const token = encodeKeysetCursor(sampleCursor, secret);

    assert.throws(
      () =>
        decodeAndVerifyKeysetCursor(token, {
          secret,
          expectedTenantScope: 'unrelated_tenant_999999999999',
        }),
      /Cross-tenant pagination cursor reuse is strictly prohibited/,
    );
  });

  it('should compute deterministic 8-character filter signatures', () => {
    const sig1 = computeFilterSignature({ status: 'active', search: 'pharma' });
    const sig2 = computeFilterSignature({ search: 'pharma', status: 'active' });

    assert.equal(sig1.length, 8);
    assert.equal(sig1, sig2);
  });
});

describe('Phase 1 Scaffolding: RBAC Engine & Privilege Ceiling', () => {
  it('should grant PLATFORM_OWNER all permissions by default', () => {
    for (const perm of Object.values(PlatformPermission)) {
      assert.equal(hasPermission(PlatformRole.PLATFORM_OWNER, [], perm), true);
    }
  });

  it('should enforce role boundaries on lower privileges', () => {
    assert.equal(
      hasPermission(PlatformRole.SUPPORT_AGENT, [], PlatformPermission.USERS_MANAGE),
      false,
    );
    assert.equal(
      hasPermission(PlatformRole.SUPPORT_AGENT, [], PlatformPermission.SUPPORT_START),
      true,
    );
    assert.equal(
      hasPermission(PlatformRole.TELESUPPORT, [], PlatformPermission.TENANT_DATA_VIEW),
      false,
    );
  });

  it('should respect customPermissions grants', () => {
    const custom = [PlatformPermission.AUDIT_VIEW];
    assert.equal(
      hasPermission(PlatformRole.SUPPORT_AGENT, custom, PlatformPermission.AUDIT_VIEW),
      true,
    );
  });

  it('should enforce strict privilege hierarchy (anti-privilege-escalation)', () => {
    // Owner can manage everyone
    assert.equal(canManageRole(PlatformRole.PLATFORM_OWNER, PlatformRole.PLATFORM_ADMIN), true);
    assert.equal(canManageRole(PlatformRole.PLATFORM_OWNER, PlatformRole.PLATFORM_OWNER), true);

    // Admin can manage Support Admin, Support Agent, Read Only
    assert.equal(canManageRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.SUPPORT_ADMIN), true);
    assert.equal(canManageRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.SUPPORT_AGENT), true);

    // Admin CANNOT manage Owner or other Admins (anti-horizontal escalation)
    assert.equal(canManageRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OWNER), false);
    assert.equal(canManageRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_ADMIN), false);

    // Support Agent cannot manage anyone
    assert.equal(canManageRole(PlatformRole.SUPPORT_AGENT, PlatformRole.TELESUPPORT), true);
    assert.equal(canManageRole(PlatformRole.SUPPORT_AGENT, PlatformRole.SUPPORT_ADMIN), false);
  });
});

