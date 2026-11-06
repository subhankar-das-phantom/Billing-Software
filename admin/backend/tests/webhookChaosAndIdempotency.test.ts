/**
 * Bharat Enterprise Billing System — Financial Gateway & Webhook Security Breaker
 *
 * Exhaustive Chaos, Replay Storm, and Adversarial Penetration Test Suite for
 * Razorpay Webhook Processing, Payment Verification, and Two-Phase Reconciliation.
 *
 * Test Suites:
 *   1. Razorpay Signature Forgery & Cryptographic Breaches
 *   2. Webhook Replay Storm (50 Concurrent Duplicate Deliveries)
 *   3. Out-of-Order Webhook Delivery & Self-Healing
 *   4. Payload Tampering, Currency Violations & Negative Amount Injection
 *   5. Missing & Corrupted Metadata Fault Injection
 *   6. Timing Attack Resistance & Constant-Time Verification
 *   7. Platform Two-Phase Reconciliation Concurrency
 *
 * Executed natively via Node 22 test runner:
 *   npx tsx --tsconfig admin/backend/tsconfig.json --test admin/backend/tests/webhookChaosAndIdempotency.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';

// Models
import Admin from '../../../backend/models/Admin';
import Plan from '../../../backend/saas/models/Plan';
import Subscription from '../../../backend/saas/models/Subscription';
import SubscriptionPayment from '../../../backend/saas/models/SubscriptionPayment';
import { DistributedLock } from '../../../backend/models/DistributedLock';
const Customer: any = require('../../../backend/models/Customer');
const Invoice: any = require('../../../backend/models/Invoice');
const Payment: any = require('../../../backend/models/Payment');

// Services & Controllers under Test
import {
  timingSafeCompare,
  verifyWebhookSignature,
  verifyPaymentSignature,
  validateFinancialPayload,
  validateWebhookMetadata,
  processRazorpayWebhook,
  handleRazorpayWebhook,
  reconcilePayment,
} from '../services/platformSubscriptionService';
import {
  handleRazorpayWebhook as businessHandleRazorpayWebhook,
  verifyPayment as businessVerifyPayment,
} from '../../../backend/saas/controllers/subscriptionController';
const paymentController: any = require('../../../backend/controllers/paymentController');
import {
  SubscriptionStatus,
  PaymentStatus,
  PaymentGateway,
  PlanCode,
  Feature,
} from '../../../backend/saas/shared/features';
import { PlatformRole } from '../types';

// Isolated local MongoDB connection for chaos & adversarial webhook tests
const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/test_webhook_chaos_isolated';
const TEST_WEBHOOK_SECRET = 'rzp_whsec_ChaosTestSecret2026_xYz987';
const TEST_KEY_SECRET = 'rzp_ksec_TestSecret2026_AbCdEf';

process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, any>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

function computeSignature(payload: string | Buffer, secret: string = TEST_WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// ═════════════════════════════════════════════════════════════════════
// GLOBAL TEST FIXTURES & TEARDOWN
// ═════════════════════════════════════════════════════════════════════

let testTenantId: Types.ObjectId;
let testPlanId: Types.ObjectId;

before(async () => {
  await mongoose.connect(TEST_MONGO_URI);

  const collections = [
    'admins',
    'plans',
    'subscriptions',
    'subscriptionpayments',
    'distributedlocks',
    'platformauditlogs',
    'customers',
    'invoices',
    'payments',
  ];
  for (const name of collections) {
    try {
      await mongoose.connection.collection(name).deleteMany({});
    } catch {}
  }
});

after(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  // Clear working test collections
  await Promise.all([
    Admin.deleteMany({}),
    Plan.deleteMany({}),
    Subscription.deleteMany({}),
    SubscriptionPayment.deleteMany({}),
    DistributedLock.deleteMany({}),
    Customer.deleteMany({}),
    Invoice.deleteMany({}),
    Payment.deleteMany({}),
  ]);

  // Seed baseline tenant
  const tenant = await Admin.create({
    firmName: 'Chaos Webhook Corp',
    email: 'tenant_chaos@bharatenterprise.com',
    password: 'Password@123',
    firmAddress: 'Sector 5, Salt Lake, Kolkata',
    firmGSTIN: '19ABCDE1234F1Z5',
    firmPhone: '9876543210',
    isActive: true,
  });
  testTenantId = tenant._id;

  // Seed baseline plan
  const plan = await Plan.create({
    name: 'Enterprise Growth Plan',
    code: PlanCode.BUSINESS,
    description: 'Full enterprise tier with unlimited features',
    baseMonthlyPrice: 1999,
    features: [
      Feature.INVOICE_CREATE,
      Feature.GST_REPORTS,
      Feature.ADVANCED_REPORTING,
      Feature.ACTIVITY_LOGS,
    ],
    active: true,
  });
  testPlanId = plan._id;
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 1: RAZORPAY SIGNATURE FORGERY & CRYPTOGRAPHIC BREACHES
// ═════════════════════════════════════════════════════════════════════

describe('Suite 1: Razorpay Signature Forgery & Cryptographic Breaches', () => {
  it('Attack 1.1: should strictly reject forged HMAC signatures with HTTP 400', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_forgery_001',
            amount: 199900,
            currency: 'INR',
          },
        },
      },
    });

    const forgedSignature = crypto.randomBytes(32).toString('hex'); // Random 64-char hex
    const res = await processRazorpayWebhook(rawPayload, forgedSignature, 'evt_001');

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid webhook signature/i);
  });

  it('Attack 1.2: should strictly reject signatures generated with mismatched secrets', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_mismatch_001', amount: 199900, currency: 'INR' } },
      },
    });

    const signatureWithWrongSecret = computeSignature(rawPayload, 'wrong_attacker_secret_999');
    const res = await processRazorpayWebhook(rawPayload, signatureWithWrongSecret, 'evt_002');

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid webhook signature/i);
  });

  it('Attack 1.3: should strictly reject truncated signatures (e.g. 10 chars)', async () => {
    const rawPayload = JSON.stringify({ event: 'payment.captured' });
    const fullSignature = computeSignature(rawPayload);
    const truncatedSignature = fullSignature.slice(0, 16);

    const res = await processRazorpayWebhook(rawPayload, truncatedSignature, 'evt_003');

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid webhook signature/i);
  });

  it('Attack 1.4: should strictly reject missing X-Razorpay-Signature header', async () => {
    const rawPayload = JSON.stringify({ event: 'payment.captured' });
    const res = await processRazorpayWebhook(rawPayload, undefined, 'evt_004');

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /missing or empty/i);
  });

  it('Attack 1.5: should strictly reject empty string signature header', async () => {
    const rawPayload = JSON.stringify({ event: 'payment.captured' });
    const res = await processRazorpayWebhook(rawPayload, '   ', 'evt_005');

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /missing or empty/i);
  });

  it('Attack 1.6: should strictly reject malformed/non-hex signature strings', async () => {
    const rawPayload = JSON.stringify({ event: 'payment.captured' });
    const malformed = '!@#$%^&*()_+~`|}{[]:;?><,./';

    const res = await processRazorpayWebhook(rawPayload, malformed, 'evt_006');

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid webhook signature/i);
  });

  it('Attack 1.7: should verify verifyPayment endpoint rejects forged signatures', async () => {
    // Setup pending payment
    const payment = await SubscriptionPayment.create({
      tenantId: testTenantId,
      planId: testPlanId,
      durationMonths: 1,
      baseAmount: 1999,
      discountAmount: 0,
      finalAmount: 1999,
      paymentGateway: PaymentGateway.RAZORPAY,
      gatewayOrderId: 'order_test_forgery_001',
      paymentStatus: PaymentStatus.PENDING,
      billingMode: 'manual',
    });

    const mockReq: any = {
      userRole: 'admin',
      user: { _id: testTenantId },
      body: {
        paymentId: payment._id.toString(),
        razorpay_order_id: 'order_test_forgery_001',
        razorpay_payment_id: 'pay_attacker_fake_999',
        razorpay_signature: '0000000000000000000000000000000000000000000000000000000000000000',
      },
    };
    const mockRes = createMockRes();

    await businessVerifyPayment(mockReq, mockRes, () => {});

    assert.equal(mockRes.statusCode, 400);
    assert.equal(mockRes.body.success, false);
    assert.match(mockRes.body.message, /invalid signature/i);

    // Verify payment in DB was marked as FAILED, not COMPLETED
    const dbPayment = await SubscriptionPayment.findById(payment._id);
    assert.equal(dbPayment?.paymentStatus, PaymentStatus.FAILED);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 2: WEBHOOK REPLAY STORM (50 CONCURRENT DUPLICATE DELIVERIES)
// ═════════════════════════════════════════════════════════════════════

describe('Suite 2: Webhook Replay Storm (50 Concurrent Duplicate Deliveries)', () => {
  it('Attack 2.1: Replay Storm on Order Payment: 50 concurrent requests -> exactly 1 activation, 49 idempotent 200s', async () => {
    // Create initial subscription expiring in 5 days
    const now = new Date();
    const initialExpiry = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const subscription = await Subscription.create({
      tenantId: testTenantId,
      planId: testPlanId,
      status: SubscriptionStatus.ACTIVE,
      startedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      expiresAt: initialExpiry,
      graceUntil: new Date(initialExpiry.getTime() + 7 * 24 * 60 * 60 * 1000),
      currentPricingSnapshot: {
        planName: 'Enterprise Growth Plan',
        planCode: PlanCode.BUSINESS,
        baseMonthlyPrice: 1999,
        durationMonths: 1,
        discountApplied: 0,
        finalAmount: 1999,
        features: [Feature.INVOICE_CREATE],
      },
    });

    const testOrderId = 'order_storm_test_999';
    const testPaymentId = 'pay_storm_replayed_001';

    // Pending payment in database
    const pendingPayment = await SubscriptionPayment.create({
      tenantId: testTenantId,
      planId: testPlanId,
      durationMonths: 1,
      baseAmount: 1999,
      discountAmount: 0,
      finalAmount: 1999,
      paymentGateway: PaymentGateway.RAZORPAY,
      gatewayOrderId: testOrderId,
      paymentStatus: PaymentStatus.PENDING,
      billingMode: 'manual',
    });

    // Prepare single canonical webhook payload
    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: testPaymentId,
            order_id: testOrderId,
            amount: 199900,
            currency: 'INR',
            status: 'captured',
            method: 'upi',
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    });

    const validSignature = computeSignature(webhookPayload);

    // ── FIRE 50 CONCURRENT DELIVERIES SIMULTANEOUSLY ──
    const CONCURRENCY_STORM_SIZE = 50;
    const stormPromises = Array.from({ length: CONCURRENCY_STORM_SIZE }, (_, idx) => {
      const mockReq: any = {
        headers: {
          'x-razorpay-signature': validSignature,
          'x-razorpay-event-id': `evt_storm_req_${idx}`,
        },
        body: Buffer.from(webhookPayload),
      };
      const mockRes = createMockRes();
      return handleRazorpayWebhook(mockReq, mockRes).then(() => mockRes);
    });

    const results = await Promise.all(stormPromises);

    // ── ASSERTION 1: ALL 50 REQUESTS MUST RETURN HTTP 200 ──
    const statusCodes = results.map((r) => r.statusCode);
    assert.equal(
      statusCodes.every((code) => code === 200),
      true,
      `All 50 responses must return HTTP 200. Got: ${JSON.stringify(statusCodes.slice(0, 5))}`,
    );

    // ── ASSERTION 2: EXACTLY ONE SUCCESSFUL ACTIVATION, 49 IDEMPOTENT/HANDLED ──
    const processedResults = results.filter((r) => r.body?.message?.includes('successfully processed'));
    const idempotentResults = results.filter(
      (r) => r.body?.idempotent === true || r.body?.queued === true,
    );

    assert.equal(
      processedResults.length,
      1,
      `Expected exactly 1 request to execute primary activation. Found: ${processedResults.length}`,
    );
    assert.equal(
      idempotentResults.length,
      CONCURRENCY_STORM_SIZE - 1,
      `Expected exactly 49 requests to be safely intercepted as idempotent/queued. Found: ${idempotentResults.length}`,
    );

    // ── ASSERTION 3: EXACTLY ONE COMPLETED PAYMENT RECORD IN DB ──
    const completedPayments = await SubscriptionPayment.find({
      gatewayPaymentId: testPaymentId,
      paymentStatus: PaymentStatus.COMPLETED,
    });
    assert.equal(completedPayments.length, 1);
    assert.equal(completedPayments[0]?._id.toString(), pendingPayment._id.toString());

    // ── ASSERTION 4: ZERO DUPLICATE EXTENSIONS (Must be exactly +30 days, NOT +1500 days) ──
    const refreshedSub = await Subscription.findById(subscription._id);
    assert.ok(refreshedSub);

    const initialExpiryMs = initialExpiry.getTime();
    const finalExpiryMs = new Date(refreshedSub.expiresAt).getTime();
    const daysAdded = Math.round((finalExpiryMs - initialExpiryMs) / (1000 * 60 * 60 * 24));

    assert.equal(
      daysAdded,
      30,
      `Subscription must be extended by exactly 30 days (1 cycle). Observed: ${daysAdded} days.`,
    );
  });

  it('Attack 2.2: Replay Storm on Subscription Renewal: 50 concurrent subscription.charged -> exactly 1 cycle added', async () => {
    const gatewaySubId = 'sub_rzp_recurring_storm_777';
    const renewalPaymentId = 'pay_rzp_renewal_storm_888';

    const now = new Date();
    const initialExpiry = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    const subscription = await Subscription.create({
      tenantId: testTenantId,
      planId: testPlanId,
      status: SubscriptionStatus.ACTIVE,
      startedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      expiresAt: initialExpiry,
      graceUntil: new Date(initialExpiry.getTime() + 7 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      billingMode: 'auto',
      gatewaySubscriptionId: gatewaySubId,
      renewalIntervalMonths: 1,
      currentPricingSnapshot: {
        planName: 'Enterprise Growth Plan',
        planCode: PlanCode.BUSINESS,
        baseMonthlyPrice: 1999,
        durationMonths: 1,
        discountApplied: 0,
        finalAmount: 1999,
        features: [Feature.INVOICE_CREATE],
      },
    });

    const webhookPayload = JSON.stringify({
      event: 'subscription.charged',
      payload: {
        subscription: {
          entity: {
            id: gatewaySubId,
            status: 'active',
            charge_at: Math.floor((now.getTime() + 40 * 24 * 60 * 60 * 1000) / 1000),
          },
        },
        payment: {
          entity: {
            id: renewalPaymentId,
            subscription_id: gatewaySubId,
            amount: 199900,
            currency: 'INR',
            status: 'captured',
            method: 'card',
            created_at: Math.floor(now.getTime() / 1000),
          },
        },
      },
    });

    const validSignature = computeSignature(webhookPayload);

    // ── FIRE 50 CONCURRENT RENEWAL DELIVERIES ──
    const stormPromises = Array.from({ length: 50 }, (_, idx) => {
      const mockReq: any = {
        headers: {
          'x-razorpay-signature': validSignature,
          'x-razorpay-event-id': `evt_renew_storm_${idx}`,
        },
        body: Buffer.from(webhookPayload),
      };
      const mockRes = createMockRes();
      return handleRazorpayWebhook(mockReq, mockRes).then(() => mockRes);
    });

    const results = await Promise.all(stormPromises);

    // All return 200
    assert.equal(results.every((r) => r.statusCode === 200), true);

    // Exactly 1 new completed payment recorded
    const renewalPayments = await SubscriptionPayment.find({
      gatewayPaymentId: renewalPaymentId,
      paymentStatus: PaymentStatus.COMPLETED,
    });
    assert.equal(renewalPayments.length, 1);

    // Subscription extended by exactly 1 renewal cycle (+30 days)
    const refreshedSub = await Subscription.findById(subscription._id);
    assert.ok(refreshedSub);
    const daysAdded = Math.round(
      (new Date(refreshedSub.expiresAt).getTime() - initialExpiry.getTime()) / (1000 * 60 * 60 * 24),
    );
    assert.equal(daysAdded, 30);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 3: OUT-OF-ORDER WEBHOOK DELIVERY & SELF-HEALING
// ═════════════════════════════════════════════════════════════════════

describe('Suite 3: Out-of-Order Webhook Delivery & Self-Healing', () => {
  it('Attack 3.1: payment.captured arrives BEFORE order recorded in DB -> self-heals from notes', async () => {
    const outOfOrderPaymentId = 'pay_out_of_order_111';
    const outOfOrderOrderId = 'order_out_of_order_222';

    // Notice: NO SubscriptionPayment exists in DB for this order or payment yet!
    const preCount = await SubscriptionPayment.countDocuments({ gatewayPaymentId: outOfOrderPaymentId });
    assert.equal(preCount, 0);

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: outOfOrderPaymentId,
            order_id: outOfOrderOrderId,
            amount: 199900,
            currency: 'INR',
            status: 'captured',
            created_at: Math.floor(Date.now() / 1000),
            notes: {
              tenantId: testTenantId.toString(),
              planId: testPlanId.toString(),
              durationMonths: '2',
            },
          },
        },
      },
    });

    const res = await processRazorpayWebhook(payload, computeSignature(payload), 'evt_ooo_001');

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.selfHealed, true);

    // Assert that the payment was created in COMPLETED status
    const createdPayment = await SubscriptionPayment.findOne({
      gatewayPaymentId: outOfOrderPaymentId,
    });
    assert.ok(createdPayment);
    assert.equal(createdPayment.paymentStatus, PaymentStatus.COMPLETED);
    assert.equal(createdPayment.durationMonths, 2);
    assert.equal(createdPayment.finalAmount, 1999);

    // Assert that tenant subscription was activated for 2 months (60 days)
    const activeSub = await Subscription.findOne({ tenantId: testTenantId });
    assert.ok(activeSub);
    assert.equal(activeSub.status, SubscriptionStatus.ACTIVE);
    const durationDays = Math.round(
      (new Date(activeSub.expiresAt).getTime() - new Date(activeSub.startedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    assert.equal(durationDays, 60);
  });

  it('Attack 3.2: subscription.cancelled arrives BEFORE activation -> preserves cancellation state', async () => {
    const gatewaySubId = 'sub_ooo_cancel_first_333';

    // Step 1: Fire subscription.cancelled first
    const cancelPayload = JSON.stringify({
      event: 'subscription.cancelled',
      payload: {
        subscription: {
          entity: {
            id: gatewaySubId,
            status: 'cancelled',
          },
        },
      },
    });

    const cancelRes = await processRazorpayWebhook(
      cancelPayload,
      computeSignature(cancelPayload),
      'evt_cancel_early',
    );
    assert.equal(cancelRes.statusCode, 200);

    // Step 2: Now fire pending payment and activation
    const pendingPayment = await SubscriptionPayment.create({
      tenantId: testTenantId,
      planId: testPlanId,
      durationMonths: 1,
      baseAmount: 1999,
      discountAmount: 0,
      finalAmount: 1999,
      paymentGateway: PaymentGateway.RAZORPAY,
      gatewaySubscriptionId: gatewaySubId,
      paymentStatus: PaymentStatus.PENDING,
      billingMode: 'auto',
      metadata: {
        gatewaySubscriptionStatus: 'cancelled', // Self-healed by the early cancellation
      },
    });

    const activationPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        subscription: {
          entity: {
            id: gatewaySubId,
            status: 'cancelled',
          },
        },
        payment: {
          entity: {
            id: 'pay_late_activation_444',
            subscription_id: gatewaySubId,
            amount: 199900,
            currency: 'INR',
            status: 'captured',
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    });

    const actRes = await processRazorpayWebhook(
      activationPayload,
      computeSignature(activationPayload),
      'evt_late_act',
    );
    assert.equal(actRes.statusCode, 200);

    // Verify: autoRenew must NOT be enabled since gateway subscription was already cancelled!
    const sub = await Subscription.findOne({ tenantId: testTenantId });
    assert.ok(sub);
    assert.equal(sub.autoRenew, false);
    assert.ok(!sub.autoRenew);
  });

  it('Attack 3.3: Webhook arrives with unidentifiable payload -> ignores safely without crash', async () => {
    const unidentifiablePayload = JSON.stringify({
      event: 'custom.unknown_event',
      payload: {},
    });

    const res = await processRazorpayWebhook(
      unidentifiablePayload,
      computeSignature(unidentifiablePayload),
      'evt_unknown',
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ignored, true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 4: PAYLOAD TAMPERING & FINANCIAL CORRUPTION
// ═════════════════════════════════════════════════════════════════════

describe('Suite 4: Payload Tampering, Currency Violations & Negative Amount Injection', () => {
  it('Attack 4.1: should strictly reject negative payment amount injection (-50000)', async () => {
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_tamper_neg',
            amount: -50000,
            currency: 'INR',
          },
        },
      },
    });

    const res = await processRazorpayWebhook(payload, computeSignature(payload), 'evt_neg');
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid payment amount/i);
  });

  it('Attack 4.2: should strictly reject fractional paise floating-point values (49999.99999)', async () => {
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_tamper_frac',
            amount: 49999.99999,
            currency: 'INR',
          },
        },
      },
    });

    const res = await processRazorpayWebhook(payload, computeSignature(payload), 'evt_frac');
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /positive integer in paise without fractions/i);
  });

  it('Attack 4.3: should strictly reject string amounts ("NaN", "fifty thousand")', async () => {
    const payloadNaN = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_tamper_nan',
            amount: 'NaN',
            currency: 'INR',
          },
        },
      },
    });

    const resNaN = await processRazorpayWebhook(payloadNaN, computeSignature(payloadNaN), 'evt_nan');
    assert.equal(resNaN.statusCode, 400);
    assert.match(resNaN.body.message, /invalid payment amount/i);

    const payloadStr = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_tamper_str',
            amount: 'fifty thousand',
            currency: 'INR',
          },
        },
      },
    });
    const resStr = await processRazorpayWebhook(payloadStr, computeSignature(payloadStr), 'evt_str');
    assert.equal(resStr.statusCode, 400);
  });

  it('Attack 4.4: should strictly reject foreign currency injection ("USD", "EUR")', async () => {
    const payloadUSD = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_tamper_usd',
            amount: 50000,
            currency: 'USD',
          },
        },
      },
    });

    const resUSD = await processRazorpayWebhook(payloadUSD, computeSignature(payloadUSD), 'evt_usd');
    assert.equal(resUSD.statusCode, 400);
    assert.match(resUSD.body.message, /unsupported currency "USD"/i);
  });

  it('Attack 4.5: should strictly reject zero amount injection (0 paise)', async () => {
    const payloadZero = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_tamper_zero',
            amount: 0,
            currency: 'INR',
          },
        },
      },
    });

    const resZero = await processRazorpayWebhook(payloadZero, computeSignature(payloadZero), 'evt_zero');
    assert.equal(resZero.statusCode, 400);
    assert.match(resZero.body.message, /invalid payment amount/i);
  });

  it('Attack 4.6: Business plane createPayment rejects negative, NaN, and foreign currency', async () => {
    // Negative amount
    const mockReqNeg: any = {
      user: { tenantId: testTenantId },
      body: { invoiceId: new Types.ObjectId(), amount: -500 },
    };
    const mockResNeg = createMockRes();
    await paymentController.createPayment(mockReqNeg, mockResNeg, () => {});
    assert.equal(mockResNeg.statusCode, 400);
    assert.match(mockResNeg.body.message, /greater than 0/i);

    // NaN amount
    const mockReqNaN: any = {
      user: { tenantId: testTenantId },
      body: { invoiceId: new Types.ObjectId(), amount: 'NaN' },
    };
    const mockResNaN = createMockRes();
    await paymentController.createPayment(mockReqNaN, mockResNaN, () => {});
    assert.equal(mockResNaN.statusCode, 400);

    // Foreign currency
    const mockReqUSD: any = {
      user: { tenantId: testTenantId },
      body: { invoiceId: new Types.ObjectId(), amount: 500, currency: 'USD' },
    };
    const mockResUSD = createMockRes();
    await paymentController.createPayment(mockReqUSD, mockResUSD, () => {});
    assert.equal(mockResUSD.statusCode, 400);
    assert.match(mockResUSD.body.message, /only INR is accepted/i);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 5: MISSING & CORRUPTED METADATA FAULT INJECTION
// ═════════════════════════════════════════════════════════════════════

describe('Suite 5: Missing & Corrupted Metadata Fault Injection', () => {
  it('Attack 5.1: should reject webhook with invalid tenantId string in notes ("invalid-tenant-hex")', async () => {
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_bad_meta_1',
            amount: 199900,
            currency: 'INR',
            notes: {
              tenantId: 'invalid-tenant-hex-not-an-objectid',
            },
          },
        },
      },
    });

    const res = await processRazorpayWebhook(payload, computeSignature(payload), 'evt_meta_1');
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid tenantid format/i);
  });

  it('Attack 5.2: should return 404 if notes.tenantId references a deleted/non-existent tenant', async () => {
    const nonExistentTenantId = new Types.ObjectId().toString();

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_bad_meta_2',
            amount: 199900,
            currency: 'INR',
            notes: {
              tenantId: nonExistentTenantId,
            },
          },
        },
      },
    });

    const res = await processRazorpayWebhook(payload, computeSignature(payload), 'evt_meta_2');
    assert.equal(res.statusCode, 404);
    assert.match(res.body.message, /does not exist/i);
  });

  it('Attack 5.3: should return 400 for corrupted non-JSON payload without crashing process', async () => {
    const malformedBody = '<<<THIS IS NOT JSON>>> { "event": broken ';
    const res = await processRazorpayWebhook(
      malformedBody,
      computeSignature(malformedBody),
      'evt_malformed',
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /malformed webhook json payload/i);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 6: TIMING ATTACK RESISTANCE & CONSTANT-TIME VERIFICATION
// ═════════════════════════════════════════════════════════════════════

describe('Suite 6: Timing Attack Resistance & Constant-Time Verification', () => {
  it('Security 6.1: timingSafeCompare returns true for identical signatures and false for mismatch', () => {
    const sig1 = computeSignature('payload_alpha');
    const sig2 = computeSignature('payload_alpha');
    const sigMismatch = computeSignature('payload_beta');

    assert.equal(timingSafeCompare(sig1, sig2), true);
    assert.equal(timingSafeCompare(sig1, sigMismatch), false);
    assert.equal(timingSafeCompare(sig1, sig1.slice(0, 32)), false);
    assert.equal(timingSafeCompare(null as any, sig1), false);
    assert.equal(timingSafeCompare(sig1, undefined as any), false);
  });

  it('Security 6.2: timing difference between 0 matching chars and 63 matching chars is within constant-time noise bounds', () => {
    const target = 'a'.repeat(64);
    const zeroMatch = 'b'.repeat(64);
    const sixtyThreeMatch = 'a'.repeat(63) + 'b';

    // Verify crypto.timingSafeEqual is strictly invoked
    let timingSafeEqualCalled = false;
    const originalTimingSafeEqual = crypto.timingSafeEqual;
    try {
      (crypto as any).timingSafeEqual = function (...args: any[]) {
        timingSafeEqualCalled = true;
        return originalTimingSafeEqual.apply(this, args as any);
      };
      timingSafeCompare(target, zeroMatch);
      assert.equal(timingSafeEqualCalled, true, 'Must execute crypto.timingSafeEqual');
    } finally {
      (crypto as any).timingSafeEqual = originalTimingSafeEqual;
    }

    // Warm-up JIT
    for (let i = 0; i < 2000; i++) {
      timingSafeCompare(target, zeroMatch);
      timingSafeCompare(target, sixtyThreeMatch);
    }

    let timeZero = 0n;
    let timeSixtyThree = 0n;
    const BATCHES = 20;
    const OPS_PER_BATCH = 1000;

    for (let b = 0; b < BATCHES; b++) {
      const t0 = process.hrtime.bigint();
      for (let i = 0; i < OPS_PER_BATCH; i++) {
        timingSafeCompare(target, zeroMatch);
      }
      const t1 = process.hrtime.bigint();
      for (let i = 0; i < OPS_PER_BATCH; i++) {
        timingSafeCompare(target, sixtyThreeMatch);
      }
      const t2 = process.hrtime.bigint();

      timeZero += (t1 - t0);
      timeSixtyThree += (t2 - t1);
    }

    const totalOps = BATCHES * OPS_PER_BATCH;
    const deltaPerOpNs = Math.abs(Number(timeSixtyThree - timeZero)) / totalOps;
    assert.ok(
      deltaPerOpNs < 1000,
      `Timing variance (${deltaPerOpNs.toFixed(2)}ns/op) must be negligible, verifying constant-time hashing comparison`,
    );
  });

  it('Security 6.3: verifyPaymentSignature correctly validates order and subscription signatures timing-safely', () => {
    const orderId = 'order_valid_123';
    const paymentId = 'pay_valid_456';
    const subId = 'sub_valid_789';

    const orderSignature = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const subSignature = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(`${paymentId}|${subId}`)
      .digest('hex');

    // Valid order signature
    assert.equal(
      verifyPaymentSignature({
        orderId,
        paymentId,
        signature: orderSignature,
        secret: TEST_KEY_SECRET,
      }),
      true,
    );

    // Valid subscription signature
    assert.equal(
      verifyPaymentSignature({
        subscriptionId: subId,
        paymentId,
        signature: subSignature,
        secret: TEST_KEY_SECRET,
      }),
      true,
    );

    // Mismatched signature
    assert.equal(
      verifyPaymentSignature({
        orderId,
        paymentId,
        signature: orderSignature.slice(0, 63) + 'f',
        secret: TEST_KEY_SECRET,
      }),
      false,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUITE 7: PLATFORM TWO-PHASE RECONCILIATION CONCURRENCY
// ═════════════════════════════════════════════════════════════════════

describe('Suite 7: Platform Two-Phase Reconciliation Concurrency', () => {
  it('Concurrency 7.1: 20 concurrent reconcilePayment calls -> exactly 1 activation, 19 conflicts or idempotents', async () => {
    // Setup pending payment
    const pendingPayment = await SubscriptionPayment.create({
      tenantId: testTenantId,
      planId: testPlanId,
      durationMonths: 1,
      baseAmount: 1999,
      discountAmount: 0,
      finalAmount: 1999,
      paymentGateway: PaymentGateway.MANUAL,
      paymentStatus: PaymentStatus.PENDING,
      billingMode: 'manual',
    });

    const operator = {
      _id: new Types.ObjectId(),
      email: 'operator_chaos@bharatenterprise.com',
      role: PlatformRole.PLATFORM_ADMIN,
    };

    const CONCURRENCY_SIZE = 20;
    const reconcilePromises = Array.from({ length: CONCURRENCY_SIZE }, () => {
      return reconcilePayment(
        pendingPayment._id.toString(),
        'Operational manual reconciliation audit reason verification test',
        operator,
      );
    });

    const results = await Promise.all(reconcilePromises);

    // Assert that exactly one claim was accepted (statusCode 200 with activation)
    const successfulClaims = results.filter((r) => r.statusCode === 200 && !r.data?.idempotent);
    const idempotentOrConflicts = results.filter(
      (r) => r.statusCode === 409 || (r.statusCode === 200 && r.data?.idempotent),
    );

    assert.equal(
      successfulClaims.length,
      1,
      `Exactly 1 operator call must claim the uncompleted payment. Found: ${successfulClaims.length}`,
    );
    assert.equal(
      idempotentOrConflicts.length,
      CONCURRENCY_SIZE - 1,
      `Remaining ${CONCURRENCY_SIZE - 1} calls must be safely rejected with 409 Conflict or 200 Idempotent`,
    );

    // Verify DB state
    const refreshedPayment = await SubscriptionPayment.findById(pendingPayment._id);
    assert.equal(refreshedPayment?.paymentStatus, PaymentStatus.COMPLETED);

    // Verify exactly one subscription was created/activated
    const activeSubs = await Subscription.find({ tenantId: testTenantId });
    assert.equal(activeSubs.length, 1);
  });
});
