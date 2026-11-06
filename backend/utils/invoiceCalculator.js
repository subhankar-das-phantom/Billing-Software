/**
 * Calculate invoice item amounts
 * @param {number} quantity - Quantity sold
 * @param {number} rate - Rate per unit
 * @param {number} gstPercentage - GST percentage (5, 12, 18, 28)
 * @param {number} discountPercentage - Discount percentage
 * @returns {object} Calculated amounts
 */
const round = (num) => {
  return Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;
};

/**
 * Calculate invoice item amounts with exact paisa splitting.
 * Invariant: cgstAmount + sgstAmount === gstAmount to the exact paisa.
 * @param {number} quantity - Quantity sold
 * @param {number} rate - Rate per unit
 * @param {number} gstPercentage - GST percentage (5, 12, 18, 28)
 * @param {number} discountPercentage - Discount percentage
 * @returns {object} Calculated amounts
 */
const calculateItemAmounts = (quantity, rate, gstPercentage, discountPercentage = 0) => {
  const baseAmount = quantity * rate;
  const discountAmount = (baseAmount * discountPercentage) / 100;
  const taxableAmount = baseAmount - discountAmount;
  const roundedTaxable = round(taxableAmount);
  const gstAmount = round((roundedTaxable * gstPercentage) / 100);
  const cgstAmount = round(gstAmount / 2);
  const sgstAmount = round(gstAmount - cgstAmount); // Exact paisa split parity
  const totalAmount = round(roundedTaxable + gstAmount);

  return {
    baseAmount: round(baseAmount),
    discountAmount: round(discountAmount),
    taxableAmount: roundedTaxable,
    gstAmount,
    cgstAmount,
    sgstAmount,
    totalAmount
  };
};

/**
 * Calculate invoice totals from items
 * Guarantees:
 * 1. totalCGST + totalSGST === totalGST (exact paisa parity)
 * 2. finalTotal === Math.round(netTotal)
 * 3. round(netTotal + roundOff) === finalTotal
 * @param {array} items - Array of invoice items with calculated amounts
 * @returns {object} Invoice totals
 */
const calculateInvoiceTotals = (items) => {
  const totals = items.reduce((acc, item) => {
    acc.baseAmount += item.baseAmount || 0;
    acc.totalDiscount += item.discountAmount || 0;
    acc.totalTaxable += item.taxableAmount || 0;
    acc.totalGST += item.gstAmount || 0;
    acc.totalCGST += item.cgstAmount || 0;
    acc.totalSGST += item.sgstAmount || 0;
    acc.netTotal += item.totalAmount || 0;
    return acc;
  }, {
    baseAmount: 0,
    totalDiscount: 0,
    totalTaxable: 0,
    totalGST: 0,
    totalCGST: 0,
    totalSGST: 0,
    netTotal: 0
  });

  totals.baseAmount = round(totals.baseAmount);
  totals.totalDiscount = round(totals.totalDiscount);
  totals.totalTaxable = round(totals.totalTaxable);
  totals.totalGST = round(totals.totalGST);
  totals.totalCGST = round(totals.totalCGST);
  // Guarantee exact paisa split parity on totals
  totals.totalSGST = round(totals.totalGST - totals.totalCGST);
  totals.netTotal = round(totals.totalTaxable + totals.totalGST);
  totals.finalTotal = Math.round(totals.netTotal);
  totals.roundOff = round(totals.finalTotal - totals.netTotal);

  return totals;
};

module.exports = {
  calculateItemAmounts,
  calculateInvoiceTotals,
  round
};
