/**
 * SaaS Module — TypeScript interfaces and types.
 *
 * Extends the existing AuthenticatedRequest from the invoice module
 * with subscription context attached by SaaS middleware.
 */

import type { Request, Response, NextFunction } from 'express';
import type { Types } from 'mongoose';
import type {
  Feature,
  PlanCode,
  SubscriptionStatus,
  PaymentStatus,
  RewardType,
  DiscountType,
  PaymentGateway,
  NotificationType,
  NotificationChannel,
  AdjustmentType,
  ReferralStatus,
  SupportedDuration,
} from '../shared/features';

// ─── Re-export enums for convenience ─────────────────────────────
export type {
  Feature,
  PlanCode,
  SubscriptionStatus,
  PaymentStatus,
  RewardType,
  DiscountType,
  PaymentGateway,
  NotificationType,
  NotificationChannel,
  AdjustmentType,
  ReferralStatus,
  SupportedDuration,
};

// ─── Plan ────────────────────────────────────────────────────────

export interface IPlan {
  _id: Types.ObjectId;
  name: string;
  code: PlanCode;
  description: string;
  baseMonthlyPrice: number;
  features: Feature[];
  active: boolean;
  displayOrder: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Pricing Rule ────────────────────────────────────────────────

export interface IPricingRule {
  _id: Types.ObjectId;
  planId: Types.ObjectId;
  durationMonths: SupportedDuration;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Subscription ────────────────────────────────────────────────

export interface IPricingSnapshot {
  planName: string;
  planCode: PlanCode;
  baseMonthlyPrice: number;
  durationMonths: number;
  discountApplied: number;
  finalAmount: number;
  features: Feature[];
}

export interface ISubscription {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  planId: Types.ObjectId;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date;
  graceUntil: Date;
  autoRenew: boolean;
  gracePeriodDays: number;
  currentPricingSnapshot: IPricingSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Subscription Payment ────────────────────────────────────────

export interface ISubscriptionPayment {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  planId: Types.ObjectId;
  durationMonths: number;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentGateway: PaymentGateway;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  paymentStatus: PaymentStatus;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Subscription Adjustment ─────────────────────────────────────

export interface ISubscriptionAdjustment {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  type: AdjustmentType;
  daysAdded: number;
  reason: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

// ─── Referral Campaign ───────────────────────────────────────────

export interface IRewardConfig {
  rewardType: RewardType;
  rewardValue: number;
}

export interface IReferralCampaign {
  _id: Types.ObjectId;
  name: string;
  active: boolean;
  validFrom: Date;
  validUntil: Date;
  referrerReward: IRewardConfig;
  referredReward: IRewardConfig;
  maxReferralsPerTenant?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Referral ────────────────────────────────────────────────────

export interface IReferral {
  _id: Types.ObjectId;
  referralCode: string;
  campaignId: Types.ObjectId;
  referrerTenantId: Types.ObjectId;
  referredTenantId?: Types.ObjectId;
  status: ReferralStatus;
  referrerRewardGranted: boolean;
  referredRewardGranted: boolean;
  qualifiedAt?: Date;
  createdAt: Date;
}

// ─── Notification ────────────────────────────────────────────────

export interface INotification {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: Date;
  scheduledFor?: Date;
  createdAt: Date;
}

// ─── System Setting ──────────────────────────────────────────────

export interface ISystemSetting {
  _id: Types.ObjectId;
  key: string;
  value: string | number | boolean;
  description?: string;
  updatedAt: Date;
}

// ─── Middleware-Enriched Request ──────────────────────────────────

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: {
    code: PlanCode;
    name: string;
    features: Feature[];
  };
  canWrite: boolean;
  expiresAt: Date;
  daysRemaining: number;
  isGrace: boolean;
  subscriptionId?: Types.ObjectId;
}

/**
 * Express Request enriched by SaaS middleware.
 * Extends the existing auth pattern (req.user, req.userRole, req.admin).
 */
export interface SaaSRequest extends Request {
  user?: {
    _id?: Types.ObjectId | string;
    createdByAdmin?: Types.ObjectId | string;
    isSuperAdmin?: boolean;
    [key: string]: unknown;
  };
  userRole?: 'admin' | 'employee' | string;
  userModel?: string;
  admin?: Record<string, unknown> | null;
  subscription?: SubscriptionInfo;
  cookies: Record<string, string>;
}

// ─── Pricing Calculation Result ──────────────────────────────────

export interface PriceCalculation {
  basePrice: number;
  durationMonths: number;
  discountAmount: number;
  finalPrice: number;
  savingsPercent: number;
  effectiveMonthlyPrice: number;
}

export interface PlanWithPricing extends IPlan {
  pricing: PriceCalculation[];
}

// ─── Express handler types ───────────────────────────────────────

export type SaaSHandler = (
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
) => Promise<void> | void;
