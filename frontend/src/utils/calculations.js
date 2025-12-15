/**
 * Financial Calculations Utility
 * Handles all financial, tax, and invoice calculations
 */

// ============================================
// CONSTANTS
// ============================================

/**
 * GST Rates (in percentage)
 */
export const GST_RATES = [0, 5, 12, 18, 28];

/**
 * Payment Methods
 */
export const PAYMENT_METHODS = [
  'cash',
  'card',
  'upi',
  'netbanking',
  'cheque',
  'credit'
];

/**
 * Currency Symbols
 */
export const CURRENCY = {
  symbol: '₹',
  code: 'INR',
  name: 'Indian Rupee'
};

/**
 * Rounding Methods
 */
export const ROUNDING_METHODS = {
  ROUND: 'round',        // Normal rounding
  CEIL: 'ceil',          // Always round up
  FLOOR: 'floor',        // Always round down
  NEAREST_05: 'nearest05', // Round to nearest 0.05
  NEAREST_50: 'nearest50', // Round to nearest 0.50
  NEAREST_1: 'nearest1'    // Round to nearest whole number
};

// ============================================
// BASIC MATH FUNCTIONS
// ============================================

/**
 * Round to specified decimal places
 * @param {number} num - Number to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} - Rounded number
 */
export const round = (num, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
};

/**
 * Round up to specified decimal places
 * @param {number} num - Number to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} - Rounded up number
 */
export const roundUp = (num, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.ceil(num * factor) / factor;
};

/**
 * Round down to specified decimal places
 * @param {number} num - Number to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} - Rounded down number
 */
export const roundDown = (num, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.floor(num * factor) / factor;
};

/**
 * Round to nearest specified value
 * @param {number} num - Number to round
 * @param {number} nearest - Nearest value (e.g., 0.05, 0.5, 1)
 * @returns {number} - Rounded number
 */
export const roundToNearest = (num, nearest = 1) => {
  return Math.round(num / nearest) * nearest;
};

/**
 * Apply rounding method
 * @param {number} num - Number to round
 * @param {string} method - Rounding method
 * @returns {number} - Rounded number
 */
export const applyRounding = (num, method = ROUNDING_METHODS.ROUND) => {
  switch (method) {
    case ROUNDING_METHODS.CEIL:
      return roundUp(num);
    case ROUNDING_METHODS.FLOOR:
      return roundDown(num);
    case ROUNDING_METHODS.NEAREST_05:
      return roundToNearest(num, 0.05);
    case ROUNDING_METHODS.NEAREST_50:
      return roundToNearest(num, 0.50);
    case ROUNDING_METHODS.NEAREST_1:
      return roundToNearest(num, 1);
    default:
      return round(num);
  }
};

/**
 * Clamp number between min and max
 * @param {number} num - Number to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped number
 */
export const clamp = (num, min, max) => {
  return Math.min(Math.max(num, min), max);
};

// ============================================
// PERCENTAGE CALCULATIONS
// ============================================

/**
 * Calculate percentage of a number
 * @param {number} value - Base value
 * @param {number} percentage - Percentage
 * @returns {number} - Calculated value
 */
export const calculatePercentage = (value, percentage) => {
  return round((value * percentage) / 100);
};

/**
 * Calculate percentage increase
 * @param {number} oldValue - Old value
 * @param {number} newValue - New value
 * @returns {number} - Percentage increase
 */
export const calculatePercentageIncrease = (oldValue, newValue) => {
  if (oldValue === 0) return 0;
  return round(((newValue - oldValue) / oldValue) * 100);
};

/**
 * Calculate percentage decrease
 * @param {number} oldValue - Old value
 * @param {number} newValue - New value
 * @returns {number} - Percentage decrease
 */
export const calculatePercentageDecrease = (oldValue, newValue) => {
  if (oldValue === 0) return 0;
  return round(((oldValue - newValue) / oldValue) * 100);
};

/**
 * Calculate what percentage one number is of another
 * @param {number} part - Part value
 * @param {number} whole - Whole value
 * @returns {number} - Percentage
 */
export const calculatePercentageOf = (part, whole) => {
  if (whole === 0) return 0;
  return round((part / whole) * 100);
};

/**
 * Add percentage to value
 * @param {number} value - Base value
 * @param {number} percentage - Percentage to add
 * @returns {number} - Result
 */
