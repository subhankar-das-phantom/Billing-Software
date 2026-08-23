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
const Razorpay = require('razorpay');
const { validatePaymentVerification, validateWebhookSignature } = Razorpay;

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

    res.status(200).json({
      success: true,
      subscription: subscription || null,
      info,
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
      ? validatePaymentVerification(
          {
            payment_id: razorpay_payment_id,
            subscription_id: razorpay_subscription_id,
          },
          razorpay_signature,
          keySecret,
        )
      : crypto
          .createHmac('sha256', keySecret)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex') === razorpay_signature;

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

    // Payment verified — update payment record
    payment.gatewayPaymentId = razorpay_payment_id;
    payment.gatewaySignature = razorpay_signature;
    if (isAutoRenew) {
      payment.gatewaySubscriptionId = razorpay_subscription_id;
      payment.billingMode = 'auto';
    }
    payment.paymentStatus = PaymentStatus.COMPLETED;
    payment.paidAt = new Date();
    await payment.save();

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
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const eventId = req.headers['x-razorpay-event-id'];

    if (!webhookSecret) {
      res.status(503).json({
        success: false,
        message: 'Razorpay webhook secret not configured',
      });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}));

    if (!validateWebhookSignature(rawBody, signature, webhookSecret)) {
      res.status(400).json({
        success: false,
        message: 'Invalid webhook signature',
      });
      return;
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventName = event.event;
    const subscriptionEntity = event.payload?.subscription?.entity || null;
    const paymentEntity = event.payload?.payment?.entity || null;
    const invoiceEntity = event.payload?.invoice?.entity || null;
    const gatewaySubscriptionId =
      subscriptionEntity?.id ||
      paymentEntity?.subscription_id ||
      invoiceEntity?.subscription_id;

    if (!gatewaySubscriptionId) {
      res.status(200).json({ success: true, ignored: true });
      return;
    }

    if (subscriptionEntity) {
      await updateAutoRenewStatus(gatewaySubscriptionId, subscriptionEntity);
    }

    if (
      paymentEntity &&
      ['subscription.charged', 'payment.captured', 'invoice.paid'].includes(eventName)
    ) {
      const pendingPayment = await SubscriptionPayment.findOne({
        gatewaySubscriptionId,
        paymentStatus: PaymentStatus.PENDING,
      }).sort({ createdAt: -1 });

      if (pendingPayment) {
        await activatePendingAutoRenewPayment(
          pendingPayment,
          paymentEntity,
          subscriptionEntity,
          eventId,
        );
      } else {
        await applyAutoRenewalCycle(
          gatewaySubscriptionId,
          paymentEntity,
          eventId,
          subscriptionEntity,
        );
      }
    }

    if (paymentEntity && eventName === 'payment.failed') {
      await SubscriptionPayment.findOneAndUpdate(
        {
          gatewaySubscriptionId,
          paymentStatus: PaymentStatus.PENDING,
        },
        {
          $set: {
            paymentStatus: PaymentStatus.FAILED,
            gatewayPaymentId: paymentEntity.id,
            gatewayEventId: eventId,
            metadata: {
              failureReason: paymentEntity.error_description,
              errorCode: paymentEntity.error_code,
            },
          },
        },
      );
    }

    res.status(200).json({ success: true });
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
