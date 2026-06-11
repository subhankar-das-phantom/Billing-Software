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
  activateSubscription,
  getActiveSubscription,
  getPaymentHistory,
} from '../services/subscriptionService';
import { getSubscriptionInfo } from '../services/featureService';
import { processReferralReward } from '../services/referralService';
import { createNotification } from '../services/notificationService';

const getTenantId = require('../../utils/getTenantId');

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
    const { planId, durationMonths } = req.body;

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

    // Create Razorpay order
    const razorpay = getRazorpay();
    if (!razorpay) {
      res.status(503).json({
        success: false,
        message: 'Payment gateway not configured',
      });
      return;
    }

    const order = await razorpay.orders.create({
      amount: pricing.finalPrice * 100, // Razorpay uses paise
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
    });

    res.status(200).json({
      success: true,
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
      razorpay_payment_id,
      razorpay_signature,
      paymentId,
    } = req.body;

    if (
      !razorpay_order_id ||
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

    // Find the pending payment
    const payment = await SubscriptionPayment.findOne({
      _id: paymentId,
      tenantId,
      gatewayOrderId: razorpay_order_id,
      paymentStatus: PaymentStatus.PENDING,
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment record not found or already processed',
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

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
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
    payment.paymentStatus = PaymentStatus.COMPLETED;
    payment.paidAt = new Date();
    await payment.save();

    // Activate subscription
    const { subscription, proratedDaysAdded, isUpgrade } = await activateSubscription(
      tenantId.toString(),
      payment.planId.toString(),
      payment.durationMonths,
      payment._id.toString(),
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