export const addPercentage = (value, percentage) => {
  return round(value + calculatePercentage(value, percentage));
};

/**
 * Subtract percentage from value
 * @param {number} value - Base value
 * @param {number} percentage - Percentage to subtract
 * @returns {number} - Result
 */
export const subtractPercentage = (value, percentage) => {
  return round(value - calculatePercentage(value, percentage));
};

// ============================================
// GST CALCULATIONS
// ============================================

/**
 * Calculate GST amount from taxable amount
 * @param {number} taxableAmount - Taxable amount
 * @param {number} gstPercentage - GST percentage
 * @returns {object} - GST breakdown
 */
export const calculateGST = (taxableAmount, gstPercentage) => {
  const gstAmount = (taxableAmount * gstPercentage) / 100;
  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;
  
  return {
    gstAmount: round(gstAmount),
    cgst: round(cgst),
    sgst: round(sgst),
    igst: round(gstAmount), // For inter-state transactions
    percentage: gstPercentage
  };
};

/**
 * Calculate GST from total amount (GST included)
 * @param {number} totalAmount - Total amount including GST
 * @param {number} gstPercentage - GST percentage
 * @returns {object} - GST breakdown
 */
export const calculateGSTFromTotal = (totalAmount, gstPercentage) => {
  const taxableAmount = totalAmount / (1 + gstPercentage / 100);
  const gstAmount = totalAmount - taxableAmount;
  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;
  
  return {
    taxableAmount: round(taxableAmount),
    gstAmount: round(gstAmount),
    cgst: round(cgst),
    sgst: round(sgst),
    igst: round(gstAmount),
    percentage: gstPercentage
  };
};

/**
 * Add GST to amount
 * @param {number} amount - Base amount
 * @param {number} gstPercentage - GST percentage
 * @returns {number} - Amount with GST added
 */
export const addGST = (amount, gstPercentage) => {
  return round(amount * (1 + gstPercentage / 100));
};

/**
 * Remove GST from amount
 * @param {number} amount - Amount with GST
 * @param {number} gstPercentage - GST percentage
 * @returns {number} - Amount without GST
 */
export const removeGST = (amount, gstPercentage) => {
  return round(amount / (1 + gstPercentage / 100));
};

/**
 * Calculate GST breakdown by rates
 * @param {array} items - Array of items with gstPercentage and taxableAmount
 * @returns {object} - GST breakdown by rate
 */
export const calculateGSTBreakdown = (items) => {
  const breakdown = {};
  
  items.forEach(item => {
    const rate = item.gstPercentage || 0;
    const taxable = item.taxableAmount || 0;
    
    if (!breakdown[rate]) {
      breakdown[rate] = {
        rate,
        taxableAmount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalGST: 0
      };
    }
    
    const gst = calculateGST(taxable, rate);
    breakdown[rate].taxableAmount += taxable;
    breakdown[rate].cgst += gst.cgst;
    breakdown[rate].sgst += gst.sgst;
    breakdown[rate].igst += gst.igst;
    breakdown[rate].totalGST += gst.gstAmount;
  });
  
  // Round all values
  Object.keys(breakdown).forEach(rate => {
    breakdown[rate].taxableAmount = round(breakdown[rate].taxableAmount);
    breakdown[rate].cgst = round(breakdown[rate].cgst);
    breakdown[rate].sgst = round(breakdown[rate].sgst);
    breakdown[rate].igst = round(breakdown[rate].igst);
    breakdown[rate].totalGST = round(breakdown[rate].totalGST);
  });
  
  return breakdown;
};

/**
 * Validate GST rate
 * @param {number} rate - GST rate to validate
 * @returns {boolean} - Is valid GST rate
 */
export const isValidGSTRate = (rate) => {
  return GST_RATES.includes(Number(rate));
};

// ============================================
// DISCOUNT CALCULATIONS
// ============================================

/**
 * Calculate discount amount
 * @param {number} amount - Original amount
 * @param {number} discountPercentage - Discount percentage
 * @returns {number} - Discount amount
 */
export const calculateDiscount = (amount, discountPercentage) => {
  return round((amount * discountPercentage) / 100);
};

