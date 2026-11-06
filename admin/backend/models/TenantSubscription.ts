/**
 * Bharat Enterprise Billing System — Tenant Subscription Model & State Machine
 *
 * Governs multi-tenant subscription states, lifecycle transitions,
 * strict state guards, and on-the-fly auto-degradation.
 */

import mongoose, { Schema, Model, HydratedDocument, Types } from 'mongoose';

// ─── Subscription Status Enum ─────────────────────────────────────
export enum SubscriptionStatus {
  TRIAL        = 'TRIAL',
  ACTIVE       = 'ACTIVE',
  OVERDUE      = 'OVERDUE',
  GRACE_PERIOD = 'GRACE_PERIOD',
  SUSPENDED    = 'SUSPENDED',
  CANCELLED    = 'CANCELLED',
  EXPIRED      = 'EXPIRED',
}

// ─── State Transition Context ─────────────────────────────────────
export interface StateTransitionContext {
  hasPayment?: boolean;
  paymentId?: string;
  reason?: string;
  operatorId?: string | Types.ObjectId;
  bypassGuard?: boolean;
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
  requiresPayment?: boolean;
}

// ─── Transition Matrix Definition ─────────────────────────────────
// Defines legal target states and mandatory prerequisites for each state.
const TRANSITION_RULES: Record<
  SubscriptionStatus,
  Partial<Record<SubscriptionStatus, { allowed: boolean; requiresPayment?: boolean; reason?: string }>>
> = {
  [SubscriptionStatus.TRIAL]: {
    [SubscriptionStatus.TRIAL]: { allowed: true }, // Idempotent
    [SubscriptionStatus.ACTIVE]: { allowed: true },
    [SubscriptionStatus.OVERDUE]: { allowed: true },
    [SubscriptionStatus.GRACE_PERIOD]: { allowed: true },
    [SubscriptionStatus.SUSPENDED]: { allowed: true },
    [SubscriptionStatus.CANCELLED]: { allowed: true },
    [SubscriptionStatus.EXPIRED]: { allowed: true },
  },
  [SubscriptionStatus.ACTIVE]: {
    [SubscriptionStatus.TRIAL]: {
      allowed: false,
      reason: 'Illegal state transition: Cannot regress from ACTIVE back to TRIAL.',
    },
    [SubscriptionStatus.ACTIVE]: { allowed: true }, // Renewal / idempotent
    [SubscriptionStatus.OVERDUE]: { allowed: true },
    [SubscriptionStatus.GRACE_PERIOD]: { allowed: true },
    [SubscriptionStatus.SUSPENDED]: { allowed: true },
    [SubscriptionStatus.CANCELLED]: { allowed: true },
    [SubscriptionStatus.EXPIRED]: { allowed: true },
  },
  [SubscriptionStatus.OVERDUE]: {
    [SubscriptionStatus.TRIAL]: {
      allowed: false,
      reason: 'Illegal state transition: Cannot transition from OVERDUE to TRIAL.',
    },
    [SubscriptionStatus.ACTIVE]: {
      allowed: true,
      requiresPayment: true,
      reason: 'Illegal state transition: Transition from OVERDUE to ACTIVE requires verified payment.',
    },
    [SubscriptionStatus.OVERDUE]: { allowed: true }, // Idempotent
    [SubscriptionStatus.GRACE_PERIOD]: { allowed: true },
    [SubscriptionStatus.SUSPENDED]: { allowed: true },
    [SubscriptionStatus.CANCELLED]: { allowed: true },
    [SubscriptionStatus.EXPIRED]: { allowed: true },
  },
  [SubscriptionStatus.GRACE_PERIOD]: {
    [SubscriptionStatus.TRIAL]: {
      allowed: false,
      reason: 'Illegal state transition: Cannot transition from GRACE_PERIOD to TRIAL.',
    },
    [SubscriptionStatus.OVERDUE]: {
      allowed: false,
      reason: 'Illegal state transition: Cannot regress from GRACE_PERIOD to OVERDUE.',
    },
    [SubscriptionStatus.ACTIVE]: {
      allowed: true,
      requiresPayment: true,
      reason: 'Illegal state transition: Transition from GRACE_PERIOD to ACTIVE requires verified payment.',
    },
    [SubscriptionStatus.GRACE_PERIOD]: { allowed: true }, // Idempotent
    [SubscriptionStatus.SUSPENDED]: { allowed: true },
    [SubscriptionStatus.CANCELLED]: { allowed: true },
    [SubscriptionStatus.EXPIRED]: { allowed: true },
  },
  [SubscriptionStatus.SUSPENDED]: {
    [SubscriptionStatus.TRIAL]: {
      allowed: false,
      reason: 'Illegal state transition: Cannot transition from SUSPENDED to TRIAL. Trial is restricted to new accounts.',
    },
    [SubscriptionStatus.OVERDUE]: {
      allowed: false,
      reason: 'Illegal state transition: Suspended subscription cannot transition to OVERDUE.',
    },
    [SubscriptionStatus.GRACE_PERIOD]: {
      allowed: false,
      reason: 'Illegal state transition: Suspended subscription cannot enter GRACE_PERIOD.',
    },
    [SubscriptionStatus.ACTIVE]: { allowed: true }, // Administrative or paid reinstatement
    [SubscriptionStatus.SUSPENDED]: { allowed: true }, // Idempotent
    [SubscriptionStatus.CANCELLED]: { allowed: true },
    [SubscriptionStatus.EXPIRED]: { allowed: true },
  },
  [SubscriptionStatus.CANCELLED]: {
    [SubscriptionStatus.TRIAL]: {
      allowed: false,
      reason: 'Illegal state transition: Cancelled subscription cannot transition to TRIAL.',
    },
    [SubscriptionStatus.OVERDUE]: {
      allowed: false,
      reason: 'Illegal state transition: Cancelled subscription cannot transition to OVERDUE.',
    },
    [SubscriptionStatus.GRACE_PERIOD]: {
      allowed: false,
      reason: 'Illegal state transition: Cancelled subscription cannot enter GRACE_PERIOD.',
    },
    [SubscriptionStatus.SUSPENDED]: {
      allowed: false,
      reason: 'Illegal state transition: Cancelled subscription cannot transition to SUSPENDED.',
    },
    [SubscriptionStatus.EXPIRED]: {
      allowed: false,
      reason: 'Illegal state transition: Cancelled subscription is terminal and cannot transition to EXPIRED.',
    },
    [SubscriptionStatus.ACTIVE]: {
      allowed: true,
      requiresPayment: true,
      reason: 'Illegal state transition: Transition from CANCELLED to ACTIVE requires verified payment settlement.',
    },
    [SubscriptionStatus.CANCELLED]: { allowed: true }, // Idempotent
  },
  [SubscriptionStatus.EXPIRED]: {
    [SubscriptionStatus.TRIAL]: {
      allowed: false,
      reason: 'Illegal state transition: Expired subscription cannot transition to TRIAL.',
    },
    [SubscriptionStatus.OVERDUE]: {
      allowed: false,
      reason: 'Illegal state transition: Expired subscription cannot transition to OVERDUE.',
    },
    [SubscriptionStatus.GRACE_PERIOD]: {
      allowed: false,
      reason: 'Illegal state transition: Cannot transition from EXPIRED to GRACE_PERIOD; grace period must precede expiry.',
    },
    [SubscriptionStatus.SUSPENDED]: {
      allowed: false,
      reason: 'Illegal state transition: Expired subscription cannot transition to SUSPENDED.',
    },
    [SubscriptionStatus.ACTIVE]: {
      allowed: true,
      requiresPayment: true,
      reason: 'Illegal state transition: Transition from EXPIRED to ACTIVE requires verified payment.',
    },
    [SubscriptionStatus.CANCELLED]: { allowed: true }, // Archival cancellation
    [SubscriptionStatus.EXPIRED]: { allowed: true }, // Idempotent
  },
};

