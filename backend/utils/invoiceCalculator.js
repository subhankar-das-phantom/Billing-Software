/**
 * Calculate invoice item amounts
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
  const gstAmount = (taxableAmount * gstPercentage) / 100;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;
  const totalAmount = taxableAmount + gstAmount;

  return {
    baseAmount: round(baseAmount),
    discountAmount: round(discountAmount),
    taxableAmount: round(taxableAmount),
    gstAmount: round(gstAmount),
    cgstAmount: round(cgstAmount),
    sgstAmount: round(sgstAmount),
    totalAmount: round(totalAmount)
  };
};

/**
 * Calculate invoice totals from items
 * @param {array} items - Array of invoice items with calculated amounts
 * @returns {object} Invoice totals
 */
const calculateInvoiceTotals = (items) => {
  const totals = items.reduce((acc, item) => {
    acc.baseAmount += item.baseAmount;
    acc.totalDiscount += item.discountAmount;
    acc.totalTaxable += item.taxableAmount;
    acc.totalGST += item.gstAmount;
    acc.totalCGST += item.cgstAmount;
    acc.totalSGST += item.sgstAmount;
    acc.netTotal += item.totalAmount;
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

  // Round all totals
  Object.keys(totals).forEach(key => {
    totals[key] = round(totals[key]);
  });

  return totals;
};

/**
 * Round to 2 decimal places
 * @param {number} num - Number to round
 * @returns {number} Rounded number
 */
const round = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

module.exports = {
  calculateItemAmounts,
  calculateInvoiceTotals,
  round
};
