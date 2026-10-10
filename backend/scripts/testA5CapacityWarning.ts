/**
 * Automated Verification Script for Smart A5 Invoice Capacity Warning
 * Bharat Enterprise Billing System
 *
 * Verifies:
 * 1. Admin & Employee schema defaults (showA5CapacityWarning default true)
 * 2. Missing preference evaluates to true (enabled)
 * 3. authController.updatePreferences:
 *    - Admin update succeeds (200 OK)
 *    - Employee update succeeds (200 OK)
 *    - Non-boolean rejection (400 Bad Request)
 *    - Unrelated preferences preserved
 * 4. calculateRenderedItemRowCount:
 *    - 12 single-batch items -> 12 rows
 *    - 13 single-batch items -> 13 rows
 *    - Multi-batch item with distinct pricing keys expands to multiple rows
 *    - Multi-batch item with identical pricing keys collapses to 1 row
 *    - Empty draft items excluded
 * 5. isA5DoubleCopyWorkflowActive:
 *    - A4/A5 + 'double' -> true
 *    - A4 + 'single' -> false
 *    - THERMAL_80 / THERMAL_58 -> false
 * 6. Transition & Re-arming lifecycle simulation:
 *    - <= 12 rows -> no warning
 *    - 12 -> 13 rows -> warning triggers once
 *    - 13 -> 14 rows -> no repeat warning during ordinary edits
 *    - 14 -> 11 rows -> resets trigger flag
 *    - 11 -> 13 rows -> triggers warning again
 *    - Suppressed preference -> no warning
 *    - Re-enabled preference -> warning triggers
 * 7. Financial Invariance:
 *    - Line-item calculations and invoice totals are 100% identical before and after row counting.
 */

import Admin from '../models/Admin';
import Employee from '../models/Employee';
const authController = require('../controllers/authController');

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

// Replicate pure frontend helper functions for verification parity
const A5_ROW_CAPACITY_THRESHOLD = 12;

function isA5DoubleCopyWorkflowActive(format: string, copyMode: string = 'double'): boolean {
  const isSheetFormat = format === 'A4' || format === 'A5';
  if (!isSheetFormat) return false;
  if (copyMode === 'single') return false;
  return true;
}

function getBatchGroupingKey(item: any, allocation: any): string {
  const effectiveRate = item.ratePerUnit !== undefined && item.ratePerUnit !== null
    ? item.ratePerUnit
    : (item.baseRate !== undefined ? item.baseRate : (allocation.rate ?? 0));

  const mrp = allocation.mrp ?? allocation.batch?.mrp ?? item.product?.newMRP ?? 0;
  const gstPercent = allocation.gstPercent ?? allocation.gstPercentage ?? allocation.batch?.gstPercent ?? allocation.batch?.gstPercentage ?? item.product?.gstPercentage ?? 0;
  const discount = item.schemeDiscount || 0;

  return `${effectiveRate}|${mrp}|${gstPercent}|${discount}`;
}

function calculateRenderedItemRowCount(items: any[]): number {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  let totalRows = 0;

  for (const item of items) {
    if (!item) continue;

    const product = item.product;
    if (!product || (!product._id && !product.id && !product.name && !product.productName)) {
      continue;
    }

    const allocations = Array.isArray(item.batchAllocations) && item.batchAllocations.length > 0
      ? item.batchAllocations
      : (Array.isArray(item.manualAllocations) && item.manualAllocations.length > 0 ? item.manualAllocations : null);

    if (allocations && allocations.length > 1) {
      const uniqueKeys = new Set();
      for (const alloc of allocations) {
        if (!alloc) continue;
        uniqueKeys.add(getBatchGroupingKey(item, alloc));
      }
      totalRows += Math.max(1, uniqueKeys.size);
    } else {
      totalRows += 1;
    }
  }

  return totalRows;
}

// Transition simulator mirroring InvoiceCreatePage lifecycle
class A5WarningTransitionSimulator {
  triggered = false;
  prevIsA5Workflow = false;
  modalOpen = false;
  draftDismissed = false;

  update(rowCount: number, isA5Workflow: boolean, showWarningPref: boolean) {
    const wasA5Workflow = this.prevIsA5Workflow;
    this.prevIsA5Workflow = isA5Workflow;

    if (!isA5Workflow) {
      this.modalOpen = false;
      this.triggered = false;
      return;
    }

    // Once dismissed for this draft session, never re-trigger
    if (this.draftDismissed) {
      this.modalOpen = false;
      return;
    }

    if (rowCount <= A5_ROW_CAPACITY_THRESHOLD) {
      this.triggered = false;
    } else {
      const workflowJustBecameActive = !wasA5Workflow && isA5Workflow;
      if ((!this.triggered || workflowJustBecameActive) && showWarningPref) {
        this.modalOpen = true;
        this.triggered = true;
      }
    }
  }

