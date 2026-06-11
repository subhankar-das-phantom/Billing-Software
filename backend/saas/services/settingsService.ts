/**
 * Settings Service — reads from SystemSetting collection.
 *
 * Caches values in-memory with configurable TTL to avoid
 * hitting MongoDB on every middleware call.
 */

import SystemSetting from '../models/SystemSetting';
import { SettingKeys } from '../shared/features';

// ─── In-Memory Cache ─────────────────────────────────────────────
interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getCached(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value;
  }
  cache.delete(key);
  return undefined;
}

function setCache(key: string, value: unknown): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Public API ──────────────────────────────────────────────────

export async function getSetting<T = unknown>(
  key: string,
  defaultValue: T,
): Promise<T> {
  // Check cache first
  const cached = getCached(key);
  if (cached !== undefined) return cached as T;

  // Query DB
  const doc = await SystemSetting.findOne({ key }).lean();
  const value = doc ? (doc.value as T) : defaultValue;

  // Cache it
  setCache(key, value);
  return value;
}

export async function setSetting(
  key: string,
  value: unknown,
  description?: string,
): Promise<void> {
  const update: Record<string, unknown> = { value };
  if (description !== undefined) {
    update.description = description;
  }
  await SystemSetting.findOneAndUpdate(
    { key },
    { $set: update },
    { upsert: true },
  );
  // Invalidate cache
  cache.delete(key);
}

// ─── Convenience Getters ─────────────────────────────────────────

export async function getDefaultTrialDays(): Promise<number> {
  return getSetting<number>(SettingKeys.DEFAULT_TRIAL_DAYS, 30);
}

export async function getDefaultGraceDays(): Promise<number> {
  return getSetting<number>(SettingKeys.DEFAULT_GRACE_DAYS, 7);
}

export async function getReferralMaxFreeDays(): Promise<number> {
  return getSetting<number>(SettingKeys.REFERRAL_MAX_FREE_DAYS, 365);
}

export async function getDefaultTrialPlan(): Promise<string> {
  return getSetting<string>(SettingKeys.DEFAULT_TRIAL_PLAN, 'professional');
}

// ─── Cache Management ────────────────────────────────────────────

export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const docs = await SystemSetting.find({}).lean();
  const result: Record<string, unknown> = {};
  for (const doc of docs) {
    result[doc.key] = doc.value;
  }
  return result;
}
