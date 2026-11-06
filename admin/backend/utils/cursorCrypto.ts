/**
 * Bharat Enterprise Billing System — Keyset Pagination Cryptographic Cursor
 * HMAC-SHA256 signed cursor serialization, context binding, and anti-forgery validation.
 */

import crypto from 'crypto';
import { canonicalJsonStringify, computeCanonicalSha256 } from './canonicalJson';
import type { IKeysetCursor } from '../types';

/**
 * Computes an 8-character deterministic filter signature prefix.
 */
export function computeFilterSignature(filters: Record<string, unknown>): string {
  const hash = computeCanonicalSha256(filters);
  return hash.slice(0, 8);
}

/**
 * Encodes and cryptographically signs a keyset cursor.
 */
export function encodeKeysetCursor(
  payload: IKeysetCursor,
  secret: string = process.env.PLATFORM_JWT_SECRET || 'dev_fallback_cursor_secret',
): string {
  const canonicalPayload = canonicalJsonStringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(canonicalPayload, 'utf8'))
    .digest('base64url');

  const container = {
    p: payload,
    s: signature,
  };

  return Buffer.from(JSON.stringify(container), 'utf8').toString('base64url');
}

export interface CursorValidationOptions {
  secret?: string;
  expectedTenantScope?: string | null;
  expectedSortField?: string;
  expectedSortDirection?: 'asc' | 'desc';
  currentFilterSig?: string;
}

/**
 * Decodes, authenticates, and validates a keyset cursor token.
 * Throws explicit descriptive errors on tamper, forgery, or filter/sort mismatch.
 */
export function decodeAndVerifyKeysetCursor(
  cursorToken: string,
  options: CursorValidationOptions = {},
): IKeysetCursor {
  const secret = options.secret || process.env.PLATFORM_JWT_SECRET || 'dev_fallback_cursor_secret';

  let rawJson: string;
  try {
    rawJson = Buffer.from(cursorToken, 'base64url').toString('utf8');
  } catch {
    throw new Error('Malformed pagination cursor: invalid base64url encoding.');
  }

  let container: { p?: IKeysetCursor; s?: string };
  try {
    container = JSON.parse(rawJson);
  } catch {
    throw new Error('Malformed pagination cursor: payload is not valid JSON.');
  }

  if (!container || !container.p || typeof container.s !== 'string') {
    throw new Error('Malformed pagination cursor structure.');
  }

  const payload = container.p;

  // 1. Verify cryptographic HMAC signature
  const canonicalPayload = canonicalJsonStringify(payload);
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(canonicalPayload, 'utf8'))
    .digest('base64url');

  const sigBuffer = Buffer.from(container.s);
  const expectedBuffer = Buffer.from(expectedSig);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error('Forged or corrupted pagination cursor: signature validation failed.');
  }

  // 2. Validate payload structure, entity ID and timestamp formats
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.val === 'undefined' ||
    typeof payload.id !== 'string'
  ) {
    throw new Error('Malformed pagination cursor: invalid payload schema.');
  }

  if (!/^[0-9a-fA-F]{24}$/.test(payload.id)) {
    throw new Error('Malformed pagination cursor: invalid entity ID format in cursor.');
  }

  if (
    payload.sortField === 'createdAt' ||
    payload.sortField === 'paidAt' ||
    payload.sortField === 'invoiceDate'
  ) {
    if (typeof payload.val === 'string') {
      const timestamp = new Date(payload.val).getTime();
      if (isNaN(timestamp)) {
        throw new Error('Malformed pagination cursor: invalid timestamp value in cursor.');
      }
    }
  }

  // 3. Validate sort field & direction alignment
  if (options.expectedSortField && payload.sortField !== options.expectedSortField) {
    throw new Error(
      `Cursor sort field mismatch. Expected "${options.expectedSortField}", got "${payload.sortField}". Reset cursor when changing sort order.`,
    );
  }

  if (options.expectedSortDirection && payload.sortDirection !== options.expectedSortDirection) {
    throw new Error(
      `Cursor sort direction mismatch. Expected "${options.expectedSortDirection}", got "${payload.sortDirection}". Reset cursor when changing sort direction.`,
    );
  }

  // 3. Validate tenant scope isolation
  if (
    options.expectedTenantScope !== undefined &&
    payload.tenantScope !== options.expectedTenantScope
  ) {
    throw new Error('Cross-tenant pagination cursor reuse is strictly prohibited.');
  }

  // 4. Validate filter context signature
  if (options.currentFilterSig && payload.filterSig !== options.currentFilterSig) {
    throw new Error(
      'Cursor filter context mismatch. Active filters have changed; pagination must reset to page 1.',
    );
  }

  return payload;
}

