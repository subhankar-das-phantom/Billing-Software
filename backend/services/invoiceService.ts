import mongoose from 'mongoose';
import Sequence from '../models/Sequence';
const { numberToWords } = require('../utils/numberToWords');

export const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Atomically obtain the next monotonic sequence integer for a tenant and entity.
 * Uses MongoDB findOneAndUpdate with $inc for 100% thread-safe atomic increments.
 * Automatically initializes from pre-existing records on first call without race conditions.
 */
export async function getNextSequenceValue(
  tenantId: mongoose.Types.ObjectId | string,
  entity: string,
  year: number = new Date().getFullYear()
): Promise<number> {
  const tId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  // Step 1: Attempt fast atomic increment on existing sequence record
  const updated = await Sequence.findOneAndUpdate(
    { tenantId: tId, entity, year },
    { $inc: { seq: 1 } },
    { new: true }
  );

  if (updated) {
    return updated.seq;
  }

  // Step 2: Sequence record does not exist yet for this tenant + entity + year.
  // Resolve pre-existing highest sequence number to prevent collisions.
  let initialMax = 0;

  if (entity === 'invoice') {
    const Invoice = mongoose.models.Invoice || require('../models/Invoice');
    const prefix = `INV-${year}-`;
    const invoices = await Invoice.find({
      tenantId: tId,
      invoiceNumber: { $regex: `^${prefix}\\d+$` }
    })
      .select('invoiceNumber')
      .lean();

    for (const inv of invoices) {
      const parts = String(inv.invoiceNumber || '').split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(num) && num > initialMax) {
        initialMax = num;
      }
    }
  } else if (entity === 'credit_note') {
    const CreditNote = mongoose.models.CreditNote || require('../models/CreditNote');
    const prefix = `CN-${year}-`;
    const cns = await CreditNote.find({
      tenantId: tId,
      creditNoteNumber: { $regex: `^${prefix}\\d+$` }
    })
      .select('creditNoteNumber')
      .lean();

    for (const cn of cns) {
      const parts = String(cn.creditNoteNumber || '').split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(num) && num > initialMax) {
        initialMax = num;
      }
    }
  }

  // Step 3: Upsert with $setOnInsert so concurrent callers cannot overwrite each other
  try {
    await Sequence.updateOne(
      { tenantId: tId, entity, year },
      { $setOnInsert: { seq: initialMax } },
      { upsert: true }
    );
  } catch (err: any) {
    // If concurrent caller created it, duplicate key (11000) is safely ignored
    if (err?.code !== 11000) {
      throw err;
    }
  }

  // Step 4: Atomically increment from the seeded/initialized sequence
  const finalSequence = await Sequence.findOneAndUpdate(
    { tenantId: tId, entity, year },
    { $inc: { seq: 1 } },
    { new: true }
  );

  return finalSequence ? finalSequence.seq : initialMax + 1;
}

/**
 * Generate formatted next sequential invoice number for tenant
 * Format: INV-YYYY-XXXX (zero-padded to 4+ digits)
 */
export async function generateNextInvoiceNumber(
  tenantId: mongoose.Types.ObjectId | string,
  year: number = new Date().getFullYear(),
  prefix: string = 'INV'
): Promise<string> {
  const seq = await getNextSequenceValue(tenantId, 'invoice', year);
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate formatted next sequential credit note number for tenant
 * Format: CN-YYYY-XXXX (zero-padded to 4+ digits)
 */
export async function generateNextCreditNoteNumber(
  tenantId: mongoose.Types.ObjectId | string,
  year: number = new Date().getFullYear(),
  prefix: string = 'CN'
): Promise<string> {
  const seq = await getNextSequenceValue(tenantId, 'credit_note', year);
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

export interface ICalculatedItemAmounts {
  baseAmount: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
}

/**
 * Calculate invoice item amounts with exact paisa splitting.
 * Invariant: cgstAmount + sgstAmount === gstAmount to the exact paisa.
 */
export function calculateItemFinancials(
  quantity: number,
  rate: number,
  gstPercentage: number,
  discountPercentage: number = 0
): ICalculatedItemAmounts {
  const baseAmount = quantity * rate;
  const discountAmount = (baseAmount * discountPercentage) / 100;
  const taxableAmount = baseAmount - discountAmount;

  const roundedBase = round2(baseAmount);
  const roundedDiscount = round2(discountAmount);
  const roundedTaxable = round2(taxableAmount);

  const rawGst = (roundedTaxable * gstPercentage) / 100;
  const gstAmount = round2(rawGst);
  const cgstAmount = round2(gstAmount / 2);
  const sgstAmount = round2(gstAmount - cgstAmount); // Exact paisa split parity

  const totalAmount = round2(roundedTaxable + gstAmount);

  return {
    baseAmount: roundedBase,
    discountAmount: roundedDiscount,
    taxableAmount: roundedTaxable,
    gstAmount,
    cgstAmount,
    sgstAmount,
    totalAmount
  };
}

export interface ICalculatedInvoiceTotals {
  baseAmount: number;
  totalDiscount: number;
  totalTaxable: number;
  totalGST: number;
  totalCGST: number;
  totalSGST: number;
  netTotal: number;
  roundOff: number;
  finalTotal: number;
  amountInWords?: string;
}

/**
 * Calculate invoice totals from items.
 * Guarantees:
 * 1. totalCGST + totalSGST === totalGST (exact paisa parity)
 * 2. finalTotal === Math.round(netTotal)
 * 3. round2(netTotal + roundOff) === finalTotal
 */
export function calculateInvoiceTotals(items: any[]): ICalculatedInvoiceTotals {
  const totals = items.reduce(
    (acc, item) => {
      acc.baseAmount += item.baseAmount || 0;
      acc.totalDiscount += item.discountAmount || 0;
      acc.totalTaxable += item.taxableAmount || 0;
      acc.totalGST += item.gstAmount || 0;
      acc.totalCGST += item.cgstAmount || 0;
      acc.totalSGST += item.sgstAmount || 0;
      acc.netTotal += item.totalAmount || 0;
      return acc;
    },
    {
      baseAmount: 0,
      totalDiscount: 0,
      totalTaxable: 0,
      totalGST: 0,
      totalCGST: 0,
      totalSGST: 0,
      netTotal: 0
    }
  );

  const roundedBase = round2(totals.baseAmount);
  const roundedDiscount = round2(totals.totalDiscount);
  const roundedTaxable = round2(totals.totalTaxable);
  const roundedGST = round2(totals.totalGST);
  const roundedCGST = round2(totals.totalCGST);
  // Ensure totalCGST + totalSGST === totalGST down to the exact paisa
  const roundedSGST = round2(roundedGST - roundedCGST);
  const roundedNetTotal = round2(roundedTaxable + roundedGST);
  const finalTotal = Math.round(roundedNetTotal);
  const roundOff = round2(finalTotal - roundedNetTotal);

  return {
    baseAmount: roundedBase,
    totalDiscount: roundedDiscount,
    totalTaxable: roundedTaxable,
    totalGST: roundedGST,
    totalCGST: roundedCGST,
    totalSGST: roundedSGST,
    netTotal: roundedNetTotal,
    roundOff,
    finalTotal,
    amountInWords: numberToWords ? numberToWords(finalTotal) : ''
  };
}

export default {
  round2,
  getNextSequenceValue,
  generateNextInvoiceNumber,
  generateNextCreditNoteNumber,
  calculateItemFinancials,
  calculateInvoiceTotals
};

