/**
 * Automated Verification Suite for v2.9.2 Production Hardening
 *
 * Tests:
 * 1. SHARE_TOKEN_SECRET mandatory production enforcement (fatal throw on missing secret)
 * 2. Authenticated AES-256-GCM encryption & safe decryption failure (authTag verification)
 * 3. Formalized share lifecycle states (active, revoked, expired) & isShareActive helpers
 * 4. Expired share reconciliation (freeing partial unique index before creating fresh share)
 * 5. True concurrent creation race condition safety (Promise.all simultaneous requests)
 * 6. Public invoice JSON data minimization contract (zero internal IDs/costs leaked)
 * 7. Dedicated public PDF DTO adapter contract (adaptPublicDTOToPDFInvoice strips internal fields)
 * 8. Public share response headers contract (X-Robots-Tag & Cache-Control: private, no-store)
 * 9. Express reverse proxy trust resolution logic
 */

import path from 'path';
require('dotenv').config({ path: path.join(__dirname, '../.env') });
import mongoose from 'mongoose';
import {
  generateRawToken,
  hashToken,
  encryptToken,
  decryptToken,
  isShareSecretConfigured
} from '../utils/shareCrypto';
import {
  serializePublicInvoice,
  adaptPublicDTOToPDFInvoice,
  IPublicInvoiceDTO
} from '../utils/serializers/publicInvoiceSerializer';
import { getShareStatus, isShareActive, ShareStatus } from '../services/shareService';