/**
 * Validates whether a state transition is legal given the current state and context.
 */
export function validateStateTransition(
  currentStatus: SubscriptionStatus,
  targetStatus: SubscriptionStatus,
  context: StateTransitionContext = {},
): TransitionValidationResult {
  if (context.bypassGuard === true) {
    return { allowed: true };
  }

  // Idempotent transitions are always legal
  if (currentStatus === targetStatus) {
    return { allowed: true };
  }

  const fromRules = TRANSITION_RULES[currentStatus];
  if (!fromRules) {
    return {
      allowed: false,
      reason: `Unknown source status: ${currentStatus}`,
    };
  }

  const rule = fromRules[targetStatus];
  if (!rule || rule.allowed === false) {
    return {
      allowed: false,
      reason: rule?.reason || `Illegal state transition: Transition from ${currentStatus} to ${targetStatus} is forbidden.`,
    };
  }

  if (rule.requiresPayment && !context.hasPayment) {
    return {
      allowed: false,
      requiresPayment: true,
      reason: rule.reason || `Illegal state transition: Transition from ${currentStatus} to ${targetStatus} requires verified payment.`,
    };
  }

  return { allowed: true };
}

/**
 * Dynamically resolves subscription status based on temporal boundaries (anti-cron auto-degradation).
 */
