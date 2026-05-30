/**
 * Shared search utilities for MongoDB regex-based search.
 *
 * Centralises escapeRegex, prefix/contains/fuzzy pattern builders so
 * every controller uses the same (optimised) logic.
 */

// ── Regex escaping ──────────────────────────────────────────────────

/** Escape special regex characters so user input is treated literally. */
export const escapeRegex = (str: string = ''): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Pattern builders ────────────────────────────────────────────────

/** Anchored prefix match — e.g. `^mark` */
export const buildPrefixPattern = (search: string): string => {
  return `^${escapeRegex(search)}`;
};

/** Un-anchored contains match — e.g. `mark` */
export const buildContainsPattern = (search: string): string => {
  return escapeRegex(search);
};

/**
 * Build a search pattern that is either prefix-anchored or contains,
 * depending on the `usePrefix` flag.
 */
export const getSearchPattern = (search: string, usePrefix: boolean = false): string => {
  return usePrefix ? buildPrefixPattern(search) : buildContainsPattern(search);
};

/**
 * Build a bounded fuzzy regex pattern that allows up to `maxGap`
 * characters between each typed character.
 *
 * Old pattern (catastrophic backtracking):
 *   m.*a.*r.*k.*s          → O(n^k) on MongoDB regex engine
 *
 * New pattern (bounded, linear):
 *   m[^a]{0,5}a[^r]{0,5}r[^k]{0,5}k[^s]{0,5}s   → O(n)
 *
 * The negated character class `[^x]{0,N}` means:
 *   "match 0 to N characters that are NOT x, then match x"
 * This gives the regex engine a hard limit on how far to scan,
 * eliminating exponential backtracking.
 *
 * @param str    - Raw user input
 * @param maxGap - Max chars allowed between each typed char (default 5)
 */
export const buildFuzzyPattern = (str: string = '', maxGap: number = 5): string => {
  const normalized = str.trim().replace(/\s+/g, '');
  if (!normalized) return '';

  const limited = normalized.slice(0, 32);
  const chars = [...limited].map(ch => escapeRegex(ch));

  if (chars.length === 0) return '';
  if (chars.length === 1) return chars[0];

  // Build: first_char [^second]{0,N} second [^third]{0,N} third ...
  let pattern = chars[0];
  for (let i = 1; i < chars.length; i++) {
    pattern += `[^${chars[i]}]{0,${maxGap}}${chars[i]}`;
  }

  return pattern;
};

// ── CommonJS interop ────────────────────────────────────────────────
// Controllers that still use `require()` can import this module.
module.exports = {
  escapeRegex,
  buildPrefixPattern,
  buildContainsPattern,
  getSearchPattern,
  buildFuzzyPattern,
};