/**
 * Apply discount to amount
 * @param {number} amount - Original amount
 * @param {number} discountPercentage - Discount percentage
 * @returns {object} - Discount breakdown
 */
export const applyDiscount = (amount, discountPercentage) => {
  const discountAmount = calculateDiscount(amount, discountPercentage);
  const finalAmount = amount - discountAmount;
  
  return {
    originalAmount: round(amount),
    discountPercentage,
    discountAmount: round(discountAmount),
    finalAmount: round(finalAmount)
  };
};

/**
 * Calculate multiple discounts (cascade)
 * @param {number} amount - Original amount
 * @param {array} discounts - Array of discount percentages
 * @returns {object} - Discount breakdown
 */
export const applyCascadeDiscounts = (amount, discounts) => {
  let currentAmount = amount;
  let totalDiscount = 0;
  const steps = [];
  
  discounts.forEach((discount, index) => {
    const discountAmount = calculateDiscount(currentAmount, discount);
    totalDiscount += discountAmount;
    currentAmount -= discountAmount;
    
    steps.push({
      step: index + 1,
      discountPercentage: discount,
      discountAmount: round(discountAmount),
      amountAfterDiscount: round(currentAmount)
    });
  });
  
  return {
    originalAmount: round(amount),
    totalDiscountAmount: round(totalDiscount),
    finalAmount: round(currentAmount),
    effectiveDiscountPercentage: round(((amount - currentAmount) / amount) * 100),
    steps
  };
};

/**
 * Calculate flat discount (fixed amount)
 * @param {number} amount - Original amount
 * @param {number} flatDiscount - Flat discount amount
 * @returns {object} - Discount breakdown
 */
export const applyFlatDiscount = (amount, flatDiscount) => {
  const finalAmount = Math.max(0, amount - flatDiscount);
  const effectivePercentage = amount > 0 ? (flatDiscount / amount) * 100 : 0;
  
  return {
    originalAmount: round(amount),
    discountAmount: round(flatDiscount),
    finalAmount: round(finalAmount),
    effectivePercentage: round(effectivePercentage)
  };
};

// ============================================
// INVOICE ITEM CALCULATIONS
// ============================================

/**
 * Calculate invoice item amounts
 * @param {number} quantity - Quantity
 * @param {number} rate - Rate per unit
 * @param {number} gstPercentage - GST percentage
 * @param {number} discountPercentage - Discount percentage (default: 0)
 * @returns {object} - Item calculation breakdown
 */
export const calculateItemAmounts = (quantity, rate, gstPercentage, discountPercentage = 0) => {
  const baseAmount = quantity * rate;
  const discountAmount = (baseAmount * discountPercentage) / 100;
  const taxableAmount = baseAmount - discountAmount;
  const gstAmount = (taxableAmount * gstPercentage) / 100;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;
  const totalAmount = taxableAmount + gstAmount;

  return {
    quantity: round(quantity, 3),
    rate: round(rate),
    baseAmount: round(baseAmount),
    discountPercentage: round(discountPercentage),
    discountAmount: round(discountAmount),
    taxableAmount: round(taxableAmount),
    gstPercentage: round(gstPercentage),
    gstAmount: round(gstAmount),
    cgstAmount: round(cgstAmount),
    sgstAmount: round(sgstAmount),
    igstAmount: round(gstAmount),
    totalAmount: round(totalAmount)
  };
};

/**
 * Calculate item with flat discount
 * @param {number} quantity - Quantity
 * @param {number} rate - Rate per unit
 * @param {number} gstPercentage - GST percentage
 * @param {number} flatDiscount - Flat discount amount
 * @returns {object} - Item calculation breakdown
 */
export const calculateItemWithFlatDiscount = (quantity, rate, gstPercentage, flatDiscount = 0) => {
  const baseAmount = quantity * rate;
  const discountAmount = Math.min(flatDiscount, baseAmount);
  const discountPercentage = baseAmount > 0 ? (discountAmount / baseAmount) * 100 : 0;
  const taxableAmount = baseAmount - discountAmount;
  const gstAmount = (taxableAmount * gstPercentage) / 100;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;
  const totalAmount = taxableAmount + gstAmount;

  return {
    quantity: round(quantity, 3),
    rate: round(rate),
    baseAmount: round(baseAmount),
    discountAmount: round(discountAmount),
    discountPercentage: round(discountPercentage),
    taxableAmount: round(taxableAmount),
    gstPercentage: round(gstPercentage),
    gstAmount: round(gstAmount),
    cgstAmount: round(cgstAmount),
    sgstAmount: round(sgstAmount),
    igstAmount: round(gstAmount),
    totalAmount: round(totalAmount)
  };
};

