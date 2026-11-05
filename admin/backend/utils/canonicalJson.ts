/**
 * Bharat Enterprise Billing System — Canonical JSON Serializer & Hasher
 * Strict, deterministic, recursive serialization for audit hash-chains and cursor signatures.
 */

import crypto from 'crypto';

/**
 * Recursively canonicalizes any JavaScript value to a deterministic JSON string.
 * - Sorts object keys lexicographically at every nested level.
 * - Formats Date instances as normalized ISO 8601 strings.
 * - Rejects non-finite numbers (NaN, Infinity) and cyclic structures.
 * - Ignores undefined, function, and symbol object values consistently.
 */
export function canonicalJsonStringify(val: unknown, seen = new WeakSet<object>()): string {
  if (val === null || typeof val !== 'object') {
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        throw new TypeError('Unsupported non-finite numeric value in canonical JSON serialization');
      }
      // Normalize -0 to 0
      return Object.is(val, -0) ? '0' : String(val);
    }
    return JSON.stringify(val);
  }

  // Handle Date
  if (val instanceof Date) {
    return JSON.stringify(val.toISOString());
  }

  // Cycle detection
  if (seen.has(val)) {
    throw new TypeError('Cyclic structure detected in canonical JSON serialization');
  }
  seen.add(val);

  try {
    // Handle Array
    if (Array.isArray(val)) {
      const elements = val.map((item) => {
        // In standard JSON, undefined in array becomes null
        if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
          return 'null';
        }
        return canonicalJsonStringify(item, seen);
      });
      return '[' + elements.join(',') + ']';
    }

    // Handle Object
    const obj = val as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const parts: string[] = [];

    for (const key of sortedKeys) {
      const v = obj[key];
      // Skip undefined, functions, symbols (standard JSON behavior)
      if (v !== undefined && typeof v !== 'function' && typeof v !== 'symbol') {
        parts.push(`${JSON.stringify(key)}:${canonicalJsonStringify(v, seen)}`);
      }
    }

    return '{' + parts.join(',') + '}';
  } finally {
    seen.delete(val);
  }
}

/**
 * Computes a SHA-256 hex digest over the canonical JSON representation of a payload.
 */
export function computeCanonicalSha256(val: unknown): string {
  const canonicalString = canonicalJsonStringify(val);
  return crypto.createHash('sha256').update(Buffer.from(canonicalString, 'utf8')).digest('hex');
}

