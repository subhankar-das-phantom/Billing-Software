/**
 * Authoritative A5 Invoice Capacity & Row Calculation Utilities
 * Bharat Enterprise Billing System
 */

/**
 * Standard maximum rendered item rows designed to fit on the A5 double-copy half-sheet layout
 * before content overflows physical printable margins.
 */
export const A5_ROW_CAPACITY_THRESHOLD = 12;

/**
 * Detects whether the current active invoice layout is the A5 half-sheet double-copy workflow.
 * 
 * Safeguard:
 * Strictly applies to sheet formats (A4 / legacy A5) when copyMode is 'double'.
 * Full-page A4 ('single' copy), 'half' sheet, and thermal rolls (THERMAL_80, THERMAL_58) return false.
 *
 * @param {string} format - Document print format ('A4', 'A5', 'THERMAL_80', 'THERMAL_58')
 * @param {string} copyMode - Active copy mode ('single', 'double', 'half')
 * @returns {boolean}
 */
export function isA5DoubleCopyWorkflowActive(format, copyMode) {
  const isSheetFormat = format === 'A4' || format === 'A5';
  return isSheetFormat && copyMode === 'double';
}

/**
 * Pure helper to compute batch pricing key matching invoice renderer and backend grouping semantics.
 * 
 * @param {Object} item - Invoice line item
 * @param {Object} allocation - Batch allocation
 * @returns {string}
 */
function getBatchGroupingKey(item, allocation) {
  const effectiveRate = item.ratePerUnit !== undefined && item.ratePerUnit !== null
    ? item.ratePerUnit
    : (item.baseRate !== undefined ? item.baseRate : (allocation.rate ?? 0));

  const mrp = allocation.mrp ?? allocation.batch?.mrp ?? item.product?.newMRP ?? 0;
  const gstPercent = allocation.gstPercent ?? allocation.gstPercentage ?? allocation.batch?.gstPercent ?? allocation.batch?.gstPercentage ?? item.product?.gstPercentage ?? 0;
  const discount = item.schemeDiscount || 0;

  return `${effectiveRate}|${mrp}|${gstPercent}|${discount}`;
}

/**
 * Calculates the exact number of item rows that will be rendered on the printed invoice.
 * 
 * Safeguards:
 * 1. Accurately accounts for single products expanding into multiple rendered rows
 *    when batch allocations differ in price, MRP, GST rate, or discount.
 * 2. Filters out empty draft lines without selected products.
 * 3. Excludes headers, totals, notes, and signatories.
 * 4. Yields 100% parity with both InvoiceDocument.jsx renderer and backend splitInvoiceItemByBatchAllocations.
 *
 * @param {Array} items - Array of invoice items from create state or invoice document
 * @returns {number} Exact rendered item row count
 */
export function calculateRenderedItemRowCount(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  let totalRows = 0;

  for (const item of items) {
    if (!item) continue;

    // Filter out unpopulated draft items (no product selected)
    const product = item.product;
    if (!product || (!product._id && !product.id && !product.name && !product.productName)) {
      continue;
    }

    // Check if the item contains un-split batch allocations with differing pricing attributes
    const allocations = Array.isArray(item.batchAllocations) && item.batchAllocations.length > 0
      ? item.batchAllocations
      : (Array.isArray(item.manualAllocations) && item.manualAllocations.length > 0 ? item.manualAllocations : null);

    if (allocations && allocations.length > 1) {
      // Group allocations by pricing key
      const uniqueKeys = new Set();
      for (const alloc of allocations) {
        if (!alloc) continue;
        uniqueKeys.add(getBatchGroupingKey(item, alloc));
      }
      totalRows += Math.max(1, uniqueKeys.size);
    } else {
      // Already an individual line item (or single batch allocation)
      totalRows += 1;
    }
  }

  return totalRows;
}
