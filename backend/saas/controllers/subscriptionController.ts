/**
 * Subscription Controller — checkout, payment verification, status.
 *
 * Integrates with Razorpay for payment processing.
 */

import type { Response, NextFunction } from 'express';
import type { SaaSRequest } from '../types';
import crypto from 'crypto';
import Plan from '../models/Plan';
import SubscriptionPayment from '../models/SubscriptionPayment';
import PlatformInvoice from '../models/PlatformInvoice';
import SubscriptionManualRequest from '../models/SubscriptionManualRequest';
import { Types } from 'mongoose';
import { PaymentStatus, PaymentGateway, NotificationType } from '../shared/features';
import { calculatePrice } from '../services/pricingService';
import {
  applyAutoRenewalCycle,
  activateSubscription,
  getActiveSubscription,
  getPaymentHistory,
  updateAutoRenewStatus,
} from '../services/subscriptionService';
import { getSubscriptionInfo } from '../services/featureService';
import { processReferralReward } from '../services/referralService';
import { createNotification } from '../services/notificationService';

const getTenantId = require('../../utils/getTenantId');
const Admin = require('../../models/Admin');
import {
  verifyPaymentSignature,
  processRazorpayWebhook,
} from '../../../admin/backend/services/platformSubscriptionService';

// ─── Razorpay SDK (lazy-loaded) ──────────────────────────────────

let razorpayInstance: any = null;

function getRazorpay() {
  if (!razorpayInstance) {
    try {
      const Razorpay = require('razorpay');
      razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    } catch {
      console.warn(
        'Razorpay SDK not installed. Run: npm install razorpay',
      );
    }
  }
  return razorpayInstance;
}

function toPaise(amount: number): number {
  return Math.round(Number(amount || 0) * 100);
}

function getAutoRenewTotalCount(durationMonths: number): number {
  const maxYears = Number(process.env.RAZORPAY_SUBSCRIPTION_MAX_YEARS || 10);
  const maxMonths = Math.max(12, maxYears * 12);
  return Math.max(1, Math.floor(maxMonths / durationMonths));
}

async function getOrCreateRazorpayPlan(
  razorpay: any,
  plan: any,
  durationMonths: number,
  pricing: { finalPrice: number },
): Promise<string> {
  const metadata = plan.metadata || {};
  const amountPaise = toPaise(pricing.finalPrice);
  const cacheKey = `${durationMonths}_${amountPaise}`;
  const existingPlanId = metadata?.razorpayPlanIds?.[cacheKey];
  if (existingPlanId) return existingPlanId;

  const razorpayPlan = await razorpay.plans.create({
    period: 'monthly',
    interval: durationMonths,
    item: {
      name: `${plan.name} - ${durationMonths} month${durationMonths > 1 ? 's' : ''}`,
      amount: amountPaise,
      currency: 'INR',
      description: plan.description || `Bharat Enterprise ${plan.name} subscription`,
    },
    notes: {
      localPlanId: plan._id.toString(),
      planCode: plan.code,
      durationMonths: String(durationMonths),
      billingMode: 'auto',
    },
  });

  await Plan.findByIdAndUpdate(plan._id, {
    $set: {
      [`metadata.razorpayPlanIds.${cacheKey}`]: razorpayPlan.id,
    },
  });

  return razorpayPlan.id;
}

function unixToDate(value?: number | null): Date | null {
  return value ? new Date(value * 1000) : null;
}

async function fetchRazorpaySubscription(
  razorpay: any,
  gatewaySubscriptionId?: string,
): Promise<Record<string, any> | null> {
  if (!razorpay || !gatewaySubscriptionId) return null;

  try {
    return await razorpay.subscriptions.fetch(gatewaySubscriptionId);
  } catch (err) {
    console.error('Failed to fetch Razorpay subscription:', err);
    return null;
  }
}

/**
 * GET /api/saas/subscription
 * Returns the current tenant's subscription info.
 */