// ============================================
// INVOICE TOTALS CALCULATIONS
// ============================================

/**
 * Calculate invoice totals from items
 * @param {array} items - Array of invoice items
 * @returns {object} - Invoice totals
 */
export const calculateInvoiceTotals = (items) => {
  return items.reduce((acc, item) => {
    acc.baseAmount += item.baseAmount || 0;
    acc.totalDiscount += item.discountAmount || 0;
    acc.totalTaxable += item.taxableAmount || 0;
    acc.totalGST += item.gstAmount || 0;
    acc.totalCGST += item.cgstAmount || 0;
    acc.totalSGST += item.sgstAmount || 0;
    acc.totalIGST += item.igstAmount || 0;
    acc.netTotal += item.totalAmount || 0;
    return acc;
  }, {
    baseAmount: 0,
    totalDiscount: 0,
    totalTaxable: 0,
    totalGST: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    netTotal: 0
  });
};

/**
 * Calculate invoice totals with additional charges
 * @param {array} items - Array of invoice items
 * @param {object} charges - Additional charges (shipping, handling, etc.)
 * @param {number} invoiceDiscount - Invoice level discount percentage
 * @returns {object} - Complete invoice totals
 */
export const calculateCompleteInvoiceTotals = (items, charges = {}, invoiceDiscount = 0) => {
  const itemTotals = calculateInvoiceTotals(items);
  
  // Apply invoice-level discount
  const invoiceDiscountAmount = calculateDiscount(itemTotals.totalTaxable, invoiceDiscount);
  const netTaxable = itemTotals.totalTaxable - invoiceDiscountAmount;
  
  // Additional charges
  const shippingCharges = charges.shipping || 0;
  const handlingCharges = charges.handling || 0;
  const otherCharges = charges.other || 0;
  const totalCharges = shippingCharges + handlingCharges + otherCharges;
  
  // Calculate GST on charges if applicable
  const chargesGST = charges.gstOnCharges ? calculateGST(totalCharges, charges.gstPercentage || 0) : { gstAmount: 0 };
  
  // Grand total
  const grandTotal = itemTotals.netTotal + totalCharges + chargesGST.gstAmount - invoiceDiscountAmount;
  
  // Round off
  const roundOff = round(grandTotal) - grandTotal;
  const finalTotal = round(grandTotal);
  
  return {
    ...itemTotals,
    baseAmount: round(itemTotals.baseAmount),
    totalDiscount: round(itemTotals.totalDiscount),
    invoiceDiscountPercentage: round(invoiceDiscount),
    invoiceDiscountAmount: round(invoiceDiscountAmount),
    totalTaxable: round(netTaxable),
    totalGST: round(itemTotals.totalGST),
    totalCGST: round(itemTotals.totalCGST),
    totalSGST: round(itemTotals.totalSGST),
    totalIGST: round(itemTotals.totalIGST),
    shippingCharges: round(shippingCharges),
    handlingCharges: round(handlingCharges),
    otherCharges: round(otherCharges),
    totalCharges: round(totalCharges),
    chargesGST: round(chargesGST.gstAmount),
    netTotal: round(itemTotals.netTotal),
    roundOff: round(roundOff, 2),
    grandTotal: finalTotal
  };
};

// ============================================
// PROFIT CALCULATIONS
// ============================================

/**
 * Calculate profit
 * @param {number} sellingPrice - Selling price
 * @param {number} costPrice - Cost price
 * @returns {object} - Profit breakdown
 */
export const calculateProfit = (sellingPrice, costPrice) => {
  const profit = sellingPrice - costPrice;
  const profitPercentage = costPrice > 0 ? (profit / costPrice) * 100 : 0;
  const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
  
  return {
    sellingPrice: round(sellingPrice),
    costPrice: round(costPrice),
    profit: round(profit),
    profitPercentage: round(profitPercentage),
    profitMargin: round(profitMargin)
  };
};

