/**
 * Bharat Enterprise Billing System
 * Financial Ledger Consistency & Sequential Invoice Numbering Stress Test Suite
 *
 * Verifies under high concurrency and randomized baskets:
 * 1. Strictly unique sequential invoice numbers (0 duplicates, 0 gaps, 0 race conditions across 30 concurrent creation requests).
 * 2. Paise precision and financial parity across 1,000 randomized baskets (CGST + SGST === Total GST, canonical finalTotal with roundOff).
 * 3. Negative and zero balance guardrails (payments, credit notes, and edits cannot force negative balances).
 * 4. Merged ledger parity (running balance === sum(debits) - sum(credits) at every single step, with zero drift vs getCustomer liveDue).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import mongoose from 'mongoose';

// Load environment variables safely
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Admin = require('../models/Admin');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const CreditNote = require('../models/CreditNote');
const ManualEntry = require('../models/ManualEntry');
const Sequence = require('../models/Sequence').default || require('../models/Sequence');

const invoiceService = require('../services/invoiceService').default || require('../services/invoiceService');
const { calculateItemFinancials, calculateInvoiceTotals, round2 } = invoiceService;
const invoiceController = require('../controllers/invoice/invoiceController');
const paymentController = require('../controllers/paymentController');
const creditNoteController = require('../controllers/creditNoteController');
const customerController = require('../controllers/customerController');

// Test tenant isolation ID
const testTenantId = new mongoose.Types.ObjectId();
const testAdminId = testTenantId;

// Mock HTTP helper
function createMockContext(body: any = {}, params: any = {}, query: any = {}) {
  const req: any = {
    body,
    params,
    query,
    headers: {},
    userRole: 'admin',
    user: {
      _id: testAdminId,
      id: testAdminId.toString(),
      role: 'admin',
      tenantId: testTenantId,
      firmName: 'Stress Test Enterprises'
    }
  };

  const promise = new Promise<{ statusCode: number; data: any }>((resolve, reject) => {
    const res: any = {
      statusCode: 200,
      headersSent: false,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        resolve({ statusCode: this.statusCode, data });
        return this;
      }
    };

    const next = (err: any) => {
      if (err) {
        const status = err.statusCode || 500;
        resolve({ statusCode: status, data: { success: false, message: err.message, error: err } });
      } else {
        resolve({ statusCode: res.statusCode, data: null });
      }
    };

    return { req, res, next };
  });

  return { req, promise };
}

describe('Financial Sequence & Paise Precision Stress Suite', () => {
  let testCustomer: any;
  let testProductA: any;
  let testProductB: any;

  before(async () => {
    const uri = process.env.MONGODB_URI;
    assert.ok(uri, 'MONGODB_URI must be configured in backend/.env');

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }

    // 1. Setup isolated tenant Admin
    await Admin.create({
      _id: testAdminId,
      email: `stress_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      firmName: 'Stress Test Enterprises',
      firmAddress: '100 Financial District, Mumbai, MH',
      firmPhone: '9876543210',
      firmGSTIN: '27AAAAA0000A1Z5',
      preferences: {
        enableBatchTracking: false
      }
    });

    // 2. Setup isolated Customer
    testCustomer = await Customer.create({
      tenantId: testTenantId,
      customerName: 'Enterprise Client Alpha',
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      address: 'Plot 42, Sector 18, Navi Mumbai',
      outstandingBalance: 0,
      totalPurchases: 0,
      invoiceCount: 0,
      isActive: true
    });

    // 3. Setup isolated Products with massive inventory
    testProductA = await Product.create({
      tenantId: testTenantId,
      productName: 'Paracetamol 650mg Tabs',
      hsnCode: '30049099',
      pack: '10x10',
      newMRP: 45.00,
      rate: 32.50,
      gstPercentage: 12,
      currentStockQty: 500000,
      isActive: true
    });

    testProductB = await Product.create({
      tenantId: testTenantId,
      productName: 'Amoxicillin 500mg Caps',
      hsnCode: '30041010',
      pack: '10x10',
      newMRP: 120.00,
      rate: 85.00,
      gstPercentage: 18,
      currentStockQty: 500000,
      isActive: true
    });
  });

  after(async () => {
    // Clean up isolated test tenant collections completely
    await Promise.all([
      Admin.deleteMany({ _id: testAdminId }),
      Customer.deleteMany({ tenantId: testTenantId }),
      Product.deleteMany({ tenantId: testTenantId }),
      Invoice.deleteMany({ tenantId: testTenantId }),
      Payment.deleteMany({ tenantId: testTenantId }),
      CreditNote.deleteMany({ tenantId: testTenantId }),
      ManualEntry.deleteMany({ tenantId: testTenantId }),
      Sequence.deleteMany({ tenantId: testTenantId })
    ]);

    await new Promise(r => setTimeout(r, 200));
    await mongoose.disconnect();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Concurrent Invoice Number Generation (30 simultaneous creations)
  // ───────────────────────────────────────────────────────────────────────────
  test('Scenario 1: 30 Concurrent Invoice Creation Requests Generate Strictly Monotonic Unique Numbers (0 Duplicates, 0 Race Conditions)', async () => {
    const CONCURRENCY_COUNT = 30;
    const currentYear = new Date().getFullYear();

    console.log(`\n  ⚡ Launching ${CONCURRENCY_COUNT} concurrent invoice creation requests...`);

    const creationTasks = Array.from({ length: CONCURRENCY_COUNT }, async (_, index) => {
      const createRequestId = `req-stress-${index}-${Date.now()}-${Math.random()}`;
      const body = {
        customerId: testCustomer._id.toString(),
        createRequestId,
        paymentType: 'Credit',
        notes: `Concurrent stress invoice #${index + 1}`,
        items: [
          {
            productId: testProductA._id.toString(),
            quantitySold: 1,
            ratePerUnit: 32.50,
            freeQuantity: 0,
            schemeDiscount: 0
          }
        ]
      };

      return new Promise<{ statusCode: number; data: any }>((resolve, reject) => {
        const req: any = {
          body,
          headers: {},
          userRole: 'admin',
          user: {
            _id: testAdminId,
            id: testAdminId.toString(),
            role: 'admin',
            tenantId: testTenantId,
            firmName: 'Stress Test Enterprises'
          }
        };

        const res: any = {
          statusCode: 200,
          headersSent: false,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: any) {
            resolve({ statusCode: this.statusCode, data });
            return this;
          }
        };

        const next = (err: any) => {
          if (err) {
            const status = err.statusCode || 500;
            resolve({ statusCode: status, data: { success: false, message: err.message, error: err } });
          } else {
            resolve({ statusCode: res.statusCode, data: null });
          }
        };

        invoiceController.createInvoice(req, res, next).catch(reject);
      });
    });

    const results = await Promise.all(creationTasks);

    const failures = results.filter((r) => r.statusCode !== 201);
    if (failures.length > 0) {
      console.error('Scenario 1 creation failures count:', failures.length);
      console.error('First 3 failures:', JSON.stringify(failures.slice(0, 3), null, 2));
    }

    // Verify all 30 succeeded
    const successfulResponses = results.filter((r) => r.statusCode === 201 && r.data?.success === true);
    assert.equal(
      successfulResponses.length,
      CONCURRENCY_COUNT,
      `All ${CONCURRENCY_COUNT} concurrent creation requests must succeed with 201 Created`
    );

    // Extract invoice numbers
    const invoiceNumbers = successfulResponses.map((r) => r.data.invoice.invoiceNumber as string);
    const uniqueInvoiceNumbers = new Set(invoiceNumbers);

    // Assert zero duplicates
    assert.equal(
      uniqueInvoiceNumbers.size,
      CONCURRENCY_COUNT,
      `Zero duplicate invoice numbers allowed. Expected ${CONCURRENCY_COUNT} unique, received ${uniqueInvoiceNumbers.size}`
    );

    // Parse numeric sequences
    const seqNumbers = invoiceNumbers.map((numStr) => {
      const match = numStr.match(new RegExp(`^INV-${currentYear}-(\\d+)$`));
      assert.ok(match, `Invoice number ${numStr} must match standard INV-${currentYear}-XXXX format`);
      return parseInt(match[1], 10);
    });

    seqNumbers.sort((a, b) => a - b);

    // Assert strictly continuous sequence with 0 gaps
    const firstSeq = seqNumbers[0];
    for (let i = 0; i < seqNumbers.length; i++) {
      assert.equal(
        seqNumbers[i],
        firstSeq + i,
        `Invoice sequence at index ${i} must equal ${firstSeq + i}, received ${seqNumbers[i]} (Gap detected)`
      );
    }

    // Verify database count
    const dbInvoiceCount = await Invoice.countDocuments({ tenantId: testTenantId });
    assert.equal(dbInvoiceCount, CONCURRENCY_COUNT, 'Database invoice count must match concurrency count exactly');

    console.log(`  ✅ Successfully verified ${CONCURRENCY_COUNT} sequential invoices: ${invoiceNumbers[0]} → ${invoiceNumbers[invoiceNumbers.length - 1]}`);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Paise Precision & Financial Parity Across 1,000 Randomized Baskets
  // ───────────────────────────────────────────────────────────────────────────
  test('Scenario 2: 1,000 Randomized Baskets Verify Exact Paisa GST Splitting (CGST + SGST === GST) & Canonical Rounding Parity', async () => {
    const BASKET_COUNT = 1000;
    const GST_RATES = [5, 12, 18, 28];
    const DISCOUNTS = [0, 2, 3.5, 5, 7.5, 10, 12.5, 15];

    let totalItemsAudited = 0;

    for (let basketIdx = 0; basketIdx < BASKET_COUNT; basketIdx++) {
      const itemCount = (basketIdx % 6) + 1; // 1 to 6 items per basket
      const items = [];

      for (let i = 0; i < itemCount; i++) {
        // Fractional quantity (e.g. 1.5, 25.25, 100)
        const quantity = round2((Math.floor(Math.random() * 500) + 1) / ((i % 4) + 1));
        // Fractional rate (e.g. ₹12.35, ₹999.49)
        const rate = round2(Math.floor(Math.random() * 9999 + 1) / 100);
        const gstRate = GST_RATES[(basketIdx + i) % GST_RATES.length];
        const discount = DISCOUNTS[(basketIdx + i) % DISCOUNTS.length];

        const calculated = calculateItemFinancials(quantity, rate, gstRate, discount);

        // 1. Exact Paisa Invariant on Line-Item
        assert.equal(
          round2(calculated.cgstAmount + calculated.sgstAmount),
          calculated.gstAmount,
          `Item CGST (${calculated.cgstAmount}) + SGST (${calculated.sgstAmount}) must equal total GST (${calculated.gstAmount}) to the exact paisa`
        );

        assert.equal(
          round2(calculated.taxableAmount + calculated.gstAmount),
          calculated.totalAmount,
          `Item Taxable (${calculated.taxableAmount}) + GST (${calculated.gstAmount}) must equal item totalAmount (${calculated.totalAmount})`
        );

        items.push({
          ...calculated,
          product: {
            productName: `Random Med Item ${i + 1}`,
            gstPercentage: gstRate
          },
          quantitySold: quantity,
          ratePerUnit: rate,
          schemeDiscount: discount
        });

        totalItemsAudited++;
      }

      // Compute Invoice Totals
      const totals = calculateInvoiceTotals(items);

      // 2. Exact Paisa Invariants on Invoice Totals
      assert.equal(
        round2(totals.totalCGST + totals.totalSGST),
        totals.totalGST,
        `Totals CGST (${totals.totalCGST}) + SGST (${totals.totalSGST}) must equal totalGST (${totals.totalGST})`
      );

      assert.equal(
        round2(totals.totalTaxable + totals.totalGST),
        totals.netTotal,
        `Totals Taxable (${totals.totalTaxable}) + GST (${totals.totalGST}) must equal netTotal (${totals.netTotal})`
      );

      // Canonical finalTotal is exact integer
      assert.equal(
        totals.finalTotal,
        Math.round(totals.netTotal),
        `finalTotal (${totals.finalTotal}) must be canonical Math.round of netTotal (${totals.netTotal})`
      );

      // RoundOff invariant
      assert.equal(
        round2(totals.netTotal + totals.roundOff),
        totals.finalTotal,
        `netTotal (${totals.netTotal}) + roundOff (${totals.roundOff}) must equal finalTotal (${totals.finalTotal})`
      );

      assert.ok(
        Math.abs(totals.roundOff) <= 0.50,
        `roundOff must be within [-0.50, +0.50] paisa boundary, got ${totals.roundOff}`
      );
    }

    console.log(`  ✅ Audited 1,000 randomized baskets (${totalItemsAudited} items) with 100% exact paisa split parity.`);

    // Sample persistence check in MongoDB
    const sampleItems = [
      calculateItemFinancials(3, 145.75, 18, 5),
      calculateItemFinancials(1.5, 39.99, 12, 0),
      calculateItemFinancials(10, 5.25, 5, 2.5)
    ];

    const sampleTotals = calculateInvoiceTotals(sampleItems);
    const persisted = await Invoice.create({
      tenantId: testTenantId,
      invoiceNumber: `INV-${new Date().getFullYear()}-PAISE-CHECK`,
      customer: {
        _id: testCustomer._id,
        customerName: testCustomer.customerName
      },
      paymentType: 'Credit',
      items: sampleItems.map(item => ({
        product: { productName: 'Sample Check' },
        quantitySold: 1,
        ratePerUnit: item.baseAmount,
        ...item
      })),
      totals: sampleTotals
    });

    const reloaded = await Invoice.findById(persisted._id).lean();
    assert.equal(reloaded.totals.finalTotal, sampleTotals.finalTotal);
    assert.equal(reloaded.totals.roundOff, sampleTotals.roundOff);
    assert.equal(reloaded.totals.totalGST, sampleTotals.totalGST);
    assert.equal(reloaded.totals.totalCGST, sampleTotals.totalCGST);
    assert.equal(reloaded.totals.totalSGST, sampleTotals.totalSGST);
    assert.equal(round2(reloaded.totals.totalCGST + reloaded.totals.totalSGST), reloaded.totals.totalGST);
    console.log('  ✅ Database persistence parity confirmed: roundOff, finalTotal, and exact paisa taxes verified in MongoDB.');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Negative and Zero Balance Guardrails
  // ───────────────────────────────────────────────────────────────────────────
  test('Scenario 3: Negative and Zero Balance Guardrails (Payments, Credit Notes & Invoice Reductions)', async () => {
    // 3.1 Overpayment Guardrail
    const testInv = await Invoice.create({
      tenantId: testTenantId,
      invoiceNumber: `INV-${new Date().getFullYear()}-OVERPAY-GUARD`,
      customer: {
        _id: testCustomer._id,
        customerName: testCustomer.customerName
      },
      paymentType: 'Credit',
      items: [],
      totals: {
        baseAmount: 1000,
        totalDiscount: 0,
        totalTaxable: 1000,
        totalGST: 0,
        totalCGST: 0,
        totalSGST: 0,
        roundOff: 0,
        netTotal: 1000,
        finalTotal: 1000
      },
      paidAmount: 0,
      paymentStatus: 'Unpaid'
    });

    // Make exact full payment of ₹1000
    const fullPayReq: any = {
      body: {
        invoiceId: testInv._id.toString(),
        amount: 1000,
        paymentMethod: 'Cash',
        notes: 'Full payment'
      },
      headers: {},
      userRole: 'admin',
      user: {
        _id: testAdminId,
        id: testAdminId.toString(),
        role: 'admin',
        tenantId: testTenantId
      }
    };

    let payResponse: any;
    await new Promise<void>((resolve, reject) => {
      const res: any = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this; },
        json(data: any) { payResponse = { statusCode: this.statusCode, data }; resolve(); return this; }
      };
      const next = (err: any) => {
        if (err) payResponse = { statusCode: err.statusCode || 500, message: err.message };
        resolve();
      };
      paymentController.createPayment(fullPayReq, res, next).catch(reject);
    });

    assert.equal(payResponse.statusCode, 201, 'Full payment of ₹1000 must succeed');

    const paidInvoice = await Invoice.findById(testInv._id);
    assert.equal(paidInvoice.paidAmount, 1000);
    assert.equal(paidInvoice.paymentStatus, 'Paid');

    // Attempt to overpay by even ₹0.01 -> MUST be rejected
    const overpayReq: any = {
      body: {
        invoiceId: testInv._id.toString(),
        amount: 0.01,
        paymentMethod: 'Cash'
      },
      headers: {},
      userRole: 'admin',
      user: {
        _id: testAdminId,
        id: testAdminId.toString(),
        role: 'admin',
        tenantId: testTenantId
      }
    };

    let overpayResponse: any;
    await new Promise<void>((resolve, reject) => {
      const res: any = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this; },
        json(data: any) { overpayResponse = { statusCode: this.statusCode, data }; resolve(); return this; }
      };
      const next = (err: any) => {
        overpayResponse = { statusCode: err?.statusCode || 400, message: err?.message };
        resolve();
      };
      paymentController.createPayment(overpayReq, res, next).catch(reject);
    });

    assert.equal(overpayResponse.statusCode, 400, 'Overpayment must be rejected with 400 Bad Request');
    console.log('  ✅ Overpayment guardrail verified: payment rejected when balance is zero');

    // 3.2 Credit Note Excessive Return Guardrail
    const cnInvoice = await Invoice.create({
      tenantId: testTenantId,
      invoiceNumber: `INV-${new Date().getFullYear()}-CN-GUARD`,
      customer: {
        _id: testCustomer._id,
        customerName: testCustomer.customerName
      },
      paymentType: 'Credit',
      items: [
        {
          product: {
            _id: testProductA._id,
            productName: testProductA.productName,
            gstPercentage: 12
          },
          quantitySold: 5,
          ratePerUnit: 100,
          baseAmount: 500,
          discountAmount: 0,
          taxableAmount: 500,
          gstAmount: 60,
          cgstAmount: 30,
          sgstAmount: 30,
          totalAmount: 560
        }
      ],
      totals: {
        baseAmount: 500,
        totalDiscount: 0,
        totalTaxable: 500,
        totalGST: 60,
        totalCGST: 30,
        totalSGST: 30,
        roundOff: 0,
        netTotal: 560,
        finalTotal: 560
      },
      paidAmount: 0,
      paymentStatus: 'Unpaid'
    });

    const returnReq: any = {
      body: {
        invoiceId: cnInvoice._id.toString(),
        items: [
          {
            productId: testProductA._id.toString(),
            quantityReturned: 10 // Sold only 5!
          }
        ],
        reason: 'Attempt excessive return'
      },
      headers: {},
      userRole: 'admin',
      user: {
        _id: testAdminId,
        id: testAdminId.toString(),
        role: 'admin',
        tenantId: testTenantId
      }
    };

    let cnResponse: any;
    await new Promise<void>((resolve, reject) => {
      const res: any = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this; },
        json(data: any) { cnResponse = { statusCode: this.statusCode, data }; resolve(); return this; }
      };
      const next = (err: any) => {
        cnResponse = { statusCode: err?.statusCode || 400, message: err?.message };
        resolve();
      };
      creditNoteController.createCreditNote(returnReq, res, next).catch(reject);
    });

    assert.equal(cnResponse.statusCode, 400, 'Credit note exceeding sold quantity must be rejected');
    console.log('  ✅ Credit note guardrail verified: returns exceeding sold quantities safely rejected');

    // 3.3 Edit Invoice Reduction Below Already Paid Amount Guardrail
    const partialInv = await Invoice.create({
      tenantId: testTenantId,
      invoiceNumber: `INV-${new Date().getFullYear()}-EDIT-GUARD`,
      customer: {
        _id: testCustomer._id,
        customerName: testCustomer.customerName
      },
      paymentType: 'Credit',
      items: [
        {
          product: {
            _id: testProductA._id,
            productName: testProductA.productName,
            gstPercentage: 0
          },
          quantitySold: 10,
          ratePerUnit: 100,
          baseAmount: 1000,
          discountAmount: 0,
          taxableAmount: 1000,
          gstAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          totalAmount: 1000
        }
      ],
      totals: {
        baseAmount: 1000,
        totalDiscount: 0,
        totalTaxable: 1000,
        totalGST: 0,
        totalCGST: 0,
        totalSGST: 0,
        roundOff: 0,
        netTotal: 1000,
        finalTotal: 1000
      },
      paidAmount: 600, // Customer already paid ₹600
      paymentStatus: 'Partial'
    });

    // Attempt to edit invoice reducing quantity to 2 (Total ₹200 < ₹600 paid)
    const editReq: any = {
      params: { id: partialInv._id.toString() },
      body: {
        items: [
          {
            productId: testProductA._id.toString(),
            quantitySold: 2,
            ratePerUnit: 100
          }
        ]
      },
      headers: {},
      userRole: 'admin',
      user: {
        _id: testAdminId,
        id: testAdminId.toString(),
        role: 'admin',
        tenantId: testTenantId
      }
    };

    let editResponse: any;
    await new Promise<void>((resolve, reject) => {
      const res: any = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this; },
        json(data: any) { editResponse = { statusCode: this.statusCode, data }; resolve(); return this; }
      };
      const next = (err: any) => {
        editResponse = { statusCode: err?.statusCode || 400, message: err?.message };
        resolve();
      };
      invoiceController.updateInvoice(editReq, res, next).catch(reject);
    });

    assert.equal(editResponse.statusCode, 400, 'Invoice reduction below paid amount must be rejected with 400');
    console.log('  ✅ Invoice reduction guardrail verified: edits cannot reduce invoice below paid amount');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Ledger Parity (Running Balance === Σ Debit - Σ Credit at Every Step)
  // ───────────────────────────────────────────────────────────────────────────
  test('Scenario 4: Merged Ledger Running Balance Matches Cumulative Debit - Credit Parity at Every Step', async () => {
    const ledgerCustomer = await Customer.create({
      tenantId: testTenantId,
      customerName: 'Ledger Audit Partner',
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      outstandingBalance: 0,
      totalPurchases: 0,
      invoiceCount: 0,
      isActive: true
    });

    const customerId = ledgerCustomer._id;

    // Simulate sequence of 6 distinct debit and credit transactions
    const baseDate = new Date('2026-01-01T10:00:00Z');

    // 1. Invoice 1 (Debit ₹1500)
    const inv1 = await Invoice.create({
      tenantId: testTenantId,
      invoiceNumber: 'INV-2026-LDG-001',
      invoiceDate: new Date(baseDate.getTime() + 1000 * 60 * 60 * 1),
      customer: { _id: customerId, customerName: ledgerCustomer.customerName },
      paymentType: 'Credit',
      items: [],
      totals: {
        baseAmount: 1500,
        totalDiscount: 0,
        totalTaxable: 1500,
        totalGST: 0,
        totalCGST: 0,
        totalSGST: 0,
        roundOff: 0,
        netTotal: 1500,
        finalTotal: 1500
      },
      paidAmount: 500,
      paymentStatus: 'Partial'
    });

    // 2. Payment 1 (Credit ₹500)
    await Payment.create({
      tenantId: testTenantId,
      customer: customerId,
      invoice: inv1._id,
      paymentDate: new Date(baseDate.getTime() + 1000 * 60 * 60 * 2),
      amount: 500,
      paymentMethod: 'UPI',
      referenceNumber: 'UPI-LDG-101'
    });

    // 3. Invoice 2 (Debit ₹2350.50)
    const inv2 = await Invoice.create({
      tenantId: testTenantId,
      invoiceNumber: 'INV-2026-LDG-002',
      invoiceDate: new Date(baseDate.getTime() + 1000 * 60 * 60 * 3),
      customer: { _id: customerId, customerName: ledgerCustomer.customerName },
      paymentType: 'Credit',
      items: [],
      totals: {
        baseAmount: 2350.50,
        totalDiscount: 0,
        totalTaxable: 2350.50,
        totalGST: 0,
        totalCGST: 0,
        totalSGST: 0,
        roundOff: 0,
        netTotal: 2350.50,
        finalTotal: 2350.50
      },
      paidAmount: 1000,
      paymentStatus: 'Partial'
    });

    // 4. Credit Note 1 (Credit ₹350.50)
    await CreditNote.create({
      tenantId: testTenantId,
      creditNoteNumber: 'CN-2026-LDG-001',
      invoiceId: inv2._id,
      invoiceNumber: inv2.invoiceNumber,
      createdAt: new Date(baseDate.getTime() + 1000 * 60 * 60 * 4),
      customer: { _id: customerId, customerName: ledgerCustomer.customerName },
      items: [],
      totals: {
        baseAmount: 350.50,
        totalDiscount: 0,
        totalTaxable: 350.50,
        totalGST: 0,
        totalCGST: 0,
        totalSGST: 0,
        roundOff: 0,
        netTotal: 350.50,
        finalTotal: 350.50
      }
    });

    // 5. Manual Bill (Debit ₹800.00)
    await ManualEntry.create({
      tenantId: testTenantId,
      customer: customerId,
      entryDate: new Date(baseDate.getTime() + 1000 * 60 * 60 * 5),
      entryType: 'manual_bill',
      amount: 800.00,
      paymentType: 'Credit',
      description: 'Supplemental adjustment charges'
    });

    // 6. Payment 2 (Credit ₹1000.00)
    await Payment.create({
      tenantId: testTenantId,
      customer: customerId,
      invoice: inv2._id,
      paymentDate: new Date(baseDate.getTime() + 1000 * 60 * 60 * 6),
      amount: 1000.00,
      paymentMethod: 'Bank Transfer',
      referenceNumber: 'NEFT-LDG-202'
    });

    // Fetch customer ledger via controller
    const ledgerReq: any = {
      params: { id: customerId.toString() },
      query: { limit: 100 },
      headers: {},
      userRole: 'admin',
      user: {
        _id: testAdminId,
        id: testAdminId.toString(),
        role: 'admin',
        tenantId: testTenantId
      }
    };

    let ledgerResult: any;
    await new Promise<void>((resolve, reject) => {
      const res: any = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this; },
        json(data: any) { ledgerResult = data; resolve(); return this; }
      };
      const next = (err: any) => reject(err);
      customerController.getCustomerLedger(ledgerReq, res, next).catch(reject);
    });

    assert.ok(ledgerResult.success, 'Ledger endpoint must succeed');
    const entries = ledgerResult.ledger;
    assert.equal(entries.length, 6, 'Must contain all 6 financial events');

    let runningSum = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      runningSum = round2(runningSum + entry.debit - entry.credit);

      assert.equal(
        entry.balance,
        runningSum,
        `Ledger row ${i + 1} (${entry.type}) balance ${entry.balance} must match cumulative running sum ${runningSum}`
      );
    }

    const expectedTotalDebit = round2(1500 + 2350.50 + 800); // 4650.50
    const expectedTotalCredit = round2(500 + 350.50 + 1000); // 1850.50
    const expectedClosingBalance = round2(expectedTotalDebit - expectedTotalCredit); // 2800.00

    assert.equal(ledgerResult.summary.totalDebit, expectedTotalDebit);
    assert.equal(ledgerResult.summary.totalCredit, expectedTotalCredit);
    assert.equal(ledgerResult.summary.closingBalance, expectedClosingBalance);
    assert.equal(entries[entries.length - 1].balance, expectedClosingBalance);

    // Call getCustomer and assert self-healing & liveDue parity
    const getCustomerReq: any = {
      params: { id: customerId.toString() },
      query: {},
      headers: {},
      userRole: 'admin',
      user: {
        _id: testAdminId,
        id: testAdminId.toString(),
        role: 'admin',
        tenantId: testTenantId
      }
    };

    let singleCustomerResult: any;
    await new Promise<void>((resolve, reject) => {
      const res: any = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this; },
        json(data: any) { singleCustomerResult = data; resolve(); return this; }
      };
      const next = (err: any) => reject(err);
      customerController.getCustomer(getCustomerReq, res, next).catch(reject);
    });

    assert.ok(singleCustomerResult.success);
    assert.equal(
      singleCustomerResult.customer.calculatedOutstanding,
      expectedClosingBalance,
      `getCustomer live calculated outstanding (${singleCustomerResult.customer.calculatedOutstanding}) must match ledger closing balance (${expectedClosingBalance})`
    );

    console.log(`  ✅ Ledger parity verified across all steps. Final closing balance ₹${expectedClosingBalance} matches getCustomer live due down to the exact paisa.`);
  });
});