export async function getSubscription(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const info = await getSubscriptionInfo(tenantId.toString());
    const subscription = await getActiveSubscription(tenantId.toString());

    // Look up latest pending offline/manual payment request if any
    const pendingPayment = await SubscriptionPayment.findOne({
      tenantId,
      paymentGateway: PaymentGateway.MANUAL,
      paymentStatus: PaymentStatus.PENDING,
    })
      .populate('planId', 'name code baseMonthlyPrice description')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      subscription: subscription || null,
      info,
      pendingPayment: pendingPayment || null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/saas/subscription/checkout
 * Initiate a subscription purchase.
 *
 * Body: { planId, durationMonths }
 * Returns: Razorpay order details for frontend payment form.
 */
export async function checkout(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const { planId, durationMonths, autoRenew = false } = req.body;

    if (!planId || !durationMonths) {
      res.status(400).json({
        success: false,
        message: 'planId and durationMonths are required',
      });
      return;
    }

    // Validate plan
    const plan = await Plan.findOne({ _id: planId, active: true }).lean();
    if (!plan) {
      res.status(404).json({ success: false, message: 'Plan not found' });
      return;
    }

    // Calculate price
    const pricing = await calculatePrice(planId, durationMonths);

    const razorpay = getRazorpay();
    if (!razorpay) {
      res.status(503).json({
        success: false,
        message: 'Payment gateway not configured',
      });
      return;
    }

    if (autoRenew === true) {
      const gatewayPlanId = await getOrCreateRazorpayPlan(
        razorpay,
        plan,
        Number(durationMonths),
        pricing,
      );

      const gatewaySubscription = await razorpay.subscriptions.create({
        plan_id: gatewayPlanId,
        total_count: getAutoRenewTotalCount(Number(durationMonths)),
        quantity: 1,
        customer_notify: true,
        notes: {
          tenantId: tenantId.toString(),
          planId: plan._id.toString(),
          planName: plan.name,
          durationMonths: String(durationMonths),
          billingMode: 'auto',
        },
      });

      const payment = await SubscriptionPayment.create({
        tenantId,
        planId: plan._id,
        durationMonths,
        baseAmount: pricing.basePrice,
        discountAmount: pricing.discountAmount,
        finalAmount: pricing.finalPrice,
        paymentGateway: PaymentGateway.RAZORPAY,
        gatewaySubscriptionId: gatewaySubscription.id,
        paymentStatus: PaymentStatus.PENDING,
        billingMode: 'auto',
        metadata: {
          gatewayPlanId,
          gatewaySubscriptionStatus: gatewaySubscription.status,
        },
      });

      res.status(200).json({
        success: true,
        checkoutType: 'subscription',
        subscription: {
          id: gatewaySubscription.id,
          status: gatewaySubscription.status,
          shortUrl: gatewaySubscription.short_url,
        },
        paymentId: payment._id,
        plan: {
          name: plan.name,
          code: plan.code,
        },
        pricing,
        key: process.env.RAZORPAY_KEY_ID,
      });
      return;
    }

    // Create Razorpay order for manual, one-time renewal.
    const order = await razorpay.orders.create({
      amount: toPaise(pricing.finalPrice), // Razorpay uses paise
      currency: 'INR',
      receipt: `sub_${Date.now()}_${tenantId.toString().slice(-4)}`,
      notes: {
        tenantId: tenantId.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
        durationMonths: String(durationMonths),
      },
    });

    // Create pending payment record
    const payment = await SubscriptionPayment.create({
      tenantId,
      planId: plan._id,
      durationMonths,
      baseAmount: pricing.basePrice,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalPrice,
      paymentGateway: PaymentGateway.RAZORPAY,
      gatewayOrderId: order.id,
      paymentStatus: PaymentStatus.PENDING,
      billingMode: 'manual',
    });

    res.status(200).json({
      success: true,
      checkoutType: 'order',
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      paymentId: payment._id,
      plan: {
        name: plan.name,
        code: plan.code,
      },
      pricing,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/saas/subscription/verify
 * Verify Razorpay payment and activate subscription.
 *
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId }
 */
export async function verifyPayment(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const {
      razorpay_order_id,
      razorpay_subscription_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId,
    } = req.body;
    const isAutoRenew = Boolean(razorpay_subscription_id);

    if (
      (!razorpay_order_id && !razorpay_subscription_id) ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !paymentId
    ) {
      res.status(400).json({
        success: false,
        message: 'Missing payment verification fields',
      });
      return;
    }

    const paymentQuery: Record<string, unknown> = {
      _id: paymentId,
      tenantId,
    };
    if (isAutoRenew) {
      paymentQuery.gatewaySubscriptionId = razorpay_subscription_id;
    } else {
      paymentQuery.gatewayOrderId = razorpay_order_id;
    }

    const payment = await SubscriptionPayment.findOne(paymentQuery);

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment record not found or already processed',
      });
      return;
    }

    if (payment.paymentStatus === PaymentStatus.COMPLETED) {
      const activeSubscription = await getActiveSubscription(tenantId.toString());
      res.status(200).json({
        success: true,
        message: 'Payment already verified and subscription activated',
        subscription: activeSubscription,
        proratedDaysAdded: 0,
      });
      return;
    }

    // Verify signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      res.status(503).json({
        success: false,
        message: 'Payment gateway not configured',
      });
      return;
    }

    const signatureValid = isAutoRenew
      ? verifyPaymentSignature({
          subscriptionId: razorpay_subscription_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          secret: keySecret,
        })
      : verifyPaymentSignature({
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          secret: keySecret,
        });

    if (!signatureValid) {
      // Mark payment as failed
      payment.paymentStatus = PaymentStatus.FAILED;
      await payment.save();

      res.status(400).json({
        success: false,
        message: 'Payment verification failed — invalid signature',
      });
      return;
    }

    // Payment verified — atomically update payment record to prevent duplicate concurrent verification races
    const claimedPayment = await SubscriptionPayment.findOneAndUpdate(
      {
        _id: payment._id,
        paymentStatus: { $ne: PaymentStatus.COMPLETED },
      },
      {
        $set: {
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          ...(isAutoRenew
            ? { gatewaySubscriptionId: razorpay_subscription_id, billingMode: 'auto' }
            : {}),
          paymentStatus: PaymentStatus.COMPLETED,
          paidAt: new Date(),
        },
      },
      { new: true },
    );

    if (!claimedPayment) {
      // Payment was already claimed and activated by a concurrent verify call or webhook
      const activeSubscription = await getActiveSubscription(tenantId.toString());
      res.status(200).json({
        success: true,
        message: 'Payment already verified and subscription activated',
        subscription: activeSubscription,
        proratedDaysAdded: 0,
      });
      return;
    }

    const razorpay = getRazorpay();
    const gatewaySubscription = await fetchRazorpaySubscription(
      razorpay,
      razorpay_subscription_id,
    );

    // Activate subscription
    const { subscription, proratedDaysAdded, isUpgrade } = await activateSubscription(
      tenantId.toString(),
      payment.planId.toString(),
      payment.durationMonths,
      payment._id.toString(),
      {
        autoRenew: isAutoRenew,
        gatewaySubscriptionId: razorpay_subscription_id,
        gatewayPlanId:
          gatewaySubscription?.plan_id ||
          payment.metadata?.gatewayPlanId,
        gatewayCustomerId: gatewaySubscription?.customer_id,
        nextChargeAt: unixToDate(gatewaySubscription?.charge_at),
        autoRenewStatus: gatewaySubscription?.status,
      },
    );

    // Process referral reward (if this is first paid subscription)
    try {
      await processReferralReward(tenantId.toString());
    } catch (err) {
      console.error('Referral reward processing failed:', err);
      // Don't block subscription activation
    }

    // Create activation notification
    let notificationText = `Your ${subscription.currentPricingSnapshot.planName} plan is now active for ${payment.durationMonths} month(s).`;
    if (isUpgrade && proratedDaysAdded > 0) {
      notificationText += ` Your remaining balance was converted to an additional ${Math.round(proratedDaysAdded)} days of your new plan.`;
    } else if (!isUpgrade && proratedDaysAdded > 0) {
      notificationText += ` Your remaining ${Math.round(proratedDaysAdded)} days were carried over.`;
    }

    await createNotification(
      tenantId.toString(),
      NotificationType.SUBSCRIPTION_ACTIVATED,
      'Subscription Activated!',
      notificationText,
      { subscriptionId: subscription._id },
    );

    res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated',
      subscription,
      proratedDaysAdded,
    });
  } catch (error) {
    next(error);
  }
}

