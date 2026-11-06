/**
 * Bharat Enterprise Billing System — Subscription State Machine & Entitlement Matrix Fuzzer
 *
 * Exhaustive adversarial test suite executing:
 * 1. 500-iteration Markov chain state machine transition fuzzing
 * 2. 5-Level Entitlement Precedence Matrix exhaustion & ghost privilege verification
 * 3. Feature Limit Integer Overflow & Negative Limit fuzzing
 * 4. Temporal Grace Period Auto-Degradation without background cron execution
 * 5. Plan Downgrade Under Utilization Hazard simulation (15 users down to 3 users)
 *
 * Executed via Node test runner:
 * npx tsx --tsconfig admin/backend/tsconfig.json --test admin/backend/tests/subscriptionStateMachineFuzzer.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import {
  SubscriptionStatus,
  validateStateTransition,
  resolveAutoDegradedStatus,
  TenantSubscription,
  ITenantSubscription,
} from '../models/TenantSubscription';
import {
  FeatureOverride,
  validateLimitValue,
} from '../models/FeatureOverride';
import {
  calculateEffectiveFeatures,
  evaluateEffectiveEntitlements,
  isFeatureEntitled,
  getFeatureLimit,
  transitionSubscriptionState,
  resolveSubscriptionStatus,
  sanitizeLimitValue,
  evaluatePlanDowngrade,
  SYSTEM_GLOBAL_DEFAULTS,
  PLAN_TIERS,
} from '../services/platformSubscriptionService';

// ─── Helper: Pseudo-random generator for reproducible fuzzing ─────
function createDeterministicRandom(seed: number = 1337) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Attack 1: Illegal State Transition Fuzzing ────────────────────
describe('Attack 1: State Machine Markov Chain & Randomized Transition Fuzzing', () => {
  const allStates: SubscriptionStatus[] = [
    SubscriptionStatus.TRIAL,
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.OVERDUE,
    SubscriptionStatus.GRACE_PERIOD,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ];

  it('should strictly reject key forbidden adversarial transitions', () => {
    // 1. CANCELLED -> ACTIVE without verified payment
    const cancelToActiveNoPay = validateStateTransition(
      SubscriptionStatus.CANCELLED,
      SubscriptionStatus.ACTIVE,
      { hasPayment: false },
    );
    assert.equal(cancelToActiveNoPay.allowed, false);
    assert.match(cancelToActiveNoPay.reason || '', /requires verified payment/i);

    // 2. EXPIRED -> GRACE_PERIOD
    const expiredToGrace = validateStateTransition(
      SubscriptionStatus.EXPIRED,
      SubscriptionStatus.GRACE_PERIOD,
    );
    assert.equal(expiredToGrace.allowed, false);
    assert.match(expiredToGrace.reason || '', /grace period must precede expiry/i);

    // 3. SUSPENDED -> TRIAL
    const suspendedToTrial = validateStateTransition(
      SubscriptionStatus.SUSPENDED,
      SubscriptionStatus.TRIAL,
    );
    assert.equal(suspendedToTrial.allowed, false);
    assert.match(suspendedToTrial.reason || '', /restricted to new accounts|trial/i);

    // 4. ACTIVE -> TRIAL
    const activeToTrial = validateStateTransition(
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIAL,
    );
    assert.equal(activeToTrial.allowed, false);

    // 5. SUSPENDED -> GRACE_PERIOD
    const suspendedToGrace = validateStateTransition(
      SubscriptionStatus.SUSPENDED,
      SubscriptionStatus.GRACE_PERIOD,
    );
    assert.equal(suspendedToGrace.allowed, false);

    // 6. EXPIRED -> TRIAL
    const expiredToTrial = validateStateTransition(
      SubscriptionStatus.EXPIRED,
      SubscriptionStatus.TRIAL,
    );
    assert.equal(expiredToTrial.allowed, false);

    // 7. CANCELLED -> GRACE_PERIOD
    const cancelledToGrace = validateStateTransition(
      SubscriptionStatus.CANCELLED,
      SubscriptionStatus.GRACE_PERIOD,
    );
    assert.equal(cancelledToGrace.allowed, false);
  });

  it('should allow valid transitions when legitimate prerequisites are satisfied', () => {
    // CANCELLED -> ACTIVE WITH payment
    const cancelToActivePaid = validateStateTransition(
      SubscriptionStatus.CANCELLED,
      SubscriptionStatus.ACTIVE,
      { hasPayment: true, paymentId: 'pay_xyz123' },
    );
    assert.equal(cancelToActivePaid.allowed, true);

    // EXPIRED -> ACTIVE WITH payment
    const expiredToActivePaid = validateStateTransition(
      SubscriptionStatus.EXPIRED,
      SubscriptionStatus.ACTIVE,
      { hasPayment: true, paymentId: 'pay_renew456' },
    );
    assert.equal(expiredToActivePaid.allowed, true);

    // OVERDUE -> ACTIVE WITH payment
    const overdueToActivePaid = validateStateTransition(
      SubscriptionStatus.OVERDUE,
      SubscriptionStatus.ACTIVE,
      { hasPayment: true },
    );
    assert.equal(overdueToActivePaid.allowed, true);

    // TRIAL -> ACTIVE
    const trialToActive = validateStateTransition(
      SubscriptionStatus.TRIAL,
      SubscriptionStatus.ACTIVE,
    );
    assert.equal(trialToActive.allowed, true);

    // ACTIVE -> SUSPENDED
    const activeToSuspended = validateStateTransition(
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.SUSPENDED,
      { reason: 'Administrative suspension' },
    );
    assert.equal(activeToSuspended.allowed, true);
  });

  it('should execute 500-step Markov chain state transition fuzzing without corruption', async () => {
    const rng = createDeterministicRandom(42);
    let currentState = SubscriptionStatus.TRIAL;

    const tenantId = new Types.ObjectId();
    const planId = new Types.ObjectId();
    const now = new Date();

    const mockSubDoc: ITenantSubscription = new TenantSubscription({
      tenantId,
      planId,
      planCode: 'business',
      status: currentState,
      startDate: now,
      endDate: new Date(now.getTime() + 30 * 86400000),
      trialEndsAt: new Date(now.getTime() + 14 * 86400000),
      gracePeriodEndsAt: new Date(now.getTime() + 37 * 86400000),
      autoRenew: false,
    });

    let totalAttempts = 0;
    let allowedTransitions = 0;
    let blockedTransitions = 0;
    let paymentGuardsEnforced = 0;

    for (let step = 0; step < 500; step++) {
      totalAttempts++;
      const targetStateIndex = Math.floor(rng() * allStates.length);
      const targetState = allStates[targetStateIndex]!;
      const hasPayment = rng() > 0.5;

      const context = {
        hasPayment,
        paymentId: hasPayment ? `pay_fuzz_${step}` : undefined,
        reason: `Markov step ${step}`,
      };

      const validation = validateStateTransition(currentState, targetState, context);

      if (validation.allowed) {
        allowedTransitions++;
        // State must transition safely
        const prior = mockSubDoc.status;
        mockSubDoc.transitionTo(targetState, context);
        assert.equal(
          mockSubDoc.status,
          targetState,
          `State should transition from ${prior} to ${targetState}`,
        );
        currentState = targetState;
      } else {
        blockedTransitions++;
        if (validation.requiresPayment) {
          paymentGuardsEnforced++;
        }

        // State guard must throw when transitionTo is invoked with illegal target
        const stateBefore = mockSubDoc.status;
        assert.throws(
          () => {
            mockSubDoc.transitionTo(targetState, context);
          },
          /Illegal state transition/i,
          `Illegal transition from ${currentState} to ${targetState} must throw an error`,
        );

        // State integrity assertion: current status MUST NOT corrupt or mutate
        assert.equal(
          mockSubDoc.status,
          stateBefore,
          `State must remain unchanged at ${stateBefore} when transition is rejected`,
        );
      }
    }

    assert.equal(totalAttempts, 500);
    assert.equal(totalAttempts, allowedTransitions + blockedTransitions);
    assert.equal(blockedTransitions > 100, true, 'At least 100 invalid attempts should be blocked');
    assert.equal(allowedTransitions > 100, true, 'At least 100 valid transitions should succeed');
    assert.equal(paymentGuardsEnforced > 10, true, 'Payment guards should be triggered');
  });
});

// ─── Attack 2: 5-Level Entitlement Precedence Exhaustion ──────────
describe('Attack 2: 5-Level Entitlement Precedence Exhaustion & Ghost Privilege Elimination', () => {
  const tenantId = new Types.ObjectId().toString();

  it('Level 1: System Global Default fallback when no plan or overrides exist', () => {
    const result = evaluateEffectiveEntitlements(tenantId, {
      subscription: null,
      overrides: [],
    });

    // Default users = 1, precedence level = 1
    assert.equal(result.features.USERS?.limitValue, 1);
    assert.equal(result.features.USERS?.precedenceLevel, 1);
    assert.equal(result.features.USERS?.resolvedSource, 'LEVEL_1_GLOBAL_DEFAULT');

    // Premium features default disabled
    assert.equal(result.features.GST_REPORTS?.isEnabled, false);
    assert.equal(result.features.GST_REPORTS?.isPremium, true);
  });

  it('Level 2: Plan Tier Base Entitlement overrides Level 1 defaults', () => {
    const now = new Date();
    const result = evaluateEffectiveEntitlements(tenantId, {
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        planCode: 'starter',
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 86400000),
      },
      overrides: [],
    });

    // Starter tier defines USERS limit = 3, overriding Level 1 default of 1
    assert.equal(result.features.USERS?.limitValue, 3);
    assert.equal(result.features.USERS?.precedenceLevel, 2);
    assert.equal(result.features.USERS?.resolvedSource, 'LEVEL_2_PLAN_TIER');

    // Starter tier has GST_REPORTS disabled
    assert.equal(result.features.GST_REPORTS?.isEnabled, false);
    assert.equal(result.features.GST_REPORTS?.limitValue, 0);

    // Business tier verification
    const bizResult = evaluateEffectiveEntitlements(tenantId, {
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        planCode: 'business',
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 86400000),
      },
      overrides: [],
    });

    assert.equal(bizResult.features.USERS?.limitValue, 10);
    assert.equal(bizResult.features.GST_REPORTS?.isEnabled, true);
  });

  it('Level 3: SUSPENDED state multiplier blocks all premium features completely', () => {
    const now = new Date();
    // Enterprise plan has all premium features enabled
    const result = evaluateEffectiveEntitlements(tenantId, {
      subscription: {
        status: SubscriptionStatus.SUSPENDED,
        planCode: 'enterprise',
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 86400000),
      },
      overrides: [],
    });

    // Premium features MUST be hard-blocked by Level 3 multiplier
    assert.equal(result.effectiveStatus, SubscriptionStatus.SUSPENDED);
    assert.equal(result.canWrite, false);

    assert.equal(result.features.GST_REPORTS?.isEnabled, false);
    assert.equal(result.features.GST_REPORTS?.limitValue, 0);
    assert.equal(result.features.GST_REPORTS?.precedenceLevel, 3);
    assert.equal(result.features.GST_REPORTS?.resolvedSource, 'LEVEL_3_STATE_MULTIPLIER');

    assert.equal(result.features.INVENTORY_INTELLIGENCE?.isEnabled, false);
    assert.equal(result.features.INVENTORY_INTELLIGENCE?.precedenceLevel, 3);

    assert.equal(result.features.ADVANCED_REPORTING?.isEnabled, false);
    assert.equal(result.features.ADVANCED_REPORTING?.precedenceLevel, 3);
  });

  it('Level 4: Active Tenant-Specific Override overrides Plan and Multiplier', () => {
    const now = new Date();
    // Tenant is on Starter (no GST_REPORTS, USERS limit = 3)
    const result = evaluateEffectiveEntitlements(tenantId, {
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        planCode: 'starter',
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 86400000),
      },
      overrides: [
        {
          featureKey: 'GST_REPORTS',
          isEnabled: true,
          limitValue: 50,
          expiresAt: new Date(now.getTime() + 7 * 86400000), // 7 days future
          isActive: true,
        },
        {
          featureKey: 'USERS',
          isEnabled: true,
          limitValue: 25,
          expiresAt: null, // Indefinite
          isActive: true,
        },
        {
          featureKey: 'CUSTOMERS',
          isEnabled: false, // Subtractive override
          isActive: true,
        },
      ],
    });

    // GST_REPORTS granted via Level 4 override
    assert.equal(result.features.GST_REPORTS?.isEnabled, true);
    assert.equal(result.features.GST_REPORTS?.limitValue, 50);
    assert.equal(result.features.GST_REPORTS?.precedenceLevel, 4);
    assert.equal(result.features.GST_REPORTS?.resolvedSource, 'LEVEL_4_TENANT_OVERRIDE');

    // USERS expanded to 25 via Level 4 override
    assert.equal(result.features.USERS?.limitValue, 25);
    assert.equal(result.features.USERS?.precedenceLevel, 4);

    // CUSTOMERS revoked via Level 4 subtractive override
    assert.equal(result.features.CUSTOMERS?.isEnabled, false);
    assert.equal(result.features.CUSTOMERS?.precedenceLevel, 4);
  });

  it('Level 5: Expired override immediately drops back to Plan tier with ZERO ghost privileges', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000); // 1 day ago

    // Override was granted in the past and has expired
    const result = evaluateEffectiveEntitlements(tenantId, {
      currentDate: now,
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        planCode: 'starter',
        startDate: new Date(now.getTime() - 30 * 86400000),
        endDate: new Date(now.getTime() + 30 * 86400000),
      },
      overrides: [
        {
          featureKey: 'GST_REPORTS',
          isEnabled: true,
          limitValue: 999,
          expiresAt: yesterday, // EXPIRED!
          isActive: true,
        },
        {
          featureKey: 'USERS',
          isEnabled: true,
          limitValue: 100,
          expiresAt: yesterday, // EXPIRED!
          isActive: true,
        },
      ],
    });

    // Both expired overrides must be dropped cleanly
    assert.equal(result.expiredOverridesDroppedCount, 2);
    assert.equal(result.overridesAppliedCount, 0);

    // GST_REPORTS must drop back to Starter tier (disabled, 0 limit)
    assert.equal(
      result.features.GST_REPORTS?.isEnabled,
      false,
      'Ghost privilege detected! Expired override must not leave feature enabled.',
    );
    assert.equal(
      result.features.GST_REPORTS?.limitValue,
      0,
      'Ghost privilege detected! Expired limit must revert to plan limit.',
    );
    assert.equal(result.features.GST_REPORTS?.precedenceLevel, 2);
    assert.equal(result.features.GST_REPORTS?.resolvedSource, 'LEVEL_2_PLAN_TIER');

    // USERS limit must drop back to Starter tier (3 users)
    assert.equal(
      result.features.USERS?.limitValue,
      3,
      'Ghost privilege detected! Expired user limit must revert to plan tier limit.',
    );
    assert.equal(result.features.USERS?.precedenceLevel, 2);
  });

  it('should evaluate full permutation matrix across all 5 levels deterministically', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 3600000);
    const future = new Date(now.getTime() + 3600000);

    const testPermutations = [
      {
        plan: 'starter',
        status: SubscriptionStatus.ACTIVE,
        override: null,
        expectedUsers: 3,
        expectedGst: false,
      },
      {
        plan: 'business',
        status: SubscriptionStatus.ACTIVE,
        override: null,
        expectedUsers: 10,
        expectedGst: true,
      },
      {
        plan: 'enterprise',
        status: SubscriptionStatus.ACTIVE,
        override: null,
        expectedUsers: 100,
        expectedGst: true,
      },
      {
        plan: 'enterprise',
        status: SubscriptionStatus.SUSPENDED,
        override: null,
        expectedUsers: 100,
        expectedGst: false, // Blocked by Level 3
      },
      {
        plan: 'starter',
        status: SubscriptionStatus.ACTIVE,
        override: { isEnabled: true, limitValue: 5, expiresAt: future },
        expectedUsers: 5, // Overridden by Level 4
        expectedGst: false,
      },
      {
        plan: 'starter',
        status: SubscriptionStatus.ACTIVE,
        override: { isEnabled: true, limitValue: 50, expiresAt: past },
        expectedUsers: 3, // Level 5 dropped back to Plan
        expectedGst: false,
      },
    ];

    for (const [index, p] of testPermutations.entries()) {
      const overrides = p.override
        ? [
            {
              featureKey: 'USERS',
              isEnabled: p.override.isEnabled,
              limitValue: p.override.limitValue,
              expiresAt: p.override.expiresAt,
              isActive: true,
            },
          ]
        : [];

      const res = evaluateEffectiveEntitlements(tenantId, {
        currentDate: now,
        subscription: {
          status: p.status,
          planCode: p.plan,
          startDate: now,
          endDate: future,
        },
        overrides,
      });

      assert.equal(
        res.features.USERS?.limitValue,
        p.expectedUsers,
        `Permutation ${index} failed for USERS limit`,
      );
      assert.equal(
        res.features.GST_REPORTS?.isEnabled,
        p.expectedGst,
        `Permutation ${index} failed for GST_REPORTS isEnabled`,
      );
    }
  });
});

// ─── Attack 3: Feature Limit Integer Overflow & Negative Limit Fuzzing
describe('Attack 3: Feature Limit Integer Overflow & Negative Limit Fuzzing', () => {
  it('should reject negative limits (-1, -999, -1000000)', () => {
    const negatives = [-1, -999, -1000000, -0.01];
    for (const val of negatives) {
      const result = validateLimitValue(val);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /cannot be negative/i);

      assert.throws(
        () => {
          sanitizeLimitValue(val);
        },
        /cannot be negative/i,
      );

      // Model validation check
      const model = new FeatureOverride({
        tenantId: new Types.ObjectId(),
        featureKey: 'USERS',
        isEnabled: true,
        limitValue: val,
        reason: 'Test negative limit validation',
        createdBy: new Types.ObjectId(),
      });
      const err = model.validateSync();
      assert.notEqual(err, undefined);
      assert.match(err!.errors.limitValue!.message, /cannot be negative|Invalid limitValue/i);
    }
  });

  it('should reject non-integer floating points (12.34, 0.5, 3.14159)', () => {
    const floats = [12.34, 0.5, 3.14159, 100.0001];
    for (const val of floats) {
      const result = validateLimitValue(val);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /must be an integer, not floating point/i);

      assert.throws(
        () => {
          sanitizeLimitValue(val);
        },
        /floating point/i,
      );
    }
  });

  it('should reject non-numeric string values ("100", "abc", "NaN")', () => {
    const strings = ['100', 'abc', '-5', 'NaN', 'null', 'Infinity'];
    for (const val of strings) {
      const result = validateLimitValue(val as any);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /must be a numeric integer/i);

      assert.throws(
        () => {
          sanitizeLimitValue(val as any);
        },
        /must be a numeric integer/i,
      );
    }
  });

  it('should reject non-finite numbers (NaN, Infinity, -Infinity)', () => {
    const nonFinites = [NaN, Infinity, -Infinity];
    for (const val of nonFinites) {
      const result = validateLimitValue(val);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /finite number/i);
    }
  });

  it('should reject numbers exceeding Number.MAX_SAFE_INTEGER', () => {
    const overflowValues = [
      Number.MAX_SAFE_INTEGER + 1,
      Number.MAX_SAFE_INTEGER + 1000,
      1e20,
    ];
    for (const val of overflowValues) {
      const result = validateLimitValue(val);
      assert.equal(result.valid, false);
      assert.match(result.error || '', /cannot exceed Number.MAX_SAFE_INTEGER/i);
    }
  });

  it('should accept exact boundary safe integers (0, Number.MAX_SAFE_INTEGER, null)', () => {
    assert.deepEqual(validateLimitValue(0), { valid: true, value: 0 });
    assert.deepEqual(validateLimitValue(1), { valid: true, value: 1 });
    assert.deepEqual(validateLimitValue(100), { valid: true, value: 100 });
    assert.deepEqual(validateLimitValue(Number.MAX_SAFE_INTEGER), {
      valid: true,
      value: Number.MAX_SAFE_INTEGER,
    });
    assert.deepEqual(validateLimitValue(null), { valid: true, value: null });
    assert.deepEqual(validateLimitValue(undefined), { valid: true, value: null });
  });
});

// ─── Attack 4: Temporal Grace Period Auto-Degradation ──────────────
describe('Attack 4: Temporal Grace Period Auto-Degradation Without Background Cron', () => {
  it('should degrade dynamically as time advances through expiry and grace period', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const endDate = new Date('2026-06-30T00:00:00Z');
    const gracePeriodEndsAt = new Date('2026-07-07T00:00:00Z'); // 7 days grace

    const sub = {
      status: SubscriptionStatus.ACTIVE,
      startDate: now,
      endDate,
      trialEndsAt: null,
      gracePeriodEndsAt,
    };

    // 1. Day 15: Well before endDate -> ACTIVE
    const dateMidTerm = new Date('2026-06-15T00:00:00Z');
    assert.equal(resolveAutoDegradedStatus(sub, dateMidTerm), SubscriptionStatus.ACTIVE);

    // 2. Day 32: 2 days past endDate, within grace -> GRACE_PERIOD
    const dateInGrace = new Date('2026-07-02T00:00:00Z');
    assert.equal(resolveAutoDegradedStatus(sub, dateInGrace), SubscriptionStatus.GRACE_PERIOD);

    // 3. Day 40: 3 days past gracePeriodEndsAt -> EXPIRED
    const datePastGrace = new Date('2026-07-10T00:00:00Z');
    assert.equal(
      resolveAutoDegradedStatus(sub, datePastGrace),
      SubscriptionStatus.EXPIRED,
      'When currentDate > gracePeriodEndsAt, status must automatically degrade to EXPIRED without cron',
    );
  });

  it('should immediately lock write access and block premium features upon grace expiry', () => {
    const tenantId = new Types.ObjectId().toString();
    const startDate = new Date('2026-01-01T00:00:00Z');
    const endDate = new Date('2026-01-31T00:00:00Z');
    const gracePeriodEndsAt = new Date('2026-02-07T00:00:00Z');

    // Simulate query on 2026-02-15 (8 days past grace expiry)
    const simulatedNow = new Date('2026-02-15T00:00:00Z');

    const result = evaluateEffectiveEntitlements(tenantId, {
      currentDate: simulatedNow,
      subscription: {
        status: SubscriptionStatus.ACTIVE, // Stored in DB as ACTIVE (cron has not run yet)
        planCode: 'enterprise',
        startDate,
        endDate,
        gracePeriodEndsAt,
      },
    });

    // Effective status must degrade to EXPIRED on the fly!
    assert.equal(result.storedStatus, SubscriptionStatus.ACTIVE);
    assert.equal(result.effectiveStatus, SubscriptionStatus.EXPIRED);
    assert.equal(
      result.canWrite,
      false,
      'Write privileges must be revoked immediately when grace period has expired',
    );

    // Premium features must be shut off
    assert.equal(result.features.GST_REPORTS?.isEnabled, false);
    assert.equal(result.features.INVENTORY_INTELLIGENCE?.isEnabled, false);
  });

  it('should auto-degrade TRIAL subscriptions when trial ends without payment', () => {
    const startDate = new Date('2026-03-01T00:00:00Z');
    const trialEndsAt = new Date('2026-03-14T00:00:00Z');
    const gracePeriodEndsAt = new Date('2026-03-21T00:00:00Z');

    const sub = {
      status: SubscriptionStatus.TRIAL,
      startDate,
      endDate: trialEndsAt,
      trialEndsAt,
      gracePeriodEndsAt,
    };

    // Within trial
    assert.equal(
      resolveAutoDegradedStatus(sub, new Date('2026-03-10T00:00:00Z')),
      SubscriptionStatus.TRIAL,
    );

    // Past trial, inside grace
    assert.equal(
      resolveAutoDegradedStatus(sub, new Date('2026-03-16T00:00:00Z')),
      SubscriptionStatus.GRACE_PERIOD,
    );

    // Past grace -> EXPIRED
    assert.equal(
      resolveAutoDegradedStatus(sub, new Date('2026-03-25T00:00:00Z')),
      SubscriptionStatus.EXPIRED,
    );
  });
});

// ─── Attack 5: Plan Downgrade Under Utilization Hazard ─────────────
describe('Attack 5: Plan Downgrade Under Utilization Hazard (15 Users -> 3 Users)', () => {
  it('should safely handle 15 users downgrading to 3 users without data loss or crashes', () => {
    const tenantId = new Types.ObjectId().toString();

    // Tenant currently has 15 active users on Enterprise plan (allowed up to 100)
    const currentUsage = {
      USERS: 15,
      INVOICE_CREATE: 80,
      CUSTOMERS: 150,
    };

    // Tenant downgrades to Starter plan (limits: USERS: 3, INVOICE_CREATE: 100, CUSTOMERS: 200)
    const assessment = evaluatePlanDowngrade({
      tenantId,
      currentPlanCode: 'enterprise',
      targetPlanCode: 'starter',
      currentUsage,
    });

    // 1. Data loss prevention invariant
    assert.equal(
      assessment.dataLossPrevented,
      true,
      'CRITICAL: Data loss prevented invariant must be true. Existing records must not be truncated.',
    );
    assert.equal(
      assessment.safeStateDetails.existingRecordsIntactCount,
      245,
      'All 245 existing records (15 users + 80 invoices + 150 customers) must remain intact.',
    );

    // 2. Over-limit detection
    assert.equal(assessment.isOverLimit, true);
    assert.equal(assessment.hazards.length, 1);

    const userHazard = assessment.hazards[0]!;
    assert.equal(userHazard.featureKey, 'USERS');
    assert.equal(userHazard.currentUsage, 15);
    assert.equal(userHazard.targetLimit, 3);
    assert.equal(userHazard.excess, 12);
    assert.equal(userHazard.severity, 'CRITICAL');
    assert.match(userHazard.message, /exceeds target plan limit of 3 by 12/i);

    // 3. Provisioning soft-lock
    assert.equal(
      assessment.canProvisionMore,
      false,
      'Provisioning of new users must be soft-locked while in over-limit state.',
    );
    assert.equal(assessment.actionRecommendation, 'PERMIT_WITH_SOFT_LOCK');
  });

  it('should permit clean downgrade when utilization is within target plan limits', () => {
    const tenantId = new Types.ObjectId().toString();

    // Tenant has 2 users, 50 invoices on Business, downgrading to Starter (limits: 3 users, 100 invoices)
    const assessment = evaluatePlanDowngrade({
      tenantId,
      currentPlanCode: 'business',
      targetPlanCode: 'starter',
      currentUsage: {
        USERS: 2,
        INVOICE_CREATE: 50,
      },
    });

    assert.equal(assessment.isOverLimit, false);
    assert.equal(assessment.hazards.length, 0);
    assert.equal(assessment.canProvisionMore, true);
    assert.equal(assessment.actionRecommendation, 'SAFE_DOWNGRADE');
  });
});