export function resolveAutoDegradedStatus(
  sub: {
    status: SubscriptionStatus;
    startDate: Date;
    endDate: Date;
    trialEndsAt?: Date | null;
    gracePeriodEndsAt?: Date | null;
  },
  currentDate: Date = new Date(),
): SubscriptionStatus {
  const currentStatus = sub.status;
  const nowMs = currentDate.getTime();

  // Explicit terminal or administrative states remain anchored
  if (
    currentStatus === SubscriptionStatus.SUSPENDED ||
    currentStatus === SubscriptionStatus.CANCELLED ||
    currentStatus === SubscriptionStatus.EXPIRED
  ) {
    return currentStatus;
  }

  const endMs = new Date(sub.endDate).getTime();
  const trialEndsMs = sub.trialEndsAt ? new Date(sub.trialEndsAt).getTime() : null;
  const graceEndsMs = sub.gracePeriodEndsAt ? new Date(sub.gracePeriodEndsAt).getTime() : null;

  // Evaluation for TRIAL subscriptions
  if (currentStatus === SubscriptionStatus.TRIAL) {
    const trialLimitMs = trialEndsMs !== null ? trialEndsMs : endMs;
    if (nowMs <= trialLimitMs) {
      return SubscriptionStatus.TRIAL;
    }
    // Trial elapsed: check grace window
    if (graceEndsMs !== null && nowMs <= graceEndsMs) {
      return SubscriptionStatus.GRACE_PERIOD;
    }
    return SubscriptionStatus.EXPIRED;
  }

  // Evaluation for ACTIVE subscriptions
  if (currentStatus === SubscriptionStatus.ACTIVE) {
    if (nowMs <= endMs) {
      return SubscriptionStatus.ACTIVE;
    }
    // Past endDate: check grace window
    if (graceEndsMs !== null && nowMs <= graceEndsMs) {
      return SubscriptionStatus.GRACE_PERIOD;
    }
    return SubscriptionStatus.EXPIRED;
  }

  // Evaluation for GRACE_PERIOD or OVERDUE subscriptions
  if (
    currentStatus === SubscriptionStatus.GRACE_PERIOD ||
    currentStatus === SubscriptionStatus.OVERDUE
  ) {
    if (graceEndsMs !== null && nowMs > graceEndsMs) {
      return SubscriptionStatus.EXPIRED;
    }
    return currentStatus;
  }

  return currentStatus;
}

// ─── Mongoose Model & Document Interface ──────────────────────────
export interface ITenantSubscription {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  planId: Types.ObjectId;
  planCode: string;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  trialEndsAt: Date | null;
  gracePeriodEndsAt: Date | null;
  autoRenew: boolean;
  billingInterval: 'monthly' | 'quarterly' | 'yearly';
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;

  // Document instance methods
  canTransitionTo(targetStatus: SubscriptionStatus, context?: StateTransitionContext): boolean;
  validateTransition(targetStatus: SubscriptionStatus, context?: StateTransitionContext): TransitionValidationResult;
  transitionTo(targetStatus: SubscriptionStatus, context?: StateTransitionContext): SubscriptionStatus;
  getEffectiveStatus(currentDate?: Date): SubscriptionStatus;
}

export type TenantSubscriptionDocument = HydratedDocument<ITenantSubscription>;
export type TenantSubscriptionModel = Model<ITenantSubscription>;

const tenantSubscriptionSchema = new Schema<ITenantSubscription, TenantSubscriptionModel>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'tenantId is required'],
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'planId is required'],
    },
    planCode: {
      type: String,
      required: [true, 'planCode is required'],
      default: 'starter',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.TRIAL,
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'startDate is required'],
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, 'endDate is required'],
    },
    trialEndsAt: {
      type: Date,
      default: null,
    },
    gracePeriodEndsAt: {
      type: Date,
      default: null,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    billingInterval: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

// Method implementations on schema
tenantSubscriptionSchema.methods.canTransitionTo = function (
  this: ITenantSubscription,
  targetStatus: SubscriptionStatus,
  context?: StateTransitionContext,
): boolean {
  return validateStateTransition(this.status, targetStatus, context).allowed;
};

tenantSubscriptionSchema.methods.validateTransition = function (
  this: ITenantSubscription,
  targetStatus: SubscriptionStatus,
  context?: StateTransitionContext,
): TransitionValidationResult {
  return validateStateTransition(this.status, targetStatus, context);
};

tenantSubscriptionSchema.methods.transitionTo = function (
  this: ITenantSubscription,
  targetStatus: SubscriptionStatus,
  context?: StateTransitionContext,
): SubscriptionStatus {
  const result = validateStateTransition(this.status, targetStatus, context);
  if (!result.allowed) {
    throw new Error(result.reason || `Illegal state transition from ${this.status} to ${targetStatus}`);
  }
  this.status = targetStatus;
  return this.status;
};

tenantSubscriptionSchema.methods.getEffectiveStatus = function (
  this: ITenantSubscription,
  currentDate?: Date,
): SubscriptionStatus {
  return resolveAutoDegradedStatus(this, currentDate);
};

// Compound index for tenant lifecycle queries
tenantSubscriptionSchema.index({ tenantId: 1, status: 1, endDate: -1 });

export const TenantSubscription: TenantSubscriptionModel =
  (mongoose.models.TenantSubscription as TenantSubscriptionModel) ||
  mongoose.model<ITenantSubscription, TenantSubscriptionModel>(
    'TenantSubscription',
    tenantSubscriptionSchema,
  );

export default TenantSubscription;