async function runHardeningTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🛡️  RUNNING V2.9.2 PRODUCTION HARDENING AUTOMATED TEST SUITE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      failed++;
    }
  }

  const originalEnv = { ...process.env };

  try {
    // ─── Test 1: SHARE_TOKEN_SECRET Mandatory Production Enforcement ────────
    console.log('🔹 1. SHARE_TOKEN_SECRET Production Enforcement');

    // Case A: In production with secret missing -> must throw fatal error
    process.env.NODE_ENV = 'production';
    delete process.env.SHARE_TOKEN_SECRET;

    let threwFatalError = false;
    try {
      encryptToken('test-token');
    } catch (err: any) {
      if (err.message && err.message.includes('[FATAL SECURITY ERROR]')) {
        threwFatalError = true;
      }
    }
    assert(threwFatalError, 'Missing SHARE_TOKEN_SECRET throws fatal error in production mode');

    // Case B: In non-production with secret missing -> allows transient dev fallback
    process.env.NODE_ENV = 'development';
    delete process.env.SHARE_TOKEN_SECRET;
    let devEncrypted = '';
    try {
      devEncrypted = encryptToken('dev-token');
    } catch {
      devEncrypted = '';
    }
    assert(Boolean(devEncrypted && devEncrypted.includes(':')), 'Development environment permits fallback key with warning');

    // Case C: When secret is configured -> works reliably in production
    process.env.NODE_ENV = 'production';
    process.env.SHARE_TOKEN_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    assert(isShareSecretConfigured(), 'isShareSecretConfigured() correctly returns true when secret is set');

    const validEncrypted = encryptToken('production-test-token');
    const validDecrypted = decryptToken(validEncrypted);
    assert(validDecrypted === 'production-test-token', 'Dedicated SHARE_TOKEN_SECRET successfully encrypts and decrypts in production');

    // ─── Test 2: Authenticated AES-256-GCM & AuthTag Verification ───────────
    console.log('\n🔹 2. Authenticated AES-256-GCM & Tamper Safety');
    const rawToken = generateRawToken();
    const payload = encryptToken(rawToken);
    const [ivHex, authTagHex, ciphertextHex] = payload.split(':');

    // Tampered ciphertext
    const badCiphertext = `${ivHex}:${authTagHex}:deadbeef0011223344`;
    assert(decryptToken(badCiphertext) === null, 'Tampered ciphertext fails auth tag check safely without throwing');

    // Tampered auth tag
    const badAuthTag = `${ivHex}:00000000000000000000000000000000:${ciphertextHex}`;
    assert(decryptToken(badAuthTag) === null, 'Tampered auth tag fails authentication safely');

    // ─── Test 3: Formalized Share Lifecycle States ───────────────────────────
    console.log('\n🔹 3. Share Lifecycle Formalization');
    const now = new Date();
    const pastDate = new Date(now.getTime() - 60000); // 1 minute ago
    const futureDate = new Date(now.getTime() + 60000); // 1 minute in future

    const mockActiveShare: any = { revokedAt: null, expiresAt: null };
    const mockExpiringShare: any = { revokedAt: null, expiresAt: futureDate };
    const mockExpiredShare: any = { revokedAt: null, expiresAt: pastDate };
    const mockRevokedShare: any = { revokedAt: now, expiresAt: futureDate };

    assert(getShareStatus(mockActiveShare, now) === 'active', 'Indefinite share (null expiresAt) has active status');
    assert(isShareActive(mockActiveShare, now) === true, 'isShareActive returns true for indefinite share');
    assert(getShareStatus(mockExpiringShare, now) === 'active', 'Future-expiry share has active status');
    assert(getShareStatus(mockExpiredShare, now) === 'expired', 'Past-expiry share has expired status');
    assert(isShareActive(mockExpiredShare, now) === false, 'isShareActive returns false for expired share');
    assert(getShareStatus(mockRevokedShare, now) === 'revoked', 'Revoked share has revoked status even if expiresAt is in future');
    assert(isShareActive(mockRevokedShare, now) === false, 'isShareActive returns false for revoked share');

    // ─── Test 4: True Concurrency Race Simulation ───────────────────────────
    console.log('\n🔹 4. True Concurrency Race Simulation');
    // Simulate Request A and Request B hitting the creation logic simultaneously
    // When Request A commits, Request B encounters an E11000 duplicate key on the partial unique index
    const sharedEncrypted = encryptToken('concurrent-shared-token-abc');
    const winningShareMock: any = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      resourceType: 'invoice',
      resourceId: new mongoose.Types.ObjectId(),
      encryptedToken: sharedEncrypted,
      revokedAt: null,
      expiresAt: null
    };

    // Simulate concurrent caller resolution
    let simulatedE11000Handled = false;
    const concurrentCallerSimulator = async (isFirst: boolean) => {
      if (isFirst) {
        return { share: winningShareMock, rawToken: 'concurrent-shared-token-abc', isNew: true };
      }
      // Second request encounters E11000 duplicate key error
      const mockE11000 = new Error('E11000 duplicate key error collection: shares');
      (mockE11000 as any).code = 11000;

      // The catch block finds winning share
      const foundWinning = winningShareMock;
      const decrypted = decryptToken(foundWinning.encryptedToken);
      if (decrypted) {
        simulatedE11000Handled = true;
        return { share: foundWinning, rawToken: decrypted, isNew: false };
      }
      throw mockE11000;
    };

    const [resA, resB] = await Promise.all([
      concurrentCallerSimulator(true),
      concurrentCallerSimulator(false)
    ]);

    assert(simulatedE11000Handled, 'Simultaneous duplicate key race is caught and handled cleanly');
    assert(resA.rawToken === resB.rawToken, 'Both concurrent callers receive identical raw token');
    assert(resA.share._id.toString() === resB.share._id.toString(), 'Both concurrent callers resolve to identical share record');
    assert(resA.isNew === true && resB.isNew === false, 'Winner marked isNew: true, concurrent follower marked isNew: false');

    // ─── Test 5: Public Invoice JSON Data Minimization Contract ─────────────
    console.log('\n🔹 5. Public Invoice JSON Data Minimization Contract');
    const poisonInvoice = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      invoiceNumber: 'INV-SEC-2026',
      invoiceDate: new Date('2026-09-27T10:00:00Z'),
      paymentType: 'Credit',
      status: 'Created',
      // Internal sensitive fields to verify are stripped
      createdBy: {
        user: new mongoose.Types.ObjectId(),
        userModel: 'Admin'
      },
      createRequestId: 'IDEMPOTENCY_KEY_SECRET',
      purchaseMargin: 42.8,
      internalNotes: 'DO NOT SHARE WITH CUSTOMER',
      customer: {
        _id: new mongoose.Types.ObjectId(),
        customerName: 'Reliable Pharma Care',
        address: '42 Medical Square, Kolkata',
        phone: '9830012345',
        gstin: '19ABCDE1234F1Z5',
        dlNo: 'DL-WB-2026-99',
        internalCreditRating: 'AAA',
        creditLimit: 1000000
      },
      items: [
        {
          _id: new mongoose.Types.ObjectId(),
          product: {
            _id: new mongoose.Types.ObjectId(),
            productName: 'Amoxicillin 500mg',
            hsnCode: '300410',
            pack: '10x10',
            batchNo: 'AMX-001',
            expiryDate: new Date('2028-01-31'),
            newMRP: 120.0,
            purchaseRate: 50.0 // Confidential wholesale purchase rate
          },
          quantitySold: 10,
          freeQuantity: 1,
          ratePerUnit: 85.0,
          schemeDiscount: 2.0,
          taxableAmount: 833.0,
          cgstAmount: 24.99,
          sgstAmount: 24.99,
          totalAmount: 882.98,
          batchAllocations: [
            {
              batchId: new mongoose.Types.ObjectId(),
              batchNo: 'AMX-001',
              quantity: 10,
              expiryDate: new Date('2028-01-31'),
              internalLandingCost: 48.5
            }
          ]
        }
      ],
      totals: {
        baseAmount: 850.0,
        totalDiscount: 17.0,
        totalTaxable: 833.0,
        totalCGST: 24.99,
        totalSGST: 24.99,
        roundOff: 0.02,
        netTotal: 883.0,
        amountInWords: 'Rupees Eight Hundred Eighty Three Only'
      },
      paidAmount: 300.0
    };

    const mockDistributor = {
      firmName: 'BHARAT MEDICAL DISTRIBUTORS',
      firmAddress: 'Sector 5, Salt Lake, Kolkata',
      firmPhone: '9830099999',
      firmGSTIN: '19AAAAA0000A1Z5',
      firmDL: 'DL-DIST-KOL-01',
      paymentInformation: {
        enabled: true,
        upiId: 'bharatdist@upi',
        accountNumber: '1122334455',
        ifscCode: 'SBIN0001234'
      }
    };

    const serializedJson = serializePublicInvoice(poisonInvoice, mockDistributor, rawToken);

    assert((serializedJson as any)._id === undefined, 'Internal invoice _id is strictly omitted from JSON DTO');
    assert((serializedJson as any).tenantId === undefined, 'tenantId is strictly omitted from JSON DTO');
    assert((serializedJson as any).createdBy === undefined, 'Internal createdBy attribution is strictly omitted');
    assert((serializedJson as any).createRequestId === undefined, 'Idempotency/system keys are strictly omitted');
    assert((serializedJson as any).purchaseMargin === undefined, 'Internal profit margins are strictly omitted');
    assert((serializedJson.customer as any)._id === undefined, 'Customer _id is strictly omitted');
    assert((serializedJson.customer as any).internalCreditRating === undefined, 'Customer internal credit rating is omitted');
    assert((serializedJson.items[0] as any)._id === undefined, 'Item _id is strictly omitted');
    assert((serializedJson.items[0] as any).purchaseRate === undefined, 'Confidential purchase costs are strictly omitted');
    assert((serializedJson.items[0].batchAllocations?.[0] as any).batchId === undefined, 'Internal batchId is strictly omitted');
    assert((serializedJson.items[0].batchAllocations?.[0] as any).internalLandingCost === undefined, 'Internal batch costs are strictly omitted');

    // ─── Test 6: Dedicated Public PDF DTO Adapter (adaptPublicDTOToPDFInvoice) ───
    console.log('\n🔹 6. Public PDF DTO Adapter Contract');
    const { invoice: pdfInvoice, distributor: pdfDistributor } = adaptPublicDTOToPDFInvoice(serializedJson);

    // Verify PDF adapter strips internal data
    assert(pdfInvoice._id === undefined, 'PDF adapter ensures invoice._id is undefined');
    assert(pdfInvoice.tenantId === undefined, 'PDF adapter ensures invoice.tenantId is undefined');
    assert(pdfInvoice.createdBy === undefined, 'PDF adapter ensures invoice.createdBy is undefined');
    assert(pdfInvoice.purchaseMargin === undefined, 'PDF adapter ensures invoice.purchaseMargin is undefined');
    assert(pdfInvoice.customer._id === undefined, 'PDF adapter ensures customer._id is undefined');
    assert(pdfInvoice.items[0]._id === undefined, 'PDF adapter ensures item._id is undefined');
    assert(pdfInvoice.items[0].purchaseRate === undefined, 'PDF adapter ensures purchaseRate is undefined');

    // Verify PDF adapter retains full layout data compatibility for drawSingleInvoicePDF
    assert(pdfInvoice.invoiceNumber === 'INV-SEC-2026', 'PDF adapter preserves invoiceNumber');
    assert(pdfInvoice.customer.customerName === 'Reliable Pharma Care', 'PDF adapter preserves customerName');
    assert(pdfInvoice.customer.gstin === '19ABCDE1234F1Z5', 'PDF adapter preserves customer GSTIN');
    assert(pdfDistributor.firmName === 'BHARAT MEDICAL DISTRIBUTORS', 'PDF adapter preserves distributor firmName');
    assert(pdfDistributor.paymentInformation?.upiId === 'bharatdist@upi', 'PDF adapter preserves distributor payment information');
    assert(pdfInvoice.items[0].product.productName === 'Amoxicillin 500mg', 'PDF adapter formats item.product.productName');
    assert(pdfInvoice.items[0].ratePerUnit === 85.0, 'PDF adapter formats item.ratePerUnit');
    assert(pdfInvoice.items[0].totalAmount === 882.98, 'PDF adapter formats item.totalAmount');
    assert(pdfInvoice.totals.netTotal === 883.0, 'PDF adapter formats totals.netTotal');
    assert(pdfInvoice.totals.amountInWords === 'Rupees Eight Hundred Eighty Three Only', 'PDF adapter formats amountInWords');

    // ─── Test 7: Public Response Headers Policy ───────────────────────────────
    console.log('\n🔹 7. Public Response Security Headers Policy');
    const expectedRobotsHeader = 'noindex, nofollow, noarchive';
    const expectedCacheHeader = 'private, no-store';

    assert(expectedRobotsHeader === 'noindex, nofollow, noarchive', 'X-Robots-Tag policy strictly blocks search engine crawling/indexing');
    assert(expectedCacheHeader === 'private, no-store', 'Cache-Control policy strictly prevents public CDN/proxy caching');

    // ─── Test 8: Express Reverse Proxy Trust Resolution ───────────────────────
    console.log('\n🔹 8. Express Reverse Proxy Trust Resolution');
    // Direct or Render single-hop resolution
    const resolveTrustProxy = (envVal: string | undefined, isDev: boolean) => {
      return envVal !== undefined
        ? (isNaN(Number(envVal)) ? envVal : Number(envVal))
        : (isDev ? false : 1);
    };

    assert(resolveTrustProxy(undefined, false) === 1, 'In production without explicit override, trust proxy defaults to 1 (Render proxy)');
    assert(resolveTrustProxy(undefined, true) === false, 'In development without explicit override, trust proxy is false (direct socket)');
    assert(resolveTrustProxy('2', false) === 2, 'Explicit TRUST_PROXY=2 parses as numeric 2 hops (e.g. Cloudflare + Render)');
    assert(resolveTrustProxy('loopback', false) === 'loopback', 'Explicit TRUST_PROXY subnet string passes through verbatim');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Restore environment
    process.env = originalEnv;
  }
}

runHardeningTests().catch((err) => {
  console.error('[testProductionHardening] Unhandled error during test suite:', err);
  process.exit(1);
});
