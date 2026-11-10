/**
 * Bharat Enterprise Billing System — Manual Subscription & Offline Payment Service
 * High-integrity ACID transaction engine for manual provisioning, offline payments,
 * tenant verification queue, and statutory B2B GST tax invoice issuance.
 */

import { Types, ClientSession } from 'mongoose';
import Subscription from '../../../backend/saas/models/Subscription';
import Plan from '../../../backend/saas/models/Plan';
import SubscriptionPayment from '../../../backend/saas/models/SubscriptionPayment';
import PlatformInvoice, { IPlatformInvoice } from '../../../backend/saas/models/PlatformInvoice';
import SubscriptionManualRequest, {
  ISubscriptionManualRequest,
} from '../../../backend/saas/models/SubscriptionManualRequest';
import {
  calculateTaxBreakdown,
  createPlatformTaxInvoice,
  resolveRecipientPlaceOfSupply,
} from '../../../backend/saas/services/platformTaxInvoiceService';
import { calculatePrice } from '../../../backend/saas/services/pricingService';
import { invalidateSubscriptionCache } from '../../../backend/saas/services/featureService';
import {
  createNotification,
  scheduleExpiryNotifications,
} from '../../../backend/saas/services/notificationService';
import { invalidatePlatformDashboardCache } from '../queries/dashboardQueries';
import { logPlatformAudit } from './platformAuditService';
import { runInTransaction } from './transactionHelper';
import {
  SubscriptionStatus,
  PaymentStatus,
  PaymentGateway,
  NotificationType,
} from '../../../backend/saas/shared/features';

function getAdminModel() {
  const mongoose = require('mongoose');
  if (mongoose.models.Admin) {
    return mongoose.models.Admin;
  }
  const loaded = require('../../../backend/models/Admin');
  return loaded.default || loaded;
}

/**
 * Calendar month addition preserving end-of-month boundaries.
 */
export function addMonths(baseDate: Date, months: number): Date {
  const result = new Date(baseDate);
  const currentDay = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < currentDay) {
    result.setDate(0);
  }
  return result;
}

export interface ManualPaymentDetailsInput {
  mode: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'CASH' | 'CHEQUE' | 'COMPLIMENTARY';
  utrNumber?: string;
  bankName?: string;
  depositedToAccount?: string;
  instrumentDate?: Date;
  receiptUrl?: string;
  amount?: number;
  isComplimentary?: boolean;
  isTaxInclusive?: boolean;
}