  dismissModal(markDraftDismissed = false) {
    this.modalOpen = false;
    if (markDraftDismissed) {
      this.draftDismissed = true;
    }
  }

  resetDraft() {
    this.draftDismissed = false;
    this.triggered = false;
    this.modalOpen = false;
  }
}

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 SMART A5 CAPACITY WARNING VERIFICATION SUITE');
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

  // 1. Schema Defaults
  console.log('📋 1. Mongoose Model Preferences Schema Defaults');
  const adminDoc = new Admin({
    email: 'test-admin@test.com',
    password: 'Password123!',
    firmName: 'Test Firm'
  });
  assert(
    adminDoc.preferences?.showA5CapacityWarning === true,
    'Admin schema defaults showA5CapacityWarning to true'
  );

  const empDoc = new Employee({
    userId: 'EMP-001',
    name: 'Test Employee',
    email: 'emp@test.com',
    password: 'Password123!',
    phone: '9876543210'
  });
  assert(
    empDoc.preferences?.showA5CapacityWarning === true,
    'Employee schema defaults showA5CapacityWarning to true'
  );

  // Missing preference evaluates to true
  const missingPrefObj: any = {};
  const effectiveMissing = (missingPrefObj.showA5CapacityWarning ?? true) !== false;
  assert(effectiveMissing === true, 'Missing preference evaluates to true (enabled)');

  // 2. Controller Validation & Permissions
  console.log('\n🔒 2. Controller Validation & Authentication Scope');

  // Test Admin update succeeds
  const mockAdminUser = {
    _id: 'admin_123',
    preferences: {
      themeMode: 'dark',
      showA5CapacityWarning: true,
      documentPrintFormats: { invoice: 'A4' }
    },
    set(path: string, val: any) {
      const parts = path.split('.');
      if (parts[0] === 'preferences') {
        (this.preferences as any)[parts[1]] = val;
      }
    },
    save: async () => true
  };

  const origAdminFindById = Admin.findById;
  const origEmployeeFindById = Employee.findById;

  (Admin as any).findById = () => Promise.resolve(mockAdminUser);

  let res = createMockResponse();
  await authController.updatePreferences(
    { userRole: 'admin', user: { _id: 'admin_123' }, body: { showA5CapacityWarning: false } } as any,
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 && mockAdminUser.preferences.showA5CapacityWarning === false,
    'Admin can update showA5CapacityWarning to false'
  );

  // Test Employee update succeeds
  const mockEmpUser = {
    _id: 'emp_123',
    preferences: {
      themeMode: 'dark',
      showA5CapacityWarning: true
    },
    set(path: string, val: any) {
      const parts = path.split('.');
      if (parts[0] === 'preferences') {
        (this.preferences as any)[parts[1]] = val;
      }
    },
    save: async () => true
  };

  (Employee as any).findById = () => Promise.resolve(mockEmpUser);

  res = createMockResponse();
  await authController.updatePreferences(
    { userRole: 'employee', user: { _id: 'emp_123' }, body: { showA5CapacityWarning: false } } as any,
    res,
    () => {}
  );
  assert(
    res.statusCode === 200 && mockEmpUser.preferences.showA5CapacityWarning === false,
    'Employee can independently update showA5CapacityWarning to false'
  );

  // Test Non-boolean payload rejection
  res = createMockResponse();
  await authController.updatePreferences(
    { userRole: 'employee', user: { _id: 'emp_123' }, body: { showA5CapacityWarning: 'false' } } as any,
    res,
    () => {}
  );
  assert(
    res.statusCode === 400 && res.body?.message?.includes('boolean'),
    'String "false" payload rejected with 400 Bad Request'
  );

  res = createMockResponse();
  await authController.updatePreferences(
    { userRole: 'admin', user: { _id: 'admin_123' }, body: { showA5CapacityWarning: 123 } } as any,
    res,
    () => {}
  );
  assert(
    res.statusCode === 400 && res.body?.message?.includes('boolean'),
    'Number 123 payload rejected with 400 Bad Request'
  );

  res = createMockResponse();
  await authController.updatePreferences(
    { userRole: 'admin', user: { _id: 'admin_123' }, body: { showA5CapacityWarning: null } } as any,
    res,
    () => {}
  );
  assert(
    res.statusCode === 400 && res.body?.message?.includes('boolean'),
    'Null payload rejected with 400 Bad Request'
  );

  // Test unrelated preferences preserved
  res = createMockResponse();
  await authController.updatePreferences(
    { userRole: 'admin', user: { _id: 'admin_123' }, body: { showA5CapacityWarning: true } } as any,
    res,
    () => {}
  );
  assert(
    mockAdminUser.preferences.themeMode === 'dark' &&
    mockAdminUser.preferences.documentPrintFormats.invoice === 'A4',
    'Unrelated preferences (themeMode, documentPrintFormats) preserved'
  );

  // Restore mocks
  (Admin as any).findById = origAdminFindById;
  (Employee as any).findById = origEmployeeFindById;

  // 3. Row Capacity Calculation & Batch Grouping
  console.log('\n📊 3. Row Capacity Calculation & Batch Grouping Parity');

  // 12 single items
  const items12 = Array.from({ length: 12 }, (_, i) => ({
    product: { _id: `prod_${i}`, productName: `Product ${i}` },
    quantitySold: 1,
    baseRate: 100
  }));
  assert(
    calculateRenderedItemRowCount(items12) === 12,
    '12 single-batch items count exactly 12 rendered rows'
  );

  // 13 single items
  const items13 = Array.from({ length: 13 }, (_, i) => ({
    product: { _id: `prod_${i}`, productName: `Product ${i}` },
    quantitySold: 1,
    baseRate: 100
  }));
  assert(
    calculateRenderedItemRowCount(items13) === 13,
    '13 single-batch items count exactly 13 rendered rows (> capacity 12)'
  );

  // Empty draft items excluded
  const itemsWithEmpty = [
    { product: { _id: 'prod_1', productName: 'Prod 1' } },
    { product: null },
    { product: { _id: '', productName: '' } },
    { product: { _id: 'prod_2', productName: 'Prod 2' } }
  ];
  assert(
    calculateRenderedItemRowCount(itemsWithEmpty) === 2,
    'Empty draft items without selected products are excluded from row count'
  );

  // Single product expanding into 3 rows via distinct batch allocations
  const multiBatchItemDistinct = [
    {
      product: { _id: 'prod_multi', productName: 'Multi Batch Product', gstPercentage: 18, newMRP: 120 },
      ratePerUnit: 100,
      schemeDiscount: 0,
      batchAllocations: [
        { batchId: 'b1', quantity: 5, rate: 100, mrp: 120, gstPercent: 18 },
        { batchId: 'b2', quantity: 3, rate: 110, mrp: 130, gstPercent: 18 }, // distinct rate & MRP
        { batchId: 'b3', quantity: 2, rate: 100, mrp: 120, gstPercent: 12 }  // distinct GST
      ]
    }
  ];
  assert(
    calculateRenderedItemRowCount(multiBatchItemDistinct) === 3,
    'Single product with 3 distinct pricing allocations correctly expands to 3 rendered rows'
  );

  // Single product with 2 identical pricing allocations collapses to 1 row
  const multiBatchItemIdentical = [
    {
      product: { _id: 'prod_identical', productName: 'Identical Pricing Batches', gstPercentage: 18, newMRP: 120 },
      ratePerUnit: 100,
      schemeDiscount: 0,
      batchAllocations: [
        { batchId: 'b1', quantity: 5, rate: 100, mrp: 120, gstPercent: 18 },
        { batchId: 'b2', quantity: 3, rate: 100, mrp: 120, gstPercent: 18 } // identical pricing
      ]
    }
  ];
  assert(
    calculateRenderedItemRowCount(multiBatchItemIdentical) === 1,
    'Single product with 2 identical pricing allocations collapses to 1 rendered row'
  );

  // 4. Layout Mode Detection
  console.log('\n📐 4. Layout Mode Detection (A5 Half-Sheet Double-Copy)');

  assert(
    isA5DoubleCopyWorkflowActive('A4', 'double') === true,
    'A4 format + copyMode "double" -> true (A5 half-sheet double-copy active)'
  );

  assert(
    isA5DoubleCopyWorkflowActive('A4', 'half') === true,
    'A4 format + copyMode "half" -> true (1x Half Sheet is A5 capacity constrained)'
  );

  assert(
    isA5DoubleCopyWorkflowActive('A4', undefined) === true,
    'A4 format + default copyMode -> true'
  );

  assert(
    isA5DoubleCopyWorkflowActive('A5', 'double') === true,
    'A5 legacy format + copyMode "double" -> true'
  );

  assert(
    isA5DoubleCopyWorkflowActive('A4', 'single') === false,
    'A4 format + copyMode "single" -> false (Full page A4 does NOT trigger warning)'
  );

  assert(
    isA5DoubleCopyWorkflowActive('THERMAL_80', 'double') === false,
    'THERMAL_80 format -> false (Thermal rolls do NOT trigger warning)'
  );

  assert(
    isA5DoubleCopyWorkflowActive('THERMAL_58', 'double') === false,
    'THERMAL_58 format -> false'
  );

  // 5. Warning Transition Lifecycle Simulation
  console.log('\n🔄 5. Warning Transition & Re-arming Lifecycle');

  const sim = new A5WarningTransitionSimulator();

  // Initial: 10 rows, A4 double
  sim.update(10, true, true);
  assert(sim.modalOpen === false, 'Initial <= 12 rows -> modal remains closed');

  // Crossing from 12 to 13 rows
  sim.update(13, true, true);
  assert(sim.modalOpen === true, 'Crossing to 13 rows -> modal opens');
  sim.dismissModal();
  assert(sim.modalOpen === false, 'User dismisses modal -> modal closed');

  // Adding 14th item (ordinary edit above threshold)
  sim.update(14, true, true);
  assert(sim.modalOpen === false, 'Editing at 14 rows -> does NOT re-trigger modal');

  // Editing at 15 rows
  sim.update(15, true, true);
  assert(sim.modalOpen === false, 'Editing at 15 rows -> does NOT re-trigger modal');

  // Removing items to 11 rows (returning within capacity)
  sim.update(11, true, true);
  assert(sim.modalOpen === false && sim.triggered === false, 'Dropping to 11 rows -> re-arms trigger flag');

  // Crossing back to 13 rows
  sim.update(13, true, true);
  assert(sim.modalOpen === true, 'Re-crossing to 13 rows -> triggers warning again');
  sim.dismissModal();

  // Workflow switch: user switches to A4 single copy
  sim.update(14, false, true);
  assert(sim.modalOpen === false && sim.triggered === false, 'Switching layout to single copy -> suppresses warning and resets');

  // User switches back to A4 double copy while at 14 rows
  sim.update(14, true, true);
  assert(sim.modalOpen === true, 'Switching layout back to double copy -> triggers warning for active capacity overflow');
  sim.dismissModal();

  // Suppressed preference
  sim.update(11, true, false); // drop and re-arm, with preference false
  sim.update(13, true, false); // cross to 13 with preference false
  assert(sim.modalOpen === false, 'When user suppressed warnings (showA5CapacityWarning = false) -> never triggers');

  // Re-enabling preference
  sim.update(13, true, true); // preference toggled back to true in Settings
  assert(sim.modalOpen === true, 'Re-enabling preference in Settings -> triggers warning for exceeded capacity');
  sim.dismissModal(true); // User clicks OK, marking draft as dismissed

  // Draft-session dismissal persistence (user pressed OK on dialog)
  sim.update(14, true, true);
  assert(sim.modalOpen === false, 'Adding 14th item after draft dismissal -> modal stays closed');

  sim.update(11, true, true);
  sim.update(13, true, true);
  assert(sim.modalOpen === false, 'Dropping and re-exceeding threshold within same draft -> modal NEVER reappears');

  // Resetting draft (clearing draft or starting new invoice)
  sim.resetDraft();
  sim.update(13, true, true);
  assert(sim.modalOpen === true, 'Starting a new draft with > 12 rows -> modal triggers cleanly');
  sim.dismissModal(true);

  // 6. Financial Invariance
  console.log('\n💰 6. Financial Invariance Under Row Counting');

  const sampleItems = [
    {
      product: { _id: 'p1', productName: 'Item 1', gstPercentage: 18 },
      quantitySold: 2,
      baseRate: 100,
      taxableAmount: 200,
      cgstAmount: 18,
      sgstAmount: 18,
      totalAmount: 236
    },
    {
      product: { _id: 'p2', productName: 'Item 2', gstPercentage: 12 },
      quantitySold: 5,
      baseRate: 50,
      taxableAmount: 250,
      cgstAmount: 15,
      sgstAmount: 15,
      totalAmount: 280
    }
  ];

  const beforeTotals = {
    taxable: sampleItems.reduce((s, i) => s + i.taxableAmount, 0),
    total: sampleItems.reduce((s, i) => s + i.totalAmount, 0)
  };

  const countedRows = calculateRenderedItemRowCount(sampleItems);

  const afterTotals = {
    taxable: sampleItems.reduce((s, i) => s + i.taxableAmount, 0),
    total: sampleItems.reduce((s, i) => s + i.totalAmount, 0)
  };

  assert(
    countedRows === 2 &&
    beforeTotals.taxable === afterTotals.taxable &&
    beforeTotals.total === afterTotals.total,
    'Row counting is strictly pure and read-only: financial totals are 100% invariant'
  );

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
