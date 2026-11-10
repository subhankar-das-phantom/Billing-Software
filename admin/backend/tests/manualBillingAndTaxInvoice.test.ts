/**
 * Bharat Enterprise Billing System — Manual Billing & Tax Invoice Tests
 * Unit tests verifying financial year, statutory GST calculations, Place of Supply (POS),
 * Indian currency words, and tenure stacking arithmetic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getIndianFinancialYear,
  resolveRecipientPlaceOfSupply,
  numberToIndianWords,
  numberToIndianWordsPaise,
  calculateTaxBreakdown,
  DEFAULT_PLATFORM_ISSUER,
} from '../../../backend/saas/services/platformTaxInvoiceService';
import { addMonths } from '../services/manualSubscriptionService';

describe('Platform Tax Invoice Service: Financial Year & Statutory Rules', () => {
  it('should accurately compute Indian Financial Year (April 1st to March 31st)', () => {
    // April 2026 -> 2026-27
    assert.equal(getIndianFinancialYear(new Date('2026-04-01T00:00:00Z')), '2026-27');
    // November 2026 -> 2026-27
    assert.equal(getIndianFinancialYear(new Date('2026-11-10T12:00:00Z')), '2026-27');
    // December 2026 -> 2026-27
    assert.equal(getIndianFinancialYear(new Date('2026-12-31T23:59:59Z')), '2026-27');
    // January 2027 -> 2026-27
    assert.equal(getIndianFinancialYear(new Date('2027-01-01T00:00:00Z')), '2026-27');
    // March 2027 -> 2026-27
    assert.equal(getIndianFinancialYear(new Date('2027-03-31T12:00:00Z')), '2026-27');
    // March 2026 -> 2025-26
    assert.equal(getIndianFinancialYear(new Date('2026-03-31T12:00:00Z')), '2025-26');
  });

  it('should resolve Place of Supply (POS) and B2B status correctly', () => {
    // Maharashtra B2B GSTIN
    const posMH = resolveRecipientPlaceOfSupply({
      firmGSTIN: '27AABCB9823Q1Z2',
    });
    assert.equal(posMH.stateCode, '27');
    assert.equal(posMH.stateName, 'Maharashtra');
    assert.equal(posMH.placeOfSupply, '27 - Maharashtra');
    assert.equal(posMH.isB2B, true);

    // Delhi B2B GSTIN
    const posDL = resolveRecipientPlaceOfSupply({
      firmGSTIN: '07AAAAA0000A1Z5',
    });
    assert.equal(posDL.stateCode, '07');
    assert.equal(posDL.stateName, 'Delhi');
    assert.equal(posDL.isB2B, true);

    // Karnataka by state name (unregistered / B2C)
    const posKA = resolveRecipientPlaceOfSupply({
      state: 'Karnataka',
    });
    assert.equal(posKA.stateCode, '29');
    assert.equal(posKA.stateName, 'Karnataka');
    assert.equal(posKA.isB2B, false);

    // Fallback default Maharashtra
    const posDefault = resolveRecipientPlaceOfSupply({});
    assert.equal(posDefault.stateCode, '27');
    assert.equal(posDefault.stateName, 'Maharashtra');
    assert.equal(posDefault.isB2B, false);
  });

  it('should convert numbers into Indian English words with paise precision', () => {
    assert.equal(numberToIndianWords(0), 'Zero');
    assert.equal(numberToIndianWords(5888), 'Five Thousand Eight Hundred Eighty-Eight');
    assert.equal(numberToIndianWords(100000), 'One Lakh');
    assert.equal(numberToIndianWords(15000000), 'One Crore Fifty Lakh');

    assert.equal(
      numberToIndianWordsPaise(5888, 0),
      'Rupees Five Thousand Eight Hundred Eighty-Eight and Zero Paise Only',
    );
    assert.equal(
      numberToIndianWordsPaise(5888, 50),
      'Rupees Five Thousand Eight Hundred Eighty-Eight and Fifty Paise Only',
    );
    assert.equal(
      numberToIndianWordsPaise(0, 0),
      'Rupees Zero and Zero Paise Only',
    );
  });

  it('should compute intra-state GST (CGST 9% + SGST 9%) for Maharashtra', () => {
    // Gross payment ₹5,900 tax inclusive
    const tax = calculateTaxBreakdown({
      amount: 5900,
      recipientStateCode: '27',
      isTaxInclusive: true,
    });

    assert.equal(tax.taxTreatment, 'INTRA_STATE');
    assert.equal(tax.gstRate, 18.0);
    assert.equal(tax.cgstRate, 9.0);
    assert.equal(tax.sgstRate, 9.0);
    assert.equal(tax.igstRate, 0);
    assert.equal(tax.taxableAmount, 5000.0);
    assert.equal(tax.cgstAmount, 450.0);
    assert.equal(tax.sgstAmount, 450.0);
    assert.equal(tax.igstAmount, 0);
    assert.equal(tax.taxTotal, 900.0);
    assert.equal(tax.grandTotal, 5900);
    assert.equal(tax.grandTotalPaise, 590000);
    assert.equal(tax.roundOff, 0);
    assert.equal(
      tax.amountInWords,
      'Rupees Five Thousand Nine Hundred and Zero Paise Only',
    );
  });

  it('should compute inter-state GST (IGST 18%) for non-Maharashtra states', () => {
    // Gross payment ₹5,900 tax inclusive to Gujarat (24)
    const tax = calculateTaxBreakdown({
      amount: 5900,
      recipientStateCode: '24',
      isTaxInclusive: true,
    });

    assert.equal(tax.taxTreatment, 'INTER_STATE');
    assert.equal(tax.gstRate, 18.0);
    assert.equal(tax.cgstRate, 0);
    assert.equal(tax.sgstRate, 0);
    assert.equal(tax.igstRate, 18.0);
    assert.equal(tax.taxableAmount, 5000.0);
    assert.equal(tax.cgstAmount, 0);
    assert.equal(tax.sgstAmount, 0);
    assert.equal(tax.igstAmount, 900.0);
    assert.equal(tax.taxTotal, 900.0);
    assert.equal(tax.grandTotal, 5900);
    assert.equal(tax.grandTotalPaise, 590000);
    assert.equal(tax.roundOff, 0);
  });

  it('should handle tax-exclusive calculations accurately without paise loss', () => {
    // Tax exclusive: taxable ₹10,000 + 18% IGST = ₹11,800
    const tax = calculateTaxBreakdown({
      amount: 10000,
      recipientStateCode: '07', // Delhi
      isTaxInclusive: false,
    });

    assert.equal(tax.taxTreatment, 'INTER_STATE');
    assert.equal(tax.taxableAmount, 10000);
    assert.equal(tax.igstAmount, 1800);
    assert.equal(tax.taxTotal, 1800);
    assert.equal(tax.grandTotal, 11800);
    assert.equal(tax.grandTotalPaise, 1180000);
    assert.equal(tax.roundOff, 0);
  });

  it('should handle complimentary / zero-amount exemptions cleanly', () => {
    const tax = calculateTaxBreakdown({
      amount: 0,
      recipientStateCode: '27',
      isComplimentary: true,
    });

    assert.equal(tax.taxTreatment, 'EXEMPT');
    assert.equal(tax.taxableAmount, 0);
    assert.equal(tax.taxTotal, 0);
    assert.equal(tax.grandTotal, 0);
    assert.equal(tax.grandTotalPaise, 0);
    assert.equal(tax.amountInWords, 'Rupees Zero and Zero Paise Only');
  });
});

describe('Manual Subscription Service: Tenure Stacking Arithmetic', () => {
  it('should add calendar months preserving day-of-month and handling month-ends', () => {
    // Normal addition: Jan 15 + 1 month -> Feb 15
    const jan15 = new Date('2026-01-15T10:00:00Z');
    const feb15 = addMonths(jan15, 1);
    assert.equal(feb15.getUTCMonth(), 1); // 1 = Feb
    assert.equal(feb15.getUTCDate(), 15);

    // Stacking 12 months: Jan 15, 2026 + 12 months -> Jan 15, 2027
    const nextYear = addMonths(jan15, 12);
    assert.equal(nextYear.getUTCFullYear(), 2027);
    assert.equal(nextYear.getUTCMonth(), 0);
    assert.equal(nextYear.getUTCDate(), 15);

    // Month-end clamp: Jan 31 + 1 month -> Feb 28 (or Feb 29 in leap year)
    const jan31 = new Date('2026-01-31T10:00:00Z');
    const febEnd = addMonths(jan31, 1);
    assert.equal(febEnd.getMonth(), 1); // Feb
    assert.equal(febEnd.getDate(), 28);
  });
});