/**
 * Calculate selling price from cost and margin
 * @param {number} costPrice - Cost price
 * @param {number} profitMargin - Desired profit margin percentage
 * @returns {number} - Selling price
 */
export const calculateSellingPrice = (costPrice, profitMargin) => {
  return round(costPrice / (1 - profitMargin / 100));
};

/**
 * Calculate cost price from selling price and margin
 * @param {number} sellingPrice - Selling price
 * @param {number} profitMargin - Profit margin percentage
 * @returns {number} - Cost price
 */
export const calculateCostPrice = (sellingPrice, profitMargin) => {
  return round(sellingPrice * (1 - profitMargin / 100));
};

/**
 * Calculate markup
 * @param {number} costPrice - Cost price
 * @param {number} markupPercentage - Markup percentage
 * @returns {object} - Markup breakdown
 */
export const calculateMarkup = (costPrice, markupPercentage) => {
  const markupAmount = (costPrice * markupPercentage) / 100;
  const sellingPrice = costPrice + markupAmount;
  
  return {
    costPrice: round(costPrice),
    markupPercentage: round(markupPercentage),
    markupAmount: round(markupAmount),
    sellingPrice: round(sellingPrice)
  };
};

// ============================================
// PAYMENT CALCULATIONS
// ============================================

/**
 * Calculate change amount
 * @param {number} totalAmount - Total amount due
 * @param {number} amountPaid - Amount paid by customer
 * @returns {object} - Payment breakdown
 */
export const calculateChange = (totalAmount, amountPaid) => {
  const change = amountPaid - totalAmount;
  
  return {
    totalAmount: round(totalAmount),
    amountPaid: round(amountPaid),
    change: round(change),
    isExact: change === 0,
    isOverpaid: change > 0,
    isUnderpaid: change < 0
  };
};

/**
 * Split payment across multiple methods
 * @param {number} totalAmount - Total amount
 * @param {array} payments - Array of {method, amount}
 * @returns {object} - Payment split breakdown
 */
export const splitPayment = (totalAmount, payments) => {
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = totalAmount - totalPaid;
  
  return {
    totalAmount: round(totalAmount),
    payments: payments.map(p => ({
      method: p.method,
      amount: round(p.amount),
      percentage: round((p.amount / totalAmount) * 100)
    })),
    totalPaid: round(totalPaid),
    remaining: round(remaining),
    isPaid: remaining <= 0
  };
};

/**
 * Calculate installment amount
 * @param {number} totalAmount - Total amount
 * @param {number} installments - Number of installments
 * @param {number} interestRate - Interest rate percentage (optional)
 * @returns {object} - Installment breakdown
 */
export const calculateInstallments = (totalAmount, installments, interestRate = 0) => {
  let installmentAmount;
  let totalWithInterest = totalAmount;
  
  if (interestRate > 0) {
    // Simple interest calculation
    const interest = (totalAmount * interestRate * installments) / (12 * 100);
    totalWithInterest = totalAmount + interest;
    installmentAmount = totalWithInterest / installments;
  } else {
    installmentAmount = totalAmount / installments;
  }
  
  return {
    principal: round(totalAmount),
    installments,
    interestRate: round(interestRate),
    totalInterest: round(totalWithInterest - totalAmount),
    totalWithInterest: round(totalWithInterest),
    installmentAmount: round(installmentAmount)
  };
};

// ============================================
// STATISTICAL CALCULATIONS
// ============================================

/**
 * Calculate average
 * @param {array} numbers - Array of numbers
 * @returns {number} - Average
 */
export const calculateAverage = (numbers) => {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return round(sum / numbers.length);
};

/**
 * Calculate median
 * @param {array} numbers - Array of numbers
 * @returns {number} - Median
 */
export const calculateMedian = (numbers) => {
  if (numbers.length === 0) return 0;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return round(sorted[middle]);
};

/**
 * Calculate sum
 * @param {array} numbers - Array of numbers
 * @returns {number} - Sum
 */
export const calculateSum = (numbers) => {
  return round(numbers.reduce((acc, num) => acc + num, 0));
};

/**
 * Calculate weighted average
 * @param {array} values - Array of {value, weight} objects
 * @returns {number} - Weighted average
 */