async function activatePendingAutoRenewPayment(
  payment: any,
  paymentEntity: Record<string, any>,
  gatewaySubscription: Record<string, any> | null,
  eventId?: string,
): Promise<void> {
  payment.gatewayPaymentId = paymentEntity?.id;
  payment.gatewayInvoiceId = paymentEntity?.invoice_id;
  payment.paymentStatus = PaymentStatus.COMPLETED;
  payment.billingMode = 'auto';
  payment.gatewayEventId = eventId;
  payment.paidAt = paymentEntity?.created_at
    ? new Date(paymentEntity.created_at * 1000)
    : new Date();
  payment.metadata = {
    ...(payment.metadata || {}),
    gatewaySubscriptionStatus: gatewaySubscription?.status,
    method: paymentEntity?.method,
  };
  await payment.save();

  const tenantId = payment.tenantId.toString();
  const { subscription, proratedDaysAdded, isUpgrade } = await activateSubscription(
    tenantId,
    payment.planId.toString(),
    payment.durationMonths,
    payment._id.toString(),
    {
      autoRenew: true,
      gatewaySubscriptionId: payment.gatewaySubscriptionId,
      gatewayPlanId:
        gatewaySubscription?.plan_id ||
        payment.metadata?.gatewayPlanId,
      gatewayCustomerId: gatewaySubscription?.customer_id,
      nextChargeAt: unixToDate(gatewaySubscription?.charge_at),
      autoRenewStatus: gatewaySubscription?.status,
    },
  );

  try {
    await processReferralReward(tenantId);
  } catch (err) {
    console.error('Referral reward processing failed:', err);
  }

  let notificationText = `Your ${subscription.currentPricingSnapshot.planName} plan is now active with auto-renewal enabled.`;
  if (isUpgrade && proratedDaysAdded > 0) {
    notificationText += ` Your remaining balance was converted to an additional ${Math.round(proratedDaysAdded)} days of your new plan.`;
  } else if (!isUpgrade && proratedDaysAdded > 0) {
    notificationText += ` Your remaining ${Math.round(proratedDaysAdded)} days were carried over.`;
  }

  await createNotification(
    tenantId,
    NotificationType.SUBSCRIPTION_ACTIVATED,
    'Subscription Activated!',
    notificationText,
    { subscriptionId: subscription._id, autoRenew: true },
  );
}

