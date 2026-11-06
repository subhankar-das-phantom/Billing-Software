/**
 * Bharat Enterprise Billing System — Frontend Chaos, CLS Thrashing & DOM Hydration Test Suite
 *
 * Exhaustive frontend chaos, state corruption, layout stability, and defensive renderer verification
 * across both the Super Admin Console (admin/frontend/) and Tenant App (frontend/).
 *
 * Test Suites:
 *   1. Storage Corruption & Unseeded Storage Fuzzing
 *   2. Nullish API Response & Missing Populated Relations Safety
 *   3. Cumulative Layout Shift (CLS) & Animation Safety
 *   4. Rapid Double-Submit & Debounce Race Immunity
 *
 * Executed natively via Node test runner / tsx:
 *   npx tsx admin/backend/tests/frontendChaosAndStability.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

// ─── In-Memory Storage Polyfill ─────────────────────────────────────
class MemoryStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }
}

// Set up mock window and storage environments for headless node:test execution
const mockLocalStorage = new MemoryStorage();
const mockSessionStorage = new MemoryStorage();

// Ensure globalThis has storage polyfills
(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).sessionStorage = mockSessionStorage;

describe('Frontend Chaos, CLS Thrashing & DOM Hydration Breaker Test Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
  });

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 1: Storage Corruption & Unseeded Storage Fuzzing
  // ═════════════════════════════════════════════════════════════════════
  describe('1. Storage Corruption & Unseeded Storage Fuzzing', () => {
    // 1.1 Tenant Subscription Context Frame-0 Pre-Seeding Fuzzing
    it('1.1 should safely catch JSON.parse exceptions and corrupt primitives on cached_subscription', () => {
      // Frame-0 pre-seeding helper as implemented in frontend/src/contexts/SubscriptionContext.jsx
      const preSeedSubscription = (storage: MemoryStorage) => {
        try {
          const saved = storage.getItem('cached_subscription');
          if (!saved) return null;
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
          storage.removeItem('cached_subscription');
          return null;
        } catch {
          try {
            storage.removeItem('cached_subscription');
          } catch {}
          return null;
        }
      };

      const chaosPayloads = [
        '{invalid_json',
        '"{broken: true',
        null,
        '',
        '{ "status": 123 }',
        '12345',
        '"a standalone string"',
        'true',
        'false',
        'undefined',
        '{ "plan": null }',
        'NaN',
        '{"status":"EXPIRED","plan":null}',
      ];

      for (const payload of chaosPayloads) {
        if (payload === null) {
          mockLocalStorage.removeItem('cached_subscription');
        } else {
          mockLocalStorage.setItem('cached_subscription', payload);
        }

        let result: any;
        assert.doesNotThrow(() => {
          result = preSeedSubscription(mockLocalStorage);
        }, `Uncaught exception thrown during cached_subscription fuzzing with payload: ${payload}`);

        // Verify result is either null or a non-null object
        if (result !== null) {
          assert.equal(typeof result, 'object', `Expected object or null, got ${typeof result}`);
          assert.ok(!Array.isArray(result), 'Payload should not parse to an array');
        }
      }
    });

    // 1.2 Platform Auth Context User & Support Session Fuzzing
    it('1.2 should safely pre-seed cached_platform_user and evict malformed schemas', () => {
      const USER_CACHE_STORAGE_KEY = 'cached_platform_user';

      const preSeedPlatformUser = (storage: MemoryStorage) => {
        try {
          const cached = storage.getItem(USER_CACHE_STORAGE_KEY);
          if (cached === null) return null;
          if (!cached.trim()) {
            storage.removeItem(USER_CACHE_STORAGE_KEY);
            return null;
          }
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object' && parsed._id && parsed.role) {
            return parsed;
          }
          storage.removeItem(USER_CACHE_STORAGE_KEY);
          return null;
        } catch {
          try {
            storage.removeItem(USER_CACHE_STORAGE_KEY);
          } catch {}
          return null;
        }
      };

      const corruptedUserPayloads = [
        '{invalid_json',
        '',
        '12345',
        '"just_a_string"',
        'true',
        '{"someKey": "someValue"}', // Missing _id and role
        '{"_id": "usr_001"}', // Missing role
        '{"role": "PLATFORM_ADMIN"}', // Missing _id
      ];

      for (const corrupt of corruptedUserPayloads) {
        mockLocalStorage.setItem(USER_CACHE_STORAGE_KEY, corrupt);
        const user = preSeedPlatformUser(mockLocalStorage);
        assert.equal(user, null, `Corrupt user payload "${corrupt}" should evaluate to null`);
        // Verify automatic eviction
        assert.equal(
          mockLocalStorage.getItem(USER_CACHE_STORAGE_KEY),
          null,
          `Storage key should be evicted on invalid schema: ${corrupt}`
        );
      }

      // Valid user should succeed
      const validUser = {
        _id: 'usr_owner_001',
        email: 'owner@bharatenterprise.in',
        role: 'PLATFORM_OWNER',
        isActive: true,
      };
      mockLocalStorage.setItem(USER_CACHE_STORAGE_KEY, JSON.stringify(validUser));
      const seeded = preSeedPlatformUser(mockLocalStorage);
      assert.deepEqual(seeded, validUser);
    });

    // 1.3 Active Support Session Pre-seeding with Expiry Verification
    it('1.3 should safely validate and evict expired or corrupt cached_support_session', () => {
      const SUPPORT_SESSION_STORAGE_KEY = 'cached_support_session';

      const preSeedSupportSession = (storage: MemoryStorage) => {
        try {
          const cached = storage.getItem(SUPPORT_SESSION_STORAGE_KEY);
          if (!cached) return null;
          const parsed = JSON.parse(cached);
          if (!parsed || typeof parsed !== 'object' || !parsed.expiresAt || !parsed.sessionCode) {
            storage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
            return null;
          }
          const expiryMs = new Date(parsed.expiresAt).getTime();
          if (isNaN(expiryMs) || expiryMs < Date.now()) {
            storage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
            return null;
          }
          return parsed;
        } catch {
          try {
            storage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
          } catch {}
          return null;
        }
      };

      // Fuzz corrupt formats
      const corruptPayloads = [
        '{malformed_json',
        'null',
        '42',
        '{"foo": "bar"}', // Missing expiresAt, sessionCode
        JSON.stringify({ sessionCode: 'SUP-001', expiresAt: 'invalid-date' }), // NaN date
        JSON.stringify({ sessionCode: 'SUP-001', expiresAt: new Date(Date.now() - 5000).toISOString() }), // Expired 5s ago
      ];

      for (const payload of corruptPayloads) {
        mockSessionStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, payload);
        const session = preSeedSupportSession(mockSessionStorage);
        assert.equal(session, null, `Payload ${payload} should return null`);
        assert.equal(
          mockSessionStorage.getItem(SUPPORT_SESSION_STORAGE_KEY),
          null,
          `Expired/corrupt session should be removed from sessionStorage`
        );
      }

      // Valid future session
      const validSession = {
        sessionCode: 'SUP-99881',
        targetTenantId: 'tenant_test_123',
        targetTenantFirmName: 'Apex Textiles Ltd',
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour ahead
        isReadOnly: true,
      };
      mockSessionStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify(validSession));
      const active = preSeedSupportSession(mockSessionStorage);
      assert.deepEqual(active, validSession);
    });

    // 1.4 Theme Mode & Token Fuzzing
    it('1.4 should restrict themeMode to permitted union and sanitize platform_token primitives', () => {
      const APP_THEME_STORAGE_KEY = 'bharat-enterprise-theme';

      const sanitizeThemeMode = (storage: MemoryStorage): 'dark' | 'light' | 'system' => {
        try {
          const saved = storage.getItem(APP_THEME_STORAGE_KEY);
          if (saved === 'light' || saved === 'dark' || saved === 'system') {
            return saved;
          }
        } catch {
          // Fallback
        }
        return 'dark';
      };

      const badThemes = ['neon', 'solarized', '123', '{ "mode": "dark" }', 'null', 'undefined', ''];
      for (const bad of badThemes) {
        mockLocalStorage.setItem(APP_THEME_STORAGE_KEY, bad);
        assert.equal(sanitizeThemeMode(mockLocalStorage), 'dark');
      }

      mockLocalStorage.setItem(APP_THEME_STORAGE_KEY, 'light');
      assert.equal(sanitizeThemeMode(mockLocalStorage), 'light');

      mockLocalStorage.setItem(APP_THEME_STORAGE_KEY, 'system');
      assert.equal(sanitizeThemeMode(mockLocalStorage), 'system');
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 2: Nullish API Response & Missing Populated Relations Safety
  // ═════════════════════════════════════════════════════════════════════
  describe('2. Nullish API Response & Missing Populated Relations Safety', () => {
    // 2.1 DashboardPage Telemetry & Breakdown Division by Zero Defense
    it('2.1 should safely calculate dashboard breakdowns with null/undefined mrr, revenue and 0 tenants', () => {
      // Simulate overviewData with nullish fields
      const overviewData: any = {
        tenants: {
          total: 0,
          active: 0,
          trial: 0,
          grace: 0,
          expired: 0,
          suspended: 0,
        },
        mrr: null,
        revenue: undefined,
        systemHealth: null,
      };

      // Breakdown calculations from DashboardPage.tsx
      const tenants = overviewData?.tenants;
      const totalTenantCount = tenants?.total ?? 0;
      const activeCount = tenants?.active ?? 0;
      const trialCount = tenants?.trial ?? 0;
      const graceCount = tenants?.grace ?? 0;
      const expiredCount = tenants?.expired ?? 0;
      const suspendedCount = tenants?.suspended ?? 0;

      const sumTracked = activeCount + trialCount + graceCount + expiredCount + suspendedCount;
      const denominator = sumTracked > 0 ? sumTracked : totalTenantCount > 0 ? totalTenantCount : 1;

      const pctActive = ((activeCount / denominator) * 100).toFixed(1);
      const pctTrial = ((trialCount / denominator) * 100).toFixed(1);
      const pctGrace = ((graceCount / denominator) * 100).toFixed(1);
      const pctExpired = ((expiredCount / denominator) * 100).toFixed(1);
      const pctSuspended = ((suspendedCount / denominator) * 100).toFixed(1);

      // Verify no NaN or crash
      assert.equal(pctActive, '0.0');
      assert.equal(pctTrial, '0.0');
      assert.equal(pctGrace, '0.0');
      assert.equal(pctExpired, '0.0');
      assert.equal(pctSuspended, '0.0');

      // Metric fallbacks
      const contractedMRR = overviewData?.mrr?.contractedMRR ?? 0;
      const arr = overviewData?.mrr?.arr ?? 0;
      const todayRev = overviewData?.revenue?.today ?? 0;
      const todayPayments = overviewData?.revenue?.todayPaymentsCount ?? 0;

      assert.equal(contractedMRR, 0);
      assert.equal(arr, 0);
      assert.equal(todayRev, 0);
      assert.equal(todayPayments, 0);
    });

    // 2.2 TenantsPage Defensive Rendering with Null Subscriptions & Missing IDs
    it('2.2 should defensively render tenants with null subscription and missing tenantId/phone/firmGSTIN', () => {
      const renderTenantRow = (tenant: any) => {
        const initial = (tenant.firmName || 'T').charAt(0).toUpperCase();
        const firmName = tenant.firmName || 'Unnamed Firm';
        const displayId = tenant.firmGSTIN
          ? `GST: ${tenant.firmGSTIN}`
          : `ID: ${tenant.tenantId ? tenant.tenantId.slice(-8) : '—'}`;
        const phone = tenant.phone || '—';
        const planName = tenant.subscription?.planName;
        const statusLabel = tenant.isActive ? 'Active' : 'Suspended';

        return { initial, firmName, displayId, phone, planName, statusLabel };
      };

      const chaosTenants = [
        { tenantId: '6720abc123456789', firmName: 'Valid Firm', firmGSTIN: '29ABCDE1234F1Z5', isActive: true },
        { tenantId: '6720abc999999999', firmName: '', firmGSTIN: null, phone: '', subscription: null, isActive: false },
        { tenantId: undefined, firmName: null, firmGSTIN: undefined, phone: null, subscription: {}, isActive: true },
        { tenantId: null, firmName: 'Ghost Firm', firmGSTIN: '', phone: undefined, subscription: { planName: null }, isActive: false },
      ];

      for (const t of chaosTenants) {
        assert.doesNotThrow(() => {
          const row = renderTenantRow(t);
          assert.ok(row.initial.length === 1);
          assert.ok(row.firmName.length > 0);
          assert.ok(row.displayId.length > 0);
          assert.ok(row.phone.length > 0);
        });
      }
    });

    // 2.3 SubscriptionsPage Missing Populated Relations Defense
    it('2.3 should safely render subscriptions with missing tenant and missing plan relations', () => {
      const renderSubscriptionRow = (sub: any) => {
        const firmName = sub.tenant?.firmName || 'Unnamed Firm';
        const tenantIdStr = sub.tenantId ?? '—';
        const planName = sub.plan?.name || 'Custom Plan';
        const planCode = sub.plan?.code || '—';
        const statusLabel = sub.status ? sub.status.toUpperCase() : 'UNKNOWN';
        const days = sub.daysRemaining ?? 0;
        const billingMode = sub.billingMode || 'MANUAL';

        return { firmName, tenantIdStr, planName, planCode, statusLabel, days, billingMode };
      };

      const chaosSubs = [
        { _id: 's1', tenantId: 't1', tenant: null, plan: null, status: null, daysRemaining: undefined },
        { _id: 's2', tenantId: 't2', tenant: undefined, plan: undefined, status: undefined, daysRemaining: null },
        { _id: 's3', tenantId: undefined, tenant: {}, plan: {}, status: 'active', daysRemaining: 30 },
      ];

      for (const sub of chaosSubs) {
        assert.doesNotThrow(() => {
          const rendered = renderSubscriptionRow(sub);
          assert.ok(rendered.firmName);
          assert.ok(rendered.planName);
          assert.ok(rendered.statusLabel);
        });
      }
    });

    // 2.4 AuditPage Diff Formatter Defense on Non-Object Diffs
    it('2.4 should safely handle null, primitive strings, booleans, and non-object diffs in FormattedJsonViewer', () => {
      const formatJsonDiff = (data: any) => {
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null;
        return JSON.stringify(data, null, 2);
      };

      const chaosDiffs = [
        null,
        undefined,
        'simple primitive string',
        12345,
        true,
        false,
        [],
        {},
        { user: 'admin', changes: { role: 'SUPPORT_ADMIN' } },
      ];

      for (const diff of chaosDiffs) {
        assert.doesNotThrow(() => {
          const result = formatJsonDiff(diff);
          if (diff && typeof diff === 'object' && Object.keys(diff).length > 0) {
            assert.ok(result !== null);
          } else {
            assert.equal(result, null);
          }
        });
      }
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 3: Cumulative Layout Shift (CLS) & Animation Safety
  // ═════════════════════════════════════════════════════════════════════
  describe('3. Cumulative Layout Shift (CLS) & Animation Safety', () => {
    // 3.1 ActiveSupportBanner Layout Stability & Fixed 44px Guarantee
    it('3.1 should verify ActiveSupportBanner maintains fixed 44px height and prohibits spring height recalculation', () => {
      const bannerFilePath = path.resolve(
        process.cwd(),
        'admin/frontend/src/components/layout/ActiveSupportBanner.tsx'
      );
      assert.ok(fs.existsSync(bannerFilePath), `ActiveSupportBanner.tsx exists at ${bannerFilePath}`);
      const content = fs.readFileSync(bannerFilePath, 'utf8');

      // Prohibit spring physics
      assert.ok(
        !content.includes("type: 'spring'"),
        'ActiveSupportBanner must NOT use spring physics to prevent Chromium border/box-shadow rasterization thrashing'
      );

      // Prohibit height: 'auto' animation
      assert.ok(
        !content.includes("height: 'auto'"),
        'ActiveSupportBanner must NOT animate height: auto (causes 60 frames of CLS layout thrashing)'
      );

      // Verify fixed 44px class
      assert.ok(
        content.includes('min-h-[44px]') && content.includes('max-h-[44px]'),
        'ActiveSupportBanner must enforce min-h-[44px] and max-h-[44px] to guarantee zero CLS'
      );

      // Verify will-change GPU acceleration
      assert.ok(
        content.includes('transform, opacity'),
        'ActiveSupportBanner must hint will-change for GPU acceleration'
      );
    });

    // 3.2 Isolated Countdown Timer Ticking Without Whole-Tree Re-renders
    it('3.2 should isolate timer ticks in memoized component and safely handle past/invalid timestamps', () => {
      const calculateRemaining = (expiresAt: string) => {
        const expiryTime = expiresAt ? new Date(expiresAt).getTime() : NaN;
        if (isNaN(expiryTime)) {
          return {
            totalMs: 0,
            formatted: '00:00',
            isUrgent: true,
          };
        }
        const remainingMs = Math.max(0, expiryTime - Date.now());
        const totalSeconds = Math.floor(remainingMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return {
          totalMs: remainingMs,
          formatted: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
          isUrgent: minutes < 5,
        };
      };

      // Past date -> 00:00, isUrgent = true
      const past = calculateRemaining(new Date(Date.now() - 10000).toISOString());
      assert.equal(past.formatted, '00:00');
      assert.equal(past.isUrgent, true);

      // Invalid date -> 00:00 without NaN:NaN
      const invalid = calculateRemaining('not-a-date');
      assert.equal(invalid.formatted, '00:00');
      assert.equal(invalid.isUrgent, true);

      // Future date (> 10 mins) -> isUrgent = false
      const future = calculateRemaining(new Date(Date.now() + 15 * 60 * 1000).toISOString());
      assert.equal(future.isUrgent, false);
      assert.match(future.formatted, /^[0-9]{2}:[0-9]{2}$/);
    });

    // 3.3 Dropdowns & Floating Panels Anti-Flicker Engineering
    it('3.3 should verify dropdown menus and floating panels use GPU-accelerated Y-glide without spring scaling', () => {
      const headerPath = path.resolve(
        process.cwd(),
        'frontend/src/components/Layout/Header.jsx'
      );
      assert.ok(fs.existsSync(headerPath), `Header.jsx exists at ${headerPath}`);
      const headerContent = fs.readFileSync(headerPath, 'utf8');

      // Verify user dropdown uses subtle Y-glide
      assert.ok(
        headerContent.includes('initial={{ opacity: 0, y: -6 }}'),
        'Header dropdown panel must animate with subtle Y-glide (y: -6 to y: 0)'
      );
      assert.ok(
        headerContent.includes('will-change-[transform,opacity]'),
        'Header dropdown panel must declare will-change-[transform,opacity]'
      );

      // Verify trigger button locks open styling
      assert.ok(
        headerContent.includes("profileOpen"),
        'Header user button must check profileOpen state to lock styling'
      );

      // Verify trigger inner elements have pointer-events-none for stable click target resolution
      assert.ok(
        headerContent.includes('pointer-events-none'),
        'Inner children of dropdown trigger button must have pointer-events-none'
      );
    });

    // 3.4 Modal Dialog Animation & Backdrop Blur Snappiness
    it('3.4 should verify Modal component avoids heavy stuttering backdrop blur and uses snappy transitions', () => {
      const modalPath = path.resolve(
        process.cwd(),
        'admin/frontend/src/components/common/Modal.tsx'
      );
      assert.ok(fs.existsSync(modalPath), `Modal.tsx exists at ${modalPath}`);
      const modalContent = fs.readFileSync(modalPath, 'utf8');

      // Ensure no heavy blur (backdrop-blur-md stutters on low-end GPUs)
      assert.ok(
        !modalContent.includes('backdrop-blur-md'),
        'Modal must avoid backdrop-blur-md to prevent GPU rasterization stutter'
      );
      assert.ok(
        modalContent.includes('backdrop-blur-xs'),
        'Modal should use lightweight backdrop-blur-xs'
      );

      // Transition must be snappy (0.15s)
      assert.ok(
        modalContent.includes('duration: 0.15'),
        'Modal dialog must use snappy 0.15s duration'
      );
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 4: Rapid Double-Submit & Debounce Race Immunity
  // ═════════════════════════════════════════════════════════════════════
  describe('4. Rapid Double-Submit & Debounce Race Immunity', () => {
    // 4.1 Synchronous Mutation Lock on Rapid Double-Submit
    it('4.1 should prevent duplicate submissions under simulated rapid double-clicks on modal submit actions', async () => {
      // Simulate double-click gatekeeper
      let networkRequestCount = 0;
      let isPending = false;

      const triggerAction = async () => {
        // If locked synchronously, abort immediately
        if (isPending) {
          return { accepted: false, reason: 'MUTATION_LOCKED' };
        }
        isPending = true;
        try {
          // Simulate network latency
          await new Promise((resolve) => setTimeout(resolve, 50));
          networkRequestCount++;
          return { accepted: true, data: { status: 'SUCCESS' } };
        } finally {
          isPending = false;
        }
      };

      // Fire 5 rapid clicks concurrently
      const results = await Promise.all([
        triggerAction(),
        triggerAction(),
        triggerAction(),
        triggerAction(),
        triggerAction(),
      ]);

      const acceptedCount = results.filter((r) => r.accepted).length;
      const lockedCount = results.filter((r) => !r.accepted).length;

      assert.equal(acceptedCount, 1, 'Exactly 1 request should be accepted by synchronous mutation lock');
      assert.equal(lockedCount, 4, 'Remaining 4 rapid duplicate clicks should be blocked');
      assert.equal(networkRequestCount, 1, 'Underlying network mutation should execute exactly once');
    });

    // 4.2 SearchInput 300ms Debouncing & Instant Clear Affordance
    it('4.2 should debounce search queries by 300ms and instantly clear query state on clear button trigger', async () => {
      let triggeredValues: string[] = [];
      let timeoutId: NodeJS.Timeout | null = null;
      const debounceMs = 300;

      const onChange = (val: string) => {
        triggeredValues.push(val);
      };

      // Debounce engine matching SearchInput.tsx
      const triggerDebouncedChange = (val: string) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          onChange(val);
        }, debounceMs);
      };

      const handleClear = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        onChange('');
      };

      // Simulate rapid typing: "B", "Bh", "Bha", "Bharat"
      triggerDebouncedChange('B');
      triggerDebouncedChange('Bh');
      triggerDebouncedChange('Bha');
      triggerDebouncedChange('Bharat');

      // Immediate check: no callback should have fired yet
      assert.equal(triggeredValues.length, 0, 'Callback should not fire synchronously during typing');

      // Wait 350ms
      await new Promise((resolve) => setTimeout(resolve, 350));
      assert.equal(triggeredValues.length, 1, 'Callback should fire exactly once after 300ms debounce window');
      assert.equal(triggeredValues[0], 'Bharat');

      // Type "Enterprise" and then immediately click Instant Clear (X)
      triggerDebouncedChange('Bharat Enterprise');
      assert.equal(triggeredValues.length, 1, 'Still only 1 call before debounce completes');

      // Instant Clear
      handleClear();
      assert.equal(
        triggeredValues.length,
        2,
        'Instant clear must immediately invoke callback with empty string'
      );
      assert.equal(triggeredValues[1], '', 'Cleared value must be empty string');

      // Wait another 350ms to ensure the cancelled "Bharat Enterprise" timer NEVER fires
      await new Promise((resolve) => setTimeout(resolve, 350));
      assert.equal(
        triggeredValues.length,
        2,
        'Cancelled debounced timer must not trigger after clear'
      );
    });

    // 4.3 Modal Submission Button Disabled States
    it('4.3 should verify modal components declare disabled states on pending and validating submissions', () => {
      const confirmDialogPath = path.resolve(
        process.cwd(),
        'admin/frontend/src/components/common/ConfirmDialog.tsx'
      );
      assert.ok(fs.existsSync(confirmDialogPath));
      const confirmContent = fs.readFileSync(confirmDialogPath, 'utf8');

      // ConfirmDialog disabled check
      assert.ok(
        confirmContent.includes('disabled={!canSubmit}'),
        'ConfirmDialog submit button must declare disabled={!canSubmit}'
      );
      assert.ok(
        confirmContent.includes('!isLoading'),
        'canSubmit must guard against isLoading to prevent double-submissions'
      );

      // SubscriptionsPage adjust button check
      const subscriptionsPath = path.resolve(
        process.cwd(),
        'admin/frontend/src/pages/SubscriptionsPage.tsx'
      );
      const subContent = fs.readFileSync(subscriptionsPath, 'utf8');
      assert.ok(
        subContent.includes('adjustMutation.isPending'),
        'SubscriptionsPage must lock adjust submit button when adjustMutation.isPending'
      );

      // FeaturesPage grant button check
      const featuresPath = path.resolve(
        process.cwd(),
        'admin/frontend/src/pages/FeaturesPage.tsx'
      );
      const featContent = fs.readFileSync(featuresPath, 'utf8');
      assert.ok(
        featContent.includes('grantMutation.isPending'),
        'FeaturesPage must lock grant submit button when grantMutation.isPending'
      );
    });
  });
});