export const calculateWeightedAverage = (values) => {
  if (values.length === 0) return 0;
  
  const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight === 0) return 0;
  
  const weightedSum = values.reduce((sum, v) => sum + (v.value * v.weight), 0);
  return round(weightedSum / totalWeight);
};

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {boolean} showSymbol - Show currency symbol (default: true)
 * @returns {string} - Formatted currency
 */
export const formatCurrency = (amount, showSymbol = true) => {
  const formatted = round(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return showSymbol ? `${CURRENCY.symbol}${formatted}` : formatted;
};

/**
 * Format number with commas (Indian style)
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
export const formatNumber = (num) => {
  return num.toLocaleString('en-IN');
};

/**
 * Parse currency string to number
 * @param {string} currencyString - Currency string
 * @returns {number} - Parsed number
 */
export const parseCurrency = (currencyString) => {
  const cleaned = currencyString.replace(/[₹,\s]/g, '');
  return parseFloat(cleaned) || 0;
};

// ============================================
// NUMBER CONVERSION
// ============================================

/**
 * Convert number to words (Indian system)
 * @param {number} num - Number to convert
 * @returns {string} - Number in words
 */
export const numberToWords = (num) => {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convertLessThanThousand = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertLessThanThousand(n % 100) : '');
  };
  
  let result = '';
  let crore = Math.floor(num / 10000000);
  let lakh = Math.floor((num % 10000000) / 100000);
  let thousand = Math.floor((num % 100000) / 1000);
  let remainder = num % 1000;
  
  if (crore > 0) result += convertLessThanThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertLessThanThousand(remainder);
  
  return result.trim();
};

/**
 * Convert amount to words with currency
 * @param {number} amount - Amount to convert
 * @returns {string} - Amount in words with currency
 */
export const amountToWords = (amount) => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  
  let result = numberToWords(rupees) + ' Rupees';
  
  if (paise > 0) {
    result += ' and ' + numberToWords(paise) + ' Paise';
  }
  
  return result + ' Only';
};

// ============================================
// VALIDATORS
// ============================================

/**
 * Validate if number is positive
 * @param {number} num - Number to validate
 * @returns {boolean}
 */
export const isPositive = (num) => num > 0;

/**
 * Validate if number is non-negative
 * @param {number} num - Number to validate
 * @returns {boolean}
 */
export const isNonNegative = (num) => num >= 0;

/**
 * Validate if number is within range
 * @param {number} num - Number to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean}
 */
export const isInRange = (num, min, max) => num >= min && num <= max;

/**
 * Validate if value is a valid number
 * @param {any} value - Value to validate
 * @returns {boolean}
 */
export const isValidNumber = (value) => {
  return !isNaN(parseFloat(value)) && isFinite(value);
};

// ============================================
// EXPORT ALL
// ============================================

export default {
  // Constants
  GST_RATES,
  PAYMENT_METHODS,
  CURRENCY,
  ROUNDING_METHODS,
  
  // Basic Math
  round,
  roundUp,
  roundDown,
  roundToNearest,
  applyRounding,
  clamp,
  
  // Percentage
  calculatePercentage,
  calculatePercentageIncrease,
  calculatePercentageDecrease,
  calculatePercentageOf,
  addPercentage,
  subtractPercentage,
  
  // GST
  calculateGST,
  calculateGSTFromTotal,
  addGST,
  removeGST,
  calculateGSTBreakdown,
  isValidGSTRate,
  
  // Discount
  calculateDiscount,
  applyDiscount,
  applyCascadeDiscounts,
  applyFlatDiscount,
  
  // Invoice Items
  calculateItemAmounts,
  calculateItemWithFlatDiscount,
  
  // Invoice Totals
  calculateInvoiceTotals,
  calculateCompleteInvoiceTotals,
  
  // Profit
  calculateProfit,
  calculateSellingPrice,
  calculateCostPrice,
  calculateMarkup,
  
  // Payment
  calculateChange,
  splitPayment,
  calculateInstallments,
  
  // Statistics
  calculateAverage,
  calculateMedian,
  calculateSum,
  calculateWeightedAverage,
  
  // Currency
  formatCurrency,
  formatNumber,
  parseCurrency,
  
  // Conversion
  numberToWords,
  amountToWords,
  
  // Validators
  isPositive,
  isNonNegative,
  isInRange,
  isValidNumber
};