/**
 * POST /api/saas/subscription/webhook
 * Public Razorpay webhook endpoint for subscription auto-renewals.
 */
export async function handleRazorpayWebhook(
  req: any,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const signature = (req.headers['x-razorpay-signature'] ||
      req.headers['X-Razorpay-Signature']) as string | undefined;
    const eventId = (req.headers['x-razorpay-event-id'] ||
      req.headers['X-Razorpay-Event-Id']) as string | undefined;

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

    const result = await processRazorpayWebhook(rawBody, signature, eventId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/saas/subscription/history
 * Returns payment history for the tenant.
 */
export async function getHistory(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const payments = await getPaymentHistory(tenantId.toString());

    res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/saas/subscription/bank-details
 * Returns verified company bank transfer and UPI details for manual/offline payments.
 */
export async function getBankDetails(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json({
      success: true,
      data: {
        bankName: process.env.COMPANY_BANK_NAME || 'HDFC Bank',
        accountName:
          process.env.COMPANY_BANK_ACCOUNT_NAME || 'Bharat Enterprise Technologies Pvt Ltd',
        accountNumber: process.env.COMPANY_BANK_ACCOUNT_NO || '50200088921134',
        ifscCode: process.env.COMPANY_BANK_IFSC || 'HDFC0000240',
        branchName: process.env.COMPANY_BANK_BRANCH || 'Bandra Kurla Complex Mumbai',
        accountType: 'Current Account',
        upiId: process.env.COMPANY_UPI_ID || 'bharatenterprise@hdfcbank',
        qrPayload:
          'upi://pay?pa=bharatenterprise@hdfcbank&pn=Bharat%20Enterprise%20Technologies%20Pvt%20Ltd&cu=INR',
        companyGstin: process.env.PLATFORM_COMPANY_GSTIN || '27AAPCB1234F1Z5',
        companyPan: process.env.PLATFORM_COMPANY_PAN || 'AAPCB1234F',
        supportEmail: process.env.PLATFORM_SUPPORT_EMAIL || 'billing@bharatenterprise.com',
        supportPhone: process.env.PLATFORM_SUPPORT_PHONE || '+91 22 6984 0000',
        instructions:
          'Transfer exact subscription amount via IMPS/NEFT/RTGS/UPI. After payment, submit your UTR / Reference number below for immediate statutory verification and invoice generation.',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/saas/subscription/manual-request
 * Submit bank transfer (NEFT/RTGS/IMPS/UPI) or offline payment proof.
 */
export async function submitManualRequest(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const {
      planId,
      durationMonths,
      paymentMode = 'UPI',
      utrNumber,
      paymentDate,
      amountPaid,
      declaredAmount,
      bankName = '',
      notes = '',
      promoCode = '',
      proofDocumentUrl = '',
    } = req.body;

    if (!planId || !durationMonths) {
      res.status(400).json({
        success: false,
        message: 'planId and durationMonths are required',
      });
      return;
    }

    if (!utrNumber || !String(utrNumber).trim()) {
      res.status(400).json({
        success: false,
        message: 'UTR or Transaction Reference Number is required',
      });
      return;
    }

    const cleanUtr = String(utrNumber).trim().toUpperCase();
    const effectiveAmount = declaredAmount !== undefined ? declaredAmount : amountPaid;
    const cleanAmount = Number(effectiveAmount);

    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Valid amount paid in rupees is required',
      });
      return;
    }

    const parsedMonths = Number(durationMonths);
    if (![1, 3, 6, 12].includes(parsedMonths)) {
      res.status(400).json({
        success: false,
        message: 'durationMonths must be 1, 3, 6, or 12',
      });
      return;
    }

    // Validate plan
    const plan = await Plan.findOne({ _id: planId, active: true }).lean();
    if (!plan) {
      res.status(404).json({ success: false, message: 'Plan not found' });
      return;
    }

    // Calculate official pricing
    const pricing = await calculatePrice(planId, parsedMonths);

    // Check if duplicate request with this UTR already exists
    const duplicateRequest = await SubscriptionManualRequest.findOne({
      utrNumber: cleanUtr,
      status: { $in: ['PENDING', 'PROCESSING', 'APPROVED'] },
    });

    if (duplicateRequest) {
      res.status(409).json({
        success: false,
        message: 'A payment verification request with this UTR reference number already exists.',
      });
      return;
    }

    // Check if completed payment with this UTR exists in SubscriptionPayment
    const existingCompleted = await SubscriptionPayment.findOne({
      $or: [
        { 'manualDetails.utrNumber': cleanUtr, paymentStatus: PaymentStatus.COMPLETED },
        { 'metadata.utrNumber': cleanUtr, paymentStatus: PaymentStatus.COMPLETED },
      ],
    }).lean();

    if (existingCompleted) {
      res.status(409).json({
        success: false,
        message: 'A verified payment with this UTR reference number already exists.',
      });
      return;
    }

    const cleanPaymentMode = String(paymentMode).toUpperCase();
    const validModes = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'CHEQUE', 'CASH'];
    const finalMode = validModes.includes(cleanPaymentMode) ? cleanPaymentMode : 'UPI';

    // 1. Create statutory SubscriptionManualRequest in queue
    const manualRequest = await SubscriptionManualRequest.create({
      tenantId,
      planId: plan._id,
      durationMonths: parsedMonths,
      declaredAmount: cleanAmount,
      paymentMode: finalMode as any,
      utrNumber: cleanUtr,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      bankName: String(bankName || '').trim() || undefined,
      proofDocumentUrl: proofDocumentUrl ? String(proofDocumentUrl).trim() : undefined,
      notes: String(notes || '').trim() || undefined,
      appliedPromoCode: promoCode ? String(promoCode).trim().toUpperCase() : undefined,
      status: 'PENDING',
    });

    // 2. Backward compatibility: also sync pending SubscriptionPayment
    const existingPending = await SubscriptionPayment.findOne({
      tenantId,
      paymentGateway: PaymentGateway.MANUAL,
      paymentStatus: PaymentStatus.PENDING,
    });

    const paymentMetadata = {
      paymentMode: finalMode,
      utrNumber: cleanUtr,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amountPaid: cleanAmount,
      bankName: String(bankName || '').trim(),
      notes: String(notes || '').trim(),
      promoCode: String(promoCode || '').trim().toUpperCase(),
      submittedAt: new Date(),
      manualRequestId: manualRequest._id,
    };

    let payment;
    if (existingPending) {
      existingPending.planId = plan._id;
      existingPending.durationMonths = parsedMonths;
      existingPending.baseAmount = pricing.basePrice;
      existingPending.discountAmount = pricing.discountAmount;
      existingPending.finalAmount = cleanAmount;
      existingPending.manualDetails = {
        mode: finalMode as any,
        utrNumber: cleanUtr,
        bankName: String(bankName || '').trim() || undefined,
        instrumentDate: paymentDate ? new Date(paymentDate) : new Date(),
        receiptUrl: proofDocumentUrl ? String(proofDocumentUrl).trim() : undefined,
        isComplimentary: false,
      };
      existingPending.metadata = {
        ...(existingPending.metadata || {}),
        ...paymentMetadata,
      };
      payment = await existingPending.save();
    } else {
      payment = await SubscriptionPayment.create({
        tenantId,
        planId: plan._id,
        durationMonths: parsedMonths,
        baseAmount: pricing.basePrice,
        discountAmount: pricing.discountAmount,
        finalAmount: cleanAmount,
        paymentGateway: PaymentGateway.MANUAL,
        paymentStatus: PaymentStatus.PENDING,
        billingMode: 'manual',
        gatewayPaymentId: `MANUAL_${cleanUtr}_${Date.now()}`,
        manualDetails: {
          mode: finalMode as any,
          utrNumber: cleanUtr,
          bankName: String(bankName || '').trim() || undefined,
          instrumentDate: paymentDate ? new Date(paymentDate) : new Date(),
          receiptUrl: proofDocumentUrl ? String(proofDocumentUrl).trim() : undefined,
          isComplimentary: false,
        },
        metadata: paymentMetadata,
      });
    }

    // In-app confirmation notification for tenant
    try {
      await createNotification(
        tenantId.toString(),
        NotificationType.SYSTEM,
        'Payment Proof Submitted',
        `Your offline payment proof (UTR: ${cleanUtr}) of ₹${cleanAmount.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} has been received. Admin verification usually takes 15–30 minutes.`,
        { paymentId: payment._id, requestId: manualRequest._id, utrNumber: cleanUtr },
      );
    } catch (notifErr) {
      console.warn('Notification creation warning:', notifErr);
    }

    res.status(200).json({
      success: true,
      message: 'Payment request submitted successfully! Your UTR is being verified by admin.',
      data: manualRequest,
      payment,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/saas/subscription/manual-requests
 * Returns tenant's submitted requests and current verification status.
 */
export async function getTenantManualRequests(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      SubscriptionManualRequest.find({ tenantId })
        .populate('planId', 'name code baseMonthlyPrice description')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SubscriptionManualRequest.countDocuments({ tenantId }),
    ]);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/saas/subscription/pending-request
 * Get the current tenant's active pending payment request, if any.
 */
export async function getPendingRequest(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);

    // First check SubscriptionManualRequest
    const pendingManualRequest = await SubscriptionManualRequest.findOne({
      tenantId,
      status: { $in: ['PENDING', 'PROCESSING'] },
    })
      .populate('planId', 'name code baseMonthlyPrice description')
      .sort({ createdAt: -1 })
      .lean();

    if (pendingManualRequest) {
      res.status(200).json({
        success: true,
        pendingRequest: pendingManualRequest,
        data: pendingManualRequest,
      });
      return;
    }

    // Fallback to legacy SubscriptionPayment
    const pendingPayment = await SubscriptionPayment.findOne({
      tenantId,
      paymentGateway: PaymentGateway.MANUAL,
      paymentStatus: PaymentStatus.PENDING,
    })
      .populate('planId', 'name code baseMonthlyPrice description')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      pendingRequest: pendingPayment || null,
      data: pendingPayment || null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to build statutory GST Tax Invoice DTO from a completed SubscriptionPayment
 */
function buildTaxInvoiceDTO(payment: any, index: number, tenant: any) {
  const finalAmount = Number(payment.finalAmount || 0);
  const taxableAmount = Math.round((finalAmount / 1.18) * 100) / 100;
  const totalTax = Math.round((finalAmount - taxableAmount) * 100) / 100;

  const tenantState = String(tenant?.state || '').toLowerCase();
  const isInterState =
    tenantState &&
    !tenantState.includes('maharashtra') &&
    !tenantState.includes('mh') &&
    tenantState !== '27';

  const cgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const sgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const igst = isInterState ? totalTax : 0;

  const dateObj = payment.paidAt || payment.createdAt || new Date();
  const year = new Date(dateObj).getFullYear();
  const nextYearShort = String(year + 1).slice(-2);
  const fyPrefix = `BE/${String(year).slice(-2)}-${nextYearShort}`;
  const invoiceNumber =
    payment.platformInvoiceNumber ||
    payment.metadata?.taxInvoiceNumber ||
    `${fyPrefix}/${String(1001 + index).padStart(5, '0')}`;

  return {
    _id: payment._id.toString(),
    invoiceNumber,
    invoiceDate: dateObj,
    planName: payment.planId?.name || 'Professional Plan',
    planCode: payment.planId?.code || 'professional',
    description: `Bharat Enterprise SaaS — ${payment.planId?.name || 'Professional'} Subscription`,
    sacCode: '998313',
    sacDescription: 'Information Technology Software as a Service (SaaS)',
    durationMonths: payment.durationMonths || 1,
    taxableAmount,
    gstRate: 18,
    cgstRate: isInterState ? 0 : 9,
    cgstAmount: cgst,
    sgstRate: isInterState ? 0 : 9,
    sgstAmount: sgst,
    igstRate: isInterState ? 18 : 0,
    igstAmount: igst,
    totalTax,
    totalAmount: finalAmount,
    roundOff: Math.round((finalAmount - (taxableAmount + totalTax)) * 100) / 100,
    status: 'ISSUED',
    paymentMode:
      payment.manualDetails?.mode ||
      payment.metadata?.paymentMode ||
      (payment.paymentGateway === PaymentGateway.RAZORPAY
        ? 'ONLINE / RAZORPAY'
        : 'BANK_TRANSFER'),
    utrNumber:
      payment.manualDetails?.utrNumber ||
      payment.metadata?.utrNumber ||
      payment.gatewayPaymentId ||
      'VERIFIED',
    paidDate: payment.paidAt || payment.createdAt || new Date(),
    seller: {
      companyName: 'Bharat Enterprise Technologies Pvt. Ltd.',
      address: 'BKC Tech Park, Bandra Kurla Complex, Bandra East, Mumbai - 400051',
      state: 'Maharashtra (27)',
      stateCode: '27',
      gstin: '27AAPCB1234F1Z5',
      pan: 'AAPCB1234F',
      cin: 'U72900MH2024PTC123456',
      supportEmail: 'billing@bharatenterprise.com',
      website: 'www.bharatenterprise.com',
    },
    buyer: {
      firmName: tenant?.firmName || tenant?.name || 'Subscribed Business',
      contactPerson: tenant?.name || '',
      email: tenant?.email || '',
      phone: tenant?.firmPhone || tenant?.phone || '',
      address: tenant?.firmAddress || tenant?.address || 'Registered Business Address',
      gstin: tenant?.firmGSTIN || tenant?.gstin || 'UNREGISTERED',
      placeOfSupply: tenant?.state || 'Maharashtra (27)',
    },
  };
}

/**
 * GET /api/saas/subscription/invoices
 * Returns statutory B2B GST Tax Invoices for this tenant.
 */
export async function getTenantInvoices(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Check PlatformInvoice collection first
    const [invoices, totalInvoices] = await Promise.all([
      PlatformInvoice.find({ 'recipient.tenantId': tenantId })
        .populate('planId', 'name code baseMonthlyPrice description')
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PlatformInvoice.countDocuments({ 'recipient.tenantId': tenantId }),
    ]);

    if (invoices.length > 0) {
      const totalSpend = invoices.reduce((sum, inv: any) => sum + (inv.totals?.grandTotal || 0), 0);
      const totalITC = invoices.reduce((sum, inv: any) => sum + (inv.totals?.taxTotal || 0), 0);

      res.status(200).json({
        success: true,
        invoices,
        data: invoices,
        summary: {
          totalInvoices,
          totalSpend: Math.round(totalSpend * 100) / 100,
          totalITC: Math.round(totalITC * 100) / 100,
        },
        pagination: {
          total: totalInvoices,
          page,
          limit,
          totalPages: Math.ceil(totalInvoices / limit),
        },
      });
      return;
    }

    // Fallback to legacy payments projection if no PlatformInvoice records exist yet
    const [payments, tenant] = await Promise.all([
      SubscriptionPayment.find({
        tenantId,
        paymentStatus: PaymentStatus.COMPLETED,
      })
        .populate('planId', 'name code baseMonthlyPrice description')
        .sort({ paidAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Admin.findById(tenantId)
        .select('firmName name email phone firmPhone address firmAddress gstin firmGSTIN state')
        .lean(),
    ]);

    const legacyInvoices = payments.map((p, index) =>
      buildTaxInvoiceDTO(p, payments.length - 1 - index, tenant),
    );

    const totalSpend = legacyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalITC = legacyInvoices.reduce((sum, inv) => sum + inv.totalTax, 0);

    res.status(200).json({
      success: true,
      invoices: legacyInvoices,
      data: legacyInvoices,
      summary: {
        totalInvoices: legacyInvoices.length,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalITC: Math.round(totalITC * 100) / 100,
      },
      pagination: {
        total: legacyInvoices.length,
        page,
        limit,
        totalPages: Math.ceil(legacyInvoices.length / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

export const getTaxInvoices = getTenantInvoices;

/**
 * GET /api/saas/subscription/invoices/:id
 * Get single statutory GST Tax Invoice.
 */
export async function getTenantInvoiceById(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const invoiceId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

    if (!invoiceId || !Types.ObjectId.isValid(invoiceId)) {
      res.status(400).json({ success: false, message: 'Valid invoice id is required' });
      return;
    }

    // 1. Search PlatformInvoice collection
    const invoice = await PlatformInvoice.findOne({
      _id: invoiceId,
      'recipient.tenantId': tenantId,
    })
      .populate('planId', 'name code baseMonthlyPrice description')
      .populate('payment.paymentId')
      .lean();

    if (invoice) {
      res.status(200).json({
        success: true,
        invoice,
        data: invoice,
      });
      return;
    }

    // 2. Fallback to legacy payment search
    const [payment, tenant] = await Promise.all([
      SubscriptionPayment.findOne({
        _id: invoiceId,
        tenantId,
        paymentStatus: PaymentStatus.COMPLETED,
      })
        .populate('planId', 'name code baseMonthlyPrice description')
        .lean(),
      Admin.findById(tenantId)
        .select('firmName name email phone firmPhone address firmAddress gstin firmGSTIN state')
        .lean(),
    ]);

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Tax invoice not found or not yet generated.',
      });
      return;
    }

    const legacyInvoice = buildTaxInvoiceDTO(payment, 0, tenant);

    res.status(200).json({
      success: true,
      invoice: legacyInvoice,
      data: legacyInvoice,
    });
  } catch (error) {
    next(error);
  }
}

export const getTaxInvoiceById = getTenantInvoiceById;

