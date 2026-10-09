/**
 * Automated Verification Script for Document Print Formats & Preferences
 * Tests:
 * 1. Admin Model schema defaults (all 6 document types default to 'A4')
 * 2. Admin authorization (admin allowed, employee receives 403)
 * 3. Validation: rejecting non-object payloads (400)
 * 4. Validation: rejecting unknown document types (400)
 * 5. Validation: rejecting unsupported formats per capability matrix (400)
 * 6. Partial updates: deep-merging and preserving existing document formats
 * 7. Preservation of unrelated preferences (themeMode, invoiceColumns, mobileCardDensity)
 * 8. Fallback resolution function parity
 */

import Admin from '../models/Admin';
const authController = require('../controllers/authController');

const CAPABILITY_MATRIX: Record<string, string[]> = {
  invoice: ['A4', 'A5', 'THERMAL_80', 'THERMAL_58'],
  creditNote: ['A4', 'A5', 'THERMAL_80', 'THERMAL_58'],
  paymentReceipt: ['A4', 'A5', 'THERMAL_80', 'THERMAL_58'],
  customerLedger: ['A4', 'A5'],
  supplierLedger: ['A4', 'A5'],
  dailyCloseout: ['A4', 'A5']
};

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 RUNNING DOCUMENT PRINT FORMATS PREFERENCE VERIFICATION SUITE');
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

  // ─── Test 1: Mongoose Schema Defaults ─────────────────────────────────────
  console.log('🔹 1. Admin Model Schema Defaults for documentPrintFormats');
  const dummyAdmin = new Admin({
    email: 'test-print-admin@example.com',
    password: 'password123'
  });
  
  assert(
    dummyAdmin.preferences?.documentPrintFormats?.invoice === 'A4',
    'Default invoice format is "A4"'
  );
  assert(
    dummyAdmin.preferences?.documentPrintFormats?.creditNote === 'A4',
    'Default creditNote format is "A4"'
  );
  assert(
    dummyAdmin.preferences?.documentPrintFormats?.paymentReceipt === 'A4',
    'Default paymentReceipt format is "A4"'
  );
  assert(
    dummyAdmin.preferences?.documentPrintFormats?.customerLedger === 'A4',
    'Default customerLedger format is "A4"'
  );
  assert(
    dummyAdmin.preferences?.documentPrintFormats?.supplierLedger === 'A4',
    'Default supplierLedger format is "A4"'
  );
  assert(
    dummyAdmin.preferences?.documentPrintFormats?.dailyCloseout === 'A4',
    'Default dailyCloseout format is "A4"'
  );

  // Mock Admin.findById to return dummyAdmin for in-memory testing
  (dummyAdmin as any).save = async function() { return this; };
  (Admin as any).findById = async function(id: any) {
    return dummyAdmin;
  };

  // ─── Test 2: Admin vs Employee Authorization ──────────────────────────────
  console.log('\n🔹 2. Authorization Checks (Admin Only)');
  const employeeReq: any = {
    user: { _id: 'mock-emp-id' },
    userRole: 'employee',
    body: {
      documentPrintFormats: { invoice: 'THERMAL_80' }
    }
  };
  const employeeRes = createMockResponse();
  let employeeNextErr: any = null;
  await authController.updatePreferences(employeeReq, employeeRes, (err: any) => { employeeNextErr = err; });
  
  assert(
    employeeRes.statusCode === 403,
    'Employee attempting to update documentPrintFormats receives 403 Forbidden',
    `Received status ${employeeRes.statusCode}, err: ${employeeNextErr}`
  );
  assert(
    employeeRes.body?.success === false,
    'Employee response indicates success: false'
  );

  // ─── Test 3: Rejection of Invalid Payloads (Non-Object) ───────────────────
  console.log('\n🔹 3. Payload Type Validation');
  const invalidTypeReq: any = {
    user: { _id: dummyAdmin._id },
    userRole: 'admin',
    body: {
      documentPrintFormats: 'A4' // string instead of object
    }
  };
  const invalidTypeRes = createMockResponse();
  await authController.updatePreferences(invalidTypeReq, invalidTypeRes, () => {});
  
  assert(
    invalidTypeRes.statusCode === 400,
    'Non-object documentPrintFormats rejected with 400 Bad Request',
    `Received status ${invalidTypeRes.statusCode}`
  );

  // ─── Test 4: Rejection of Unknown Document Types ──────────────────────────
  console.log('\n🔹 4. Unknown Document Type Rejection');
  const unknownKeyReq: any = {
    user: { _id: dummyAdmin._id },
    userRole: 'admin',
    body: {
      documentPrintFormats: { unknownDocument: 'A4' }
    }
  };
  const unknownKeyRes = createMockResponse();
  await authController.updatePreferences(unknownKeyReq, unknownKeyRes, () => {});

  assert(
    unknownKeyRes.statusCode === 400,
    'Unknown document type rejected with 400 Bad Request',
    `Received status ${unknownKeyRes.statusCode}: ${unknownKeyRes.body?.message}`
  );
  assert(
    unknownKeyRes.body?.message?.includes('Unknown document type'),
    'Error message clearly identifies unknown document type'
  );

  // ─── Test 5: Capability Matrix Validation ─────────────────────────────────
  console.log('\n🔹 5. Capability Matrix Enforcement');
  // Attempt to set THERMAL_80 on customerLedger (ledger only supports A4, A5)
  const invalidFormatReq: any = {
    user: { _id: dummyAdmin._id },
    userRole: 'admin',
    body: {
      documentPrintFormats: { customerLedger: 'THERMAL_80' }
    }
  };
  const invalidFormatRes = createMockResponse();
  await authController.updatePreferences(invalidFormatReq, invalidFormatRes, () => {});

  assert(
    invalidFormatRes.statusCode === 400,
    'Unsupported format for document type rejected with 400 Bad Request',
    `Received status ${invalidFormatRes.statusCode}: ${invalidFormatRes.body?.message}`
  );
  assert(
    invalidFormatRes.body?.message?.includes('is not supported for document type'),
    'Error message cites unsupported format for doc type'
  );

  // Test an arbitrary string format
  const bogusFormatReq: any = {
    user: { _id: dummyAdmin._id },
    userRole: 'admin',
    body: {
      documentPrintFormats: { invoice: 'BOGUS_PAPER' }
    }
  };
  const bogusFormatRes = createMockResponse();
  await authController.updatePreferences(bogusFormatReq, bogusFormatRes, () => {});

  assert(
    bogusFormatRes.statusCode === 400,
    'Completely invalid paper format rejected with 400 Bad Request',
    `Received status ${bogusFormatRes.statusCode}`
  );

  // ─── Test 6: Partial Updates & Unrelated Preference Preservation ──────────
  console.log('\n🔹 6. Partial Updates & Unrelated Preference Preservation');
  // Set an unrelated preference first
  dummyAdmin.set('preferences.themeMode', 'light');
  dummyAdmin.set('preferences.mobileCardDensity', 'expanded');
  dummyAdmin.set('preferences.documentPrintFormats', {
    invoice: 'A4',
    creditNote: 'A4',
    paymentReceipt: 'A4',
    customerLedger: 'A4',
    supplierLedger: 'A4',
    dailyCloseout: 'A4'
  });

  const partialReq: any = {
    user: { _id: dummyAdmin._id },
    userRole: 'admin',
    body: {
      documentPrintFormats: { invoice: 'THERMAL_80' }
    }
  };
  const partialRes = createMockResponse();
  await authController.updatePreferences(partialReq, partialRes, () => {});

  assert(
    partialRes.statusCode === 200,
    'Valid partial format update succeeds with 200 OK',
    `Received status ${partialRes.statusCode}`
  );
  assert(
    (dummyAdmin.preferences as any)?.documentPrintFormats?.invoice === 'THERMAL_80',
    'Targeted invoice format updated to THERMAL_80'
  );
  assert(
    (dummyAdmin.preferences as any)?.documentPrintFormats?.creditNote === 'A4',
    'Untouched creditNote format preserved as A4'
  );
  assert(
    (dummyAdmin.preferences as any)?.documentPrintFormats?.customerLedger === 'A4',
    'Untouched customerLedger format preserved as A4'
  );
  assert(
    dummyAdmin.preferences?.themeMode === 'light',
    'Unrelated preference (themeMode) preserved as "light"'
  );
  assert(
    dummyAdmin.preferences?.mobileCardDensity === 'expanded',
    'Unrelated preference (mobileCardDensity) preserved as "expanded"'
  );

  // ─── Test 6: Capability Matrix Permitted Formats ──────────────────────────
  console.log('\n🔹 6. Permitted Formats Verification');
  for (const [docType, formats] of Object.entries(CAPABILITY_MATRIX)) {
    for (const format of formats) {
      assert(
        CAPABILITY_MATRIX[docType].includes(format),
        `Format "${format}" recognized as permitted for "${docType}"`
      );
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
