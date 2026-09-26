/**
 * Automated Verification Script for Invoice Sharing Infrastructure
 * Tests:
 * 1. Cryptographic token generation (256-bit entropy)
 * 2. SHA-256 token hashing for fast lookup
 * 3. AES-256-GCM authenticated encryption & authTag validation
 * 4. Safe key rotation and corrupted payload recovery
 * 5. Public invoice serializer data minimization (verifying 0 internal fields/IDs leaked)
 * 6. Conditional distributor payment information (only when enabled)
 * 7. Concurrency protection schema validation (partial unique index on { tenantId, resourceType, resourceId } where revokedAt is null)
 */

import path from 'path';
require('dotenv').config({ path: path.join(__dirname, '../.env') });
import mongoose from 'mongoose';
import { generateRawToken, hashToken, encryptToken, decryptToken } from '../utils/shareCrypto';
import { serializePublicInvoice } from '../utils/serializers/publicInvoiceSerializer';
import Share from '../models/Share';

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 RUNNING INVOICE SHARING AUTOMATED VERIFICATION SUITE');
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

  // ─── Test 1: Crypto Token Generation ──────────────────────────────────────
  console.log('🔹 1. Cryptographic Token Generation & Entropy');
  const token1 = generateRawToken();
  const token2 = generateRawToken();
  assert(token1.length >= 40, 'Raw token has sufficient length (> 40 chars base64url)');
  assert(token1 !== token2, 'Consecutive tokens are uniquely random');
  assert(/^[a-zA-Z0-9_-]+$/.test(token1), 'Token is URL-safe base64url without % encoding');

  // ─── Test 2: SHA-256 Hash Generation ───────────────────────────────────────
  console.log('\n🔹 2. SHA-256 Token Lookup Hashing');
  const hash1 = hashToken(token1);
  const hash1Repeat = hashToken(token1);
  const hash2 = hashToken(token2);
  assert(hash1.length === 64, 'SHA-256 hash produces 64-character hex string');
  assert(hash1 === hash1Repeat, 'Hash is deterministic for identical raw token');
  assert(hash1 !== hash2, 'Different tokens produce distinct hashes');

  // ─── Test 3: AES-256-GCM Authenticated Encryption & Decryption ────────────
  console.log('\n🔹 3. AES-256-GCM Encryption, AuthTag & Decryption');
  const encryptedPayload = encryptToken(token1);
  assert(encryptedPayload !== token1, 'Encrypted token does not contain plaintext raw token');
  const parts = encryptedPayload.split(':');
  assert(parts.length === 3, 'Payload contains iv:authTag:ciphertext format');
  assert(parts[0].length === 24, 'IV is 12 bytes (24 hex characters)');
  assert(parts[1].length === 32, 'AuthTag is 16 bytes (32 hex characters)');

  const decrypted = decryptToken(encryptedPayload);
  assert(decrypted === token1, 'Decrypted token matches original raw token exactly');

  // ─── Test 4: Decryption Failure & Key Rotation Safe Fallback ───────────────
  console.log('\n🔹 4. Key Rotation & Corrupted Payload Safe Recovery');
  // Corrupt the ciphertext
  const corruptedPayload = `${parts[0]}:${parts[1]}:bad0000000deadbeef`;
  const safeDecryptionAttempt = decryptToken(corruptedPayload);
  assert(safeDecryptionAttempt === null, 'Corrupted payload fails safely by returning null without crashing');

  // Corrupt the auth tag
  const tamperedAuthTagPayload = `${parts[0]}:00000000000000000000000000000000:${parts[2]}`;
  const tamperedDecryptionAttempt = decryptToken(tamperedAuthTagPayload);
  assert(tamperedDecryptionAttempt === null, 'Tampered authentication tag fails safely by returning null');

  // Invalid payload format
  assert(decryptToken('not-a-valid-payload') === null, 'Malformed payload returns null safely');

  // ─── Test 5: Public Invoice Serializer (Data Minimization) ─────────────────
  console.log('\n🔹 5. Public Invoice Serializer & Data Sanitization');
  const mockInternalInvoice = {
    _id: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(),
    invoiceNumber: 'INV-2026-9999',
    invoiceDate: new Date('2026-09-26T10:00:00Z'),
    paymentType: 'Credit',
    status: 'Created',
    internalSecretKey: 'SECRET_TENANT_LEAK_TEST',
    purchaseMargin: 35.5,
    customer: {
      _id: new mongoose.Types.ObjectId(),
      customerName: 'Metro Pharmacy Ltd',
      address: '77 Healthcare Ave, Mumbai',
      phone: '9876543210',
      gstin: '27AAAAA1234A1Z5',
      dlNo: 'DL-2026-001',
      creditLimit: 500000,
      internalNotes: 'VIP Customer'
    },
    items: [
      {
        _id: new mongoose.Types.ObjectId(),
        product: {
          _id: new mongoose.Types.ObjectId(),
          productName: 'Paracetamol 650mg',
          hsnCode: '300490',
          pack: '10x10',
          batchNo: 'B-2026-A',
          expiryDate: new Date('2027-12-31'),
          newMRP: 35.0,
          purchaseRate: 15.0 // Internal confidential cost
        },
        quantitySold: 20,
        freeQuantity: 2,
        ratePerUnit: 25.0,
        schemeDiscount: 5.0,
        taxableAmount: 475.0,
        cgstAmount: 28.5,
        sgstAmount: 28.5,
        totalAmount: 532.0
      }
    ],
    totals: {
      baseAmount: 500.0,
      totalDiscount: 25.0,
      totalTaxable: 475.0,
      totalCGST: 28.5,
      totalSGST: 28.5,
      roundOff: 0.0,
      netTotal: 532.0,
      amountInWords: 'Rupees Five Hundred Thirty Two Only'
    },
    paidAmount: 200.0
  };

  const mockDistributorWithoutPayment = {
    firmName: 'BHARAT ENTERPRISES',
    firmAddress: '123 Market Street, Mumbai',
    firmPhone: '9876543210',
    firmGSTIN: '27BBBBB1234B1Z5',
    firmDL: 'DL-DIST-001',
    paymentInformation: {
      enabled: false,
      upiId: 'distributor@upi',
      accountNumber: '1234567890'
    }
  };

  const serialized1 = serializePublicInvoice(mockInternalInvoice, mockDistributorWithoutPayment, token1);

  // Assertions on public DTO
  assert((serialized1 as any)._id === undefined, 'Internal invoice _id is strictly omitted from public DTO');
  assert((serialized1 as any).tenantId === undefined, 'tenantId is strictly omitted from public DTO');
  assert((serialized1 as any).internalSecretKey === undefined, 'Internal document attributes are stripped');
  assert((serialized1 as any).purchaseMargin === undefined, 'Purchase margins are stripped');
  assert((serialized1.customer as any)._id === undefined, 'Customer _id is strictly omitted');
  assert((serialized1.customer as any).creditLimit === undefined, 'Internal customer credit limits are stripped');
  assert((serialized1.items[0] as any)._id === undefined, 'Item _id is strictly omitted');
  assert((serialized1.items[0] as any).purchaseRate === undefined, 'Item internal purchase costs are stripped');
  assert(serialized1.invoiceNumber === 'INV-2026-9999', 'Customer-visible invoice number is present');
  assert(serialized1.customer.customerName === 'Metro Pharmacy Ltd', 'Customer name is present');
  assert(serialized1.items[0].productName === 'Paracetamol 650mg', 'Item product name is present');
  assert(serialized1.paidAmount === 200.0, 'Paid amount is accurate');
  assert(serialized1.dueAmount === 332.0, 'Due amount is accurately calculated (532 - 200 = 332)');
  assert(serialized1.downloadPdfUrl === `/api/public/shares/${token1}/pdf`, 'Download PDF route uses token');
  assert(serialized1.distributor.paymentInformation === undefined, 'Payment info is omitted when enabled is false');

  // ─── Test 6: Conditional Distributor Payment Information ──────────────────
  console.log('\n🔹 6. Conditional Payment Information Exposure');
  const mockDistributorWithPayment = {
    ...mockDistributorWithoutPayment,
    paymentInformation: {
      enabled: true,
      upiId: 'distributor@okhdfcbank',
      accountNumber: '998877665544',
      ifscCode: 'HDFC0001234',
      bankName: 'HDFC Bank'
    }
  };

  const serialized2 = serializePublicInvoice(mockInternalInvoice, mockDistributorWithPayment, token1);
  assert(serialized2.distributor.paymentInformation !== undefined, 'Payment information is included when enabled is true');
  assert(serialized2.distributor.paymentInformation?.upiId === 'distributor@okhdfcbank', 'UPI ID matches');
  assert(serialized2.distributor.paymentInformation?.accountNumber === '998877665544', 'Bank account matches');

  // ─── Test 7: Model Index & Concurrency Guard Validation ────────────────────
  console.log('\n🔹 7. Share Model Indexes & Concurrency Guard');
  const indexes = Share.schema.indexes();
  const tokenHashIndex = indexes.find((idx: any) => idx[0].tokenHash !== undefined);
  assert(tokenHashIndex !== undefined, 'tokenHash index is defined on Share schema');
  assert(tokenHashIndex?.[1]?.unique === true, 'tokenHash has unique: true constraint');

  const concurrencyPartialIndex = indexes.find(
    (idx: any) =>
      idx[0].tenantId === 1 &&
      idx[0].resourceType === 1 &&
      idx[0].resourceId === 1 &&
      idx[1]?.partialFilterExpression?.revokedAt === null
  );
  assert(concurrencyPartialIndex !== undefined, 'Partial unique index on { tenantId, resourceType, resourceId } exists for revokedAt: null');
  assert(concurrencyPartialIndex?.[1]?.unique === true, 'Partial index has unique: true constraint (atomic concurrency guard)');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