export interface AllocateSubscriptionDTO {
  tenantId: string;
  planId: string;
  durationMonths: number;
  operatorId: Types.ObjectId;
  operatorEmail: string;
  operatorRole: string;
  reason: string;
  paymentDetails?: ManualPaymentDetailsInput;
  autoRenew?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface AllocationResult {
  subscription: any;
  payment?: any;
  invoice?: IPlatformInvoice;
}

/**
 * Core allocation logic executing inside an active MongoDB session.
 */
async function allocateSubscriptionInternal(
  dto: AllocateSubscriptionDTO,
  session: ClientSession,
): Promise<AllocationResult> {
  const {
    tenantId,
    planId,
    durationMonths,
    operatorId,
    operatorEmail,
    operatorRole,
    reason,
    paymentDetails,
    ipAddress,
    userAgent,
  } = dto;

  if (!tenantId || !Types.ObjectId.isValid(tenantId)) {
    throw new Error('Valid Tenant ID is required');
  }
  if (!planId || !Types.ObjectId.isValid(planId)) {
    throw new Error('Valid Plan ID is required');
  }
  if (!durationMonths || durationMonths < 1) {
    throw new Error('Duration in months must be at least 1');
  }
  if (!reason || reason.trim().length < 10) {
    throw new Error('Operational reason must be at least 10 characters');
  }

  const Admin = getAdminModel();
  const tenant = await Admin.findById(tenantId).session(session);
  if (!tenant) {
    throw new Error(`Tenant with ID ${tenantId} not found`);
  }

  const plan = await Plan.findById(planId).session(session);
  if (!plan) {
    throw new Error(`Plan with ID ${planId} not found`);
  }

  const existingSub = await Subscription.findOne({ tenantId }).session(session);
  const beforeState = existingSub
    ? {
        status: existingSub.status,
        expiresAt: existingSub.expiresAt,
        planId: existingSub.planId?.toString(),
      }
    : null;

  const now = new Date();
  let startedAt = now;
  let expiresAt: Date;

  if (
    existingSub &&
    existingSub.status === SubscriptionStatus.ACTIVE &&
    existingSub.expiresAt &&
    new Date(existingSub.expiresAt).getTime() > now.getTime()
  ) {
    // Co-terminous tenure stacking
    expiresAt = addMonths(new Date(existingSub.expiresAt), durationMonths);
  } else {
    expiresAt = addMonths(now, durationMonths);
  }

  const graceDays = existingSub?.gracePeriodDays ?? 7;
  const graceUntil = new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

  // Pricing determination
  const isComplimentary =
    paymentDetails?.isComplimentary || paymentDetails?.mode === 'COMPLIMENTARY';

  let baseAmount = 0;
  let discountAmount = 0;
  let finalAmount = 0;

  if (isComplimentary) {
    baseAmount = 0;
    discountAmount = 0;
    finalAmount = 0;
  } else if (paymentDetails?.amount !== undefined) {
    finalAmount = Math.max(0, Number(paymentDetails.amount));
    baseAmount = finalAmount;
    discountAmount = 0;
  } else {
    const pricing = await calculatePrice(planId, durationMonths);
    baseAmount = pricing.basePrice;
    discountAmount = pricing.discountAmount;
    finalAmount = pricing.finalPrice;
  }

  const pricingSnapshot = {
    planName: plan.name,
    planCode: plan.code,
    baseMonthlyPrice: plan.baseMonthlyPrice,
    durationMonths,
    discountApplied: discountAmount,
    finalAmount,
    features: plan.features,
  };

  // Upsert Subscription
  let subscriptionDoc: any;
  if (existingSub) {
    existingSub.planId = plan._id;
    existingSub.status = SubscriptionStatus.ACTIVE;
    existingSub.startedAt = startedAt;
    existingSub.expiresAt = expiresAt;
    existingSub.graceUntil = graceUntil;
    existingSub.billingMode = 'manual';
    existingSub.currentPricingSnapshot = pricingSnapshot;
    existingSub.manualProvisioning = {
      isManual: true,
      allocatedBy: operatorId,
      allocationReason: reason,
      allocatedAt: now,
    };
    await existingSub.save({ session });
    subscriptionDoc = existingSub;
  } else {
    const createdSubs = await Subscription.create(
      [
        {
          tenantId: tenant._id,
          planId: plan._id,
          status: SubscriptionStatus.ACTIVE,
          startedAt,
          expiresAt,
          graceUntil,
          billingMode: 'manual',
          gracePeriodDays: graceDays,
          currentPricingSnapshot: pricingSnapshot,
          manualProvisioning: {
            isManual: true,
            allocatedBy: operatorId,
            allocationReason: reason,
            allocatedAt: now,
          },
        },
      ],
      { session },
    );
    const firstSub = createdSubs[0];
    if (!firstSub) {
      throw new Error('Failed to create subscription record');
    }
    subscriptionDoc = firstSub;
  }

  let paymentDoc: any;
  let invoiceDoc: IPlatformInvoice | undefined;

  // If payment details are supplied, create payment & statutory tax invoice
  if (paymentDetails) {
    const pos = resolveRecipientPlaceOfSupply({
      firmGSTIN: tenant.firmGSTIN,
      state: tenant.firmAddress,
    });

    const taxResult = calculateTaxBreakdown({
      amount: finalAmount,
      recipientStateCode: pos.stateCode,
      isTaxInclusive: paymentDetails.isTaxInclusive ?? true,
      isComplimentary,
    });

    const paymentDocs = await SubscriptionPayment.create(
      [
        {
          tenantId: tenant._id,
          subscriptionId: subscriptionDoc._id,
          planId: plan._id,
          durationMonths,
          baseAmount,
          discountAmount,
          finalAmount,
          paymentGateway: isComplimentary ? PaymentGateway.FREE : PaymentGateway.MANUAL,
          paymentStatus: PaymentStatus.COMPLETED,
          billingMode: 'manual',
          paidAt: paymentDetails.instrumentDate || now,
          taxableAmount: taxResult.taxableAmount,
          gstRate: taxResult.gstRate,
          cgstAmount: taxResult.cgstAmount,
          sgstAmount: taxResult.sgstAmount,
          igstAmount: taxResult.igstAmount,
          taxTotal: taxResult.taxTotal,
          roundOff: taxResult.roundOff,
          finalAmountPaise: taxResult.grandTotalPaise,
          manualDetails: {
            mode: paymentDetails.mode,
            utrNumber: paymentDetails.utrNumber ? paymentDetails.utrNumber.trim().toUpperCase() : undefined,
            bankName: paymentDetails.bankName?.trim(),
            depositedToAccount: paymentDetails.depositedToAccount?.trim(),
            instrumentDate: paymentDetails.instrumentDate || now,
            receiptUrl: paymentDetails.receiptUrl?.trim(),
            clearedAt: now,
            isComplimentary,
          },
          recordedBy: operatorId,
          operationalReason: reason,
        },
      ],
      { session },
    );
    const createdPayment = paymentDocs[0];
    if (!createdPayment) {
      throw new Error('Failed to create subscription payment record');
    }
    paymentDoc = createdPayment;

    // Issue statutory B2B GST tax invoice
    invoiceDoc = await createPlatformTaxInvoice(
      {
        tenant: {
          _id: tenant._id,
          firmName: tenant.firmName || tenant.businessName || 'Valued Enterprise Client',
          firmGSTIN: tenant.firmGSTIN || '',
          firmAddress: tenant.firmAddress || '',
          firmPhone: tenant.firmPhone || '',
          firmEmail: tenant.email || '',
        },
        plan: {
          _id: plan._id,
          name: plan.name,
          code: plan.code,
          description: plan.description,
          baseMonthlyPrice: plan.baseMonthlyPrice,
        },
        subscriptionId: subscriptionDoc._id,
        paymentId: paymentDoc._id,
        paymentMode: paymentDetails.mode,
        utrNumber: paymentDetails.utrNumber?.trim().toUpperCase(),
        paidAt: paymentDoc.paidAt,
        durationMonths,
        taxableAmount: taxResult.taxableAmount,
        grossAmount: taxResult.grandTotal,
        discount: discountAmount,
        isTaxInclusive: paymentDetails.isTaxInclusive ?? true,
        isComplimentary,
        issuedBy: operatorId,
        invoiceDate: now,
      },
      session,
    );

    paymentDoc.platformInvoiceId = invoiceDoc._id;
    paymentDoc.platformInvoiceNumber = invoiceDoc.invoiceNumber;
    await paymentDoc.save({ session });

    subscriptionDoc.lastPaymentId = paymentDoc._id;
    subscriptionDoc.lastInvoiceId = invoiceDoc._id;
    await subscriptionDoc.save({ session });
  }

  // Audit Log
  await logPlatformAudit(
    {
      scope: `tenant:${tenant._id.toString()}`,
      actorId: operatorId,
      actorEmail: operatorEmail,
      actorRole: operatorRole,
      action: 'SUBSCRIPTION_MANUAL_ALLOCATION',
      targetType: 'Subscription',
      targetId: subscriptionDoc._id.toString(),
      targetTenantId: tenant._id,
      reason,
      before: beforeState,
      after: {
        subscriptionId: subscriptionDoc._id.toString(),
        planId: plan._id.toString(),
        status: subscriptionDoc.status,
        expiresAt: subscriptionDoc.expiresAt,
        paymentId: paymentDoc?._id?.toString(),
        invoiceNumber: invoiceDoc?.invoiceNumber,
      },
      ipAddress,
      userAgent,
      severity: 'INFO',
    },
    session,
  );

  return {
    subscription: subscriptionDoc,
    payment: paymentDoc,
    invoice: invoiceDoc,
  };
}

/**
 * Public method: Allocates subscription within an auto-retrying ACID transaction.
 */
export async function allocateSubscriptionWithTransaction(
  dto: AllocateSubscriptionDTO,
  existingSession?: ClientSession,
): Promise<AllocationResult> {
  const result = await runInTransaction(async (session) => {
    return await allocateSubscriptionInternal(dto, session);
  }, existingSession);

  // Background non-blocking tasks after successful transaction commit
  try {
    await scheduleExpiryNotifications(
      dto.tenantId,
      result.subscription._id.toString(),
      result.subscription.expiresAt,
    );
  } catch (err) {
    console.warn('[ManualSubscription] Failed to schedule expiry notifications:', err);
  }

  invalidateSubscriptionCache(dto.tenantId);
  invalidatePlatformDashboardCache();

  return result;
}

export interface RecordSubscriptionPaymentDTO {
  subscriptionId: string;
  operatorId: Types.ObjectId;
  operatorEmail: string;
  operatorRole: string;
  reason: string;
  planId?: string;
  durationMonths: number;
  paymentDetails: ManualPaymentDetailsInput;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Handles renewal or plan change for an existing subscription.
 */
export async function recordSubscriptionPaymentWithTransaction(
  dto: RecordSubscriptionPaymentDTO,
  existingSession?: ClientSession,
): Promise<AllocationResult> {
  const {
    subscriptionId,
    operatorId,
    operatorEmail,
    operatorRole,
    reason,
    planId: overridePlanId,
    durationMonths,
    paymentDetails,
    ipAddress,
    userAgent,
  } = dto;

  if (!subscriptionId || !Types.ObjectId.isValid(subscriptionId)) {
    throw new Error('Valid Subscription ID is required');
  }
  if (!durationMonths || durationMonths < 1) {
    throw new Error('Duration in months must be at least 1');
  }
  if (!reason || reason.trim().length < 10) {
    throw new Error('Operational reason must be at least 10 characters');
  }

  const result = await runInTransaction(async (session) => {
    const subscription = await Subscription.findById(subscriptionId).session(session);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    const tenantId = subscription.tenantId.toString();
    const effectivePlanId = overridePlanId || subscription.planId.toString();

    return await allocateSubscriptionInternal(
      {
        tenantId,
        planId: effectivePlanId,
        durationMonths,
        operatorId,
        operatorEmail,
        operatorRole,
        reason,
        paymentDetails,
        ipAddress,
        userAgent,
      },
      session,
    );
  }, existingSession);

  try {
    await scheduleExpiryNotifications(
      result.subscription.tenantId.toString(),
      result.subscription._id.toString(),
      result.subscription.expiresAt,
    );
  } catch (err) {
    console.warn('[ManualSubscription] Failed to schedule expiry notifications:', err);
  }

  invalidateSubscriptionCache(result.subscription.tenantId.toString());
  invalidatePlatformDashboardCache();

  return result;
}

export interface ApproveManualPaymentRequestDTO {
  requestId: string;
  operatorId: Types.ObjectId;
  operatorEmail: string;
  operatorRole: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApproveManualPaymentResult {
  request: ISubscriptionManualRequest;
  allocation: AllocationResult;
}

/**
 * Optimistically locks and approves a tenant payment proof request.
 */
export async function approveManualPaymentRequestWithTransaction(
  dto: ApproveManualPaymentRequestDTO,
  existingSession?: ClientSession,
): Promise<ApproveManualPaymentResult> {
  const { requestId, operatorId, operatorEmail, operatorRole, reason, ipAddress, userAgent } = dto;

  if (!requestId || !Types.ObjectId.isValid(requestId)) {
    throw new Error('Valid Request ID is required');
  }
  if (!reason || reason.trim().length < 10) {
    throw new Error('Operational reason must be at least 10 characters');
  }

  // 1. Optimistic OCC claim on request to prevent double-processing races
  const claimedRequest = await SubscriptionManualRequest.findOneAndUpdate(
    { _id: requestId, status: 'PENDING' },
    { $set: { status: 'PROCESSING', lockedBy: operatorId, lockedAt: new Date() } },
    { new: true },
  );

  if (!claimedRequest) {
    throw new Error('Payment request not found or not in PENDING state');
  }

  let allocationResult: AllocationResult;

  try {
    allocationResult = await runInTransaction(async (session) => {
      const allocation = await allocateSubscriptionInternal(
        {
          tenantId: claimedRequest.tenantId.toString(),
          planId: claimedRequest.planId.toString(),
          durationMonths: claimedRequest.durationMonths,
          operatorId,
          operatorEmail,
          operatorRole,
          reason: `Manual request verification approved (UTR: ${claimedRequest.utrNumber}). ${reason}`,
          paymentDetails: {
            mode: claimedRequest.paymentMode as any,
            utrNumber: claimedRequest.utrNumber,
            bankName: claimedRequest.bankName,
            instrumentDate: claimedRequest.paymentDate,
            receiptUrl: claimedRequest.proofDocumentUrl,
            amount: claimedRequest.declaredAmount,
            isComplimentary: false,
            isTaxInclusive: true,
          },
          ipAddress,
          userAgent,
        },
        session,
      );

      claimedRequest.status = 'APPROVED';
      claimedRequest.resolvedPaymentId = allocation.payment?._id;
      claimedRequest.resolvedInvoiceId = allocation.invoice?._id;
      await claimedRequest.save({ session });

      // Tenant in-app notification
      await createNotification(
        claimedRequest.tenantId.toString(),
        NotificationType.SUBSCRIPTION_ACTIVATED,
        'Subscription Activated',
        `Your offline payment of ₹${claimedRequest.declaredAmount} (UTR: ${claimedRequest.utrNumber}) has been verified. Subscription activated successfully!`,
        {
          subscriptionId: allocation.subscription._id,
          invoiceId: allocation.invoice?._id,
          paymentId: allocation.payment?._id,
        },
      );

      // Audit Log
      await logPlatformAudit(
        {
          scope: `tenant:${claimedRequest.tenantId.toString()}`,
          actorId: operatorId,
          actorEmail: operatorEmail,
          actorRole: operatorRole,
          action: 'SUBSCRIPTION_MANUAL_REQUEST_APPROVED',
          targetType: 'SubscriptionManualRequest',
          targetId: claimedRequest._id.toString(),
          targetTenantId: claimedRequest.tenantId,
          reason,
          after: {
            status: 'APPROVED',
            utrNumber: claimedRequest.utrNumber,
            resolvedInvoiceId: allocation.invoice?._id?.toString(),
            resolvedPaymentId: allocation.payment?._id?.toString(),
          },
          ipAddress,
          userAgent,
          severity: 'INFO',
        },
        session,
      );

      return allocation;
    }, existingSession);
  } catch (err) {
    // Release the lock if transaction failed
    await SubscriptionManualRequest.updateOne(
      { _id: requestId, status: 'PROCESSING' },
      { $set: { status: 'PENDING', lockedBy: null, lockedAt: null } },
    );
    throw err;
  }

  try {
    await scheduleExpiryNotifications(
      claimedRequest.tenantId.toString(),
      allocationResult.subscription._id.toString(),
      allocationResult.subscription.expiresAt,
    );
  } catch (err) {
    console.warn('[ManualSubscription] Failed to schedule expiry notifications:', err);
  }

  invalidateSubscriptionCache(claimedRequest.tenantId.toString());
  invalidatePlatformDashboardCache();

  return {
    request: claimedRequest,
    allocation: allocationResult,
  };
}

export interface RejectManualPaymentRequestDTO {
  requestId: string;
  operatorId: Types.ObjectId;
  operatorEmail: string;
  operatorRole: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Rejects a tenant payment proof request with operator reason.
 */
export async function rejectManualPaymentRequest(
  dto: RejectManualPaymentRequestDTO,
): Promise<ISubscriptionManualRequest> {
  const { requestId, operatorId, operatorEmail, operatorRole, reason, ipAddress, userAgent } = dto;

  if (!requestId || !Types.ObjectId.isValid(requestId)) {
    throw new Error('Valid Request ID is required');
  }
  if (!reason || reason.trim().length < 10) {
    throw new Error('Operational rejection reason must be at least 10 characters');
  }

  const request = await SubscriptionManualRequest.findById(requestId);
  if (!request) {
    throw new Error(`Payment request with ID ${requestId} not found`);
  }
  if (request.status === 'APPROVED') {
    throw new Error('Cannot reject a request that has already been approved');
  }
  if (request.status === 'REJECTED') {
    throw new Error('Payment request has already been rejected');
  }

  request.status = 'REJECTED';
  request.rejectionReason = reason;
  request.lockedBy = operatorId;
  request.lockedAt = new Date();
  await request.save();

  // Tenant notification
  await createNotification(
    request.tenantId.toString(),
    NotificationType.SYSTEM,
    'Subscription Payment Proof Rejected',
    `Your offline payment verification (UTR: ${request.utrNumber}) could not be verified. Reason: ${reason}`,
    { requestId: request._id },
  );

  // Platform Audit
  await logPlatformAudit({
    scope: `tenant:${request.tenantId.toString()}`,
    actorId: operatorId,
    actorEmail: operatorEmail,
    actorRole: operatorRole,
    action: 'SUBSCRIPTION_MANUAL_REQUEST_REJECTED',
    targetType: 'SubscriptionManualRequest',
    targetId: request._id.toString(),
    targetTenantId: request.tenantId,
    reason,
    after: {
      status: 'REJECTED',
      utrNumber: request.utrNumber,
      rejectionReason: reason,
    },
    ipAddress,
    userAgent,
    severity: 'WARNING',
  });

  return request;
}
