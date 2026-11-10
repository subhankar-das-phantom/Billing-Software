/**
 * Bharat Enterprise Billing System — Platform Tax Invoice Service
 * Statutory B2B GST Tax Invoice generation conforming to Section 31 CGST Act 2017 & Rule 46.
 */

import { ClientSession, Types } from 'mongoose';
import PlatformInvoice, {
  IPlatformInvoice,
  IPlatformInvoiceItem,
  IPlatformInvoiceTotals,
  IPlatformInvoiceIssuer,
  IPlatformInvoiceRecipient,
  TaxTreatmentType,
} from '../models/PlatformInvoice';
import PlatformSequence from '../models/PlatformSequence';

// ─── Indian GST State Codes (Section 31 POS Reference) ───────────
export const INDIAN_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

// Normalized state name lookup
const STATE_NAME_TO_CODE: Record<string, string> = {};
for (const [code, name] of Object.entries(INDIAN_STATE_CODES)) {
  STATE_NAME_TO_CODE[name.toLowerCase().replace(/[^a-z0-9]/g, '')] = code;
}

// ─── Platform Legal Entity Snapshot ──────────────────────────────
export const DEFAULT_PLATFORM_ISSUER: IPlatformInvoiceIssuer = {
  legalName: 'Bharat Enterprise Technologies Private Limited',
  tradeName: 'Bharat Enterprise',
  gstin: process.env.PLATFORM_COMPANY_GSTIN || '27AAPCB1234F1Z5',
  pan: process.env.PLATFORM_COMPANY_PAN || 'AAPCB1234F',
  state: 'Maharashtra',
  stateCode: '27',
  address:
    process.env.PLATFORM_COMPANY_ADDRESS ||
    'Plot C-59, G-Block, Bandra Kurla Complex, Bandra (East), Mumbai, Maharashtra 400051',
  supportEmail: process.env.PLATFORM_SUPPORT_EMAIL || 'billing@bharatenterprise.com',
  supportPhone: process.env.PLATFORM_SUPPORT_PHONE || '+91 22 6984 0000',
};

/**
 * Calculates Indian Financial Year string (e.g., Nov 2026 -> '2026-27').
 * In India, FY runs from April 1st to March 31st (anchored to Asia/Kolkata).
 */
export function getIndianFinancialYear(date: Date = new Date()): string {
  const d = new Date(date);
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
  });
  const parts = istFormatter.formatToParts(d);
  const yearPart = parts.find((p) => p.type === 'year');
  const monthPart = parts.find((p) => p.type === 'month');

  const year = yearPart ? parseInt(yearPart.value, 10) : d.getFullYear();
  const month = monthPart ? parseInt(monthPart.value, 10) : d.getMonth() + 1; // 1-12

  let startYear: number;
  let endYear: number;

  if (month >= 4) {
    // April to December
    startYear = year;
    endYear = (year + 1) % 100;
  } else {
    // January to March
    startYear = year - 1;
    endYear = year % 100;
  }

  return `${startYear}-${String(endYear).padStart(2, '0')}`;
}

/**
 * Resolves recipient State Code and Place of Supply (POS) from GSTIN or state name.
 */
export function resolveRecipientPlaceOfSupply(params: {
  firmGSTIN?: string;
  stateCode?: string;
  state?: string;
}): { stateCode: string; stateName: string; placeOfSupply: string; isB2B: boolean } {
  const rawGstin = (params.firmGSTIN || '').trim().toUpperCase();
  const isB2B = rawGstin.length === 15;

  let stateCode = '';
  if (isB2B && /^[0-9]{2}/.test(rawGstin)) {
    stateCode = rawGstin.slice(0, 2);
  } else if (params.stateCode && /^[0-9]{2}/.test(params.stateCode.trim())) {
    stateCode = params.stateCode.trim();
  } else if (params.state) {
    const normalized = params.state.toLowerCase().replace(/[^a-z0-9]/g, '');
    stateCode = STATE_NAME_TO_CODE[normalized] || '27';
  } else {
    stateCode = '27'; // Default Maharashtra
  }

  const stateName = INDIAN_STATE_CODES[stateCode] || params.state || 'Maharashtra';
  const placeOfSupply = `${stateCode} - ${stateName}`;

  return { stateCode, stateName, placeOfSupply, isB2B };
}

/**
 * Converts numbers into Indian English words with Crores, Lakhs, Thousands, Hundreds, Tens, Ones.
 */
const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigits(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n] || '';
  const ten = Math.floor(n / 10);
  const rest = n % 10;
  return TENS[ten] + (rest > 0 ? '-' + ONES[rest] : '');
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let str = '';
  if (hundred > 0) {
    str += ONES[hundred] + ' Hundred';
    if (rest > 0) str += ' ';
  }
  if (rest > 0) {
    str += twoDigits(rest);
  }
  return str;
}

export function numberToIndianWords(num: number): string {
  if (num === 0) return 'Zero';
  let n = Math.floor(num);

  const crores = Math.floor(n / 10000000);
  n %= 10000000;
  const lakhs = Math.floor(n / 100000);
  n %= 100000;
  const thousands = Math.floor(n / 1000);
  n %= 1000;
  const remaining = n;

  const parts: string[] = [];

  if (crores > 0) {
    parts.push(twoDigits(crores) + ' Crore');
  }
  if (lakhs > 0) {
    parts.push(twoDigits(lakhs) + ' Lakh');
  }
  if (thousands > 0) {
    parts.push(twoDigits(thousands) + ' Thousand');
  }
  if (remaining > 0) {
    parts.push(threeDigits(remaining));
  }

  return parts.join(' ').trim();
}

/**
 * Returns Indian English currency words with explicit paise precision.
 * e.g. "Rupees Five Thousand Eight Hundred Eighty-Eight and Zero Paise Only"
 */
export function numberToIndianWordsPaise(rupees: number, paise: number = 0): string {
  const rVal = Math.floor(rupees);
  const pVal = Math.round(paise) % 100;

  const rWords = numberToIndianWords(rVal);
  if (pVal > 0) {
    const pWords = numberToIndianWords(pVal);
    return `Rupees ${rWords} and ${pWords} Paise Only`;
  }
  return `Rupees ${rWords} and Zero Paise Only`;
}

/**
 * Gapless atomic sequence incrementer on `PlatformSequence` producing `BE/26-27/XXXXX`.
 */
export async function getNextPlatformInvoiceNumber(
  financialYear: string,
  session?: ClientSession,
): Promise<string> {
  const seqDoc = await PlatformSequence.findOneAndUpdate(
    { entity: 'PLATFORM_INVOICE', financialYear },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );

  const seqNumber = seqDoc.seq;
  return `BE/${financialYear}/${String(seqNumber).padStart(5, '0')}`;
}

export interface TaxCalculationInput {
  amount: number;
  recipientStateCode: string;
  isTaxInclusive?: boolean;
  isComplimentary?: boolean;
}

export interface TaxCalculationResult {
  taxTreatment: TaxTreatmentType;
  taxableAmount: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  taxTotal: number;
  rawTotal: number;
  roundOff: number;
  grandTotal: number;
  grandTotalPaise: number;
  amountInWords: string;
}

/**
 * Evaluates Place of Supply (POS), tax treatment, and statutory 18% GST (SAC 998313).
 */
export function calculateTaxBreakdown(input: TaxCalculationInput): TaxCalculationResult {
  const { amount, recipientStateCode, isTaxInclusive = true, isComplimentary = false } = input;

  if (isComplimentary || amount <= 0) {
    return {
      taxTreatment: 'EXEMPT',
      taxableAmount: 0,
      gstRate: 0,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      taxTotal: 0,
      rawTotal: 0,
      roundOff: 0,
      grandTotal: 0,
      grandTotalPaise: 0,
      amountInWords: 'Rupees Zero and Zero Paise Only',
    };
  }

  const isIntraState = recipientStateCode === DEFAULT_PLATFORM_ISSUER.stateCode;
  const taxTreatment: TaxTreatmentType = isIntraState ? 'INTRA_STATE' : 'INTER_STATE';
  const gstRate = 18.0;

  let taxableAmount = 0;
  if (isTaxInclusive) {
    taxableAmount = Math.round((amount / (1 + gstRate / 100)) * 100) / 100;
  } else {
    taxableAmount = Math.round(amount * 100) / 100;
  }

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isIntraState) {
    cgstRate = 9.0;
    sgstRate = 9.0;
    cgstAmount = Math.round(taxableAmount * (cgstRate / 100) * 100) / 100;
    sgstAmount = Math.round(taxableAmount * (sgstRate / 100) * 100) / 100;
  } else {
    igstRate = 18.0;
    igstAmount = Math.round(taxableAmount * (igstRate / 100) * 100) / 100;
  }

  const taxTotal = Math.round((cgstAmount + sgstAmount + igstAmount) * 100) / 100;
  const rawTotal = Math.round((taxableAmount + taxTotal) * 100) / 100;
  const grandTotal = Math.round(rawTotal);
  const roundOff = Math.round((grandTotal - rawTotal) * 100) / 100;
  const grandTotalPaise = Math.round(grandTotal * 100);

  const paise = Math.round((rawTotal - Math.floor(rawTotal)) * 100);
  const amountInWords = numberToIndianWordsPaise(grandTotal, 0);

  return {
    taxTreatment,
    taxableAmount,
    gstRate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    taxTotal,
    rawTotal,
    roundOff,
    grandTotal,
    grandTotalPaise,
    amountInWords,
  };
}

export interface CreatePlatformInvoiceParams {
  tenant: {
    _id: Types.ObjectId | string;
    firmName: string;
    firmGSTIN?: string;
    firmAddress?: string;
    firmPhone?: string;
    firmEmail?: string;
    state?: string;
    stateCode?: string;
  };
  plan: {
    _id: Types.ObjectId | string;
    name: string;
    code: string;
    description?: string;
    baseMonthlyPrice: number;
  };
  subscriptionId?: Types.ObjectId | string;
  paymentId?: Types.ObjectId | string;
  paymentMode?: string;
  utrNumber?: string;
  paidAt?: Date;
  durationMonths: number;
  taxableAmount?: number;
  grossAmount?: number;
  discount?: number;
  isTaxInclusive?: boolean;
  isComplimentary?: boolean;
  issuedBy?: Types.ObjectId | string;
  invoiceDate?: Date;
}

/**
 * Statutory B2B GST Tax Invoice creator conforming to Section 31 CGST Act 2017 & Rule 46.
 * Generates and saves the `PlatformInvoice` document within an active MongoDB session.
 */
export async function createPlatformTaxInvoice(
  params: CreatePlatformInvoiceParams,
  session?: ClientSession,
): Promise<IPlatformInvoice> {
  const invoiceDate = params.invoiceDate || new Date();
  const financialYear = getIndianFinancialYear(invoiceDate);
  const invoiceNumber = await getNextPlatformInvoiceNumber(financialYear, session);

  const pos = resolveRecipientPlaceOfSupply({
    firmGSTIN: params.tenant.firmGSTIN,
    stateCode: params.tenant.stateCode,
    state: params.tenant.state,
  });

  const effectiveAmount =
    params.isComplimentary
      ? 0
      : (params.grossAmount !== undefined ? params.grossAmount : (params.taxableAmount || 0));

  const tax = calculateTaxBreakdown({
    amount: effectiveAmount,
    recipientStateCode: pos.stateCode,
    isTaxInclusive: params.isTaxInclusive ?? true,
    isComplimentary: params.isComplimentary ?? false,
  });

  const discountVal = Math.round(Number(params.discount || 0) * 100) / 100;
  const unitPrice =
    tax.taxableAmount > 0
      ? Math.round((tax.taxableAmount + discountVal) * 100) / 100
      : params.plan.baseMonthlyPrice * params.durationMonths;

  const item: IPlatformInvoiceItem = {
    description: `${params.plan.name} SaaS Subscription (${params.durationMonths} Month${
      params.durationMonths > 1 ? 's' : ''
    })`,
    sacCode: '998313',
    durationMonths: params.durationMonths,
    quantity: 1,
    unitPrice,
    discount: discountVal,
    taxableAmount: tax.taxableAmount,
    gstRate: tax.gstRate,
    cgstRate: tax.cgstRate,
    cgstAmount: tax.cgstAmount,
    sgstRate: tax.sgstRate,
    sgstAmount: tax.sgstAmount,
    igstRate: tax.igstRate,
    igstAmount: tax.igstAmount,
    totalAmount: tax.grandTotal,
  };

  const totals: IPlatformInvoiceTotals = {
    subTotal: unitPrice,
    totalDiscount: discountVal,
    taxableValue: tax.taxableAmount,
    cgstTotal: tax.cgstAmount,
    sgstTotal: tax.sgstAmount,
    igstTotal: tax.igstAmount,
    taxTotal: tax.taxTotal,
    roundOff: tax.roundOff,
    grandTotal: tax.grandTotal,
    grandTotalPaise: tax.grandTotalPaise,
    amountInWords: tax.amountInWords,
  };

  const recipient: IPlatformInvoiceRecipient = {
    tenantId: new Types.ObjectId(params.tenant._id.toString()),
    firmName: params.tenant.firmName,
    firmGSTIN: params.tenant.firmGSTIN || '',
    firmAddress: params.tenant.firmAddress || '',
    firmPhone: params.tenant.firmPhone || '',
    firmEmail: params.tenant.firmEmail || '',
    state: pos.stateName,
    stateCode: pos.stateCode,
    placeOfSupply: pos.placeOfSupply,
    isB2B: pos.isB2B,
  };

  const invoiceData: Partial<IPlatformInvoice> = {
    invoiceNumber,
    invoiceDate,
    financialYear,
    issuer: DEFAULT_PLATFORM_ISSUER,
    recipient,
    items: [item],
    totals,
    taxTreatment: tax.taxTreatment,
    status: 'ISSUED',
  };

  if (params.subscriptionId) {
    invoiceData.subscriptionId = new Types.ObjectId(params.subscriptionId.toString());
  }
  if (params.plan._id) {
    invoiceData.planId = new Types.ObjectId(params.plan._id.toString());
  }
  if (params.issuedBy) {
    invoiceData.issuedBy = new Types.ObjectId(params.issuedBy.toString());
  }
  if (params.paymentId || params.paymentMode || params.utrNumber) {
    invoiceData.payment = {
      paymentId: params.paymentId ? new Types.ObjectId(params.paymentId.toString()) : undefined,
      paymentMode: params.paymentMode,
      utrNumber: params.utrNumber,
      paidAt: params.paidAt || invoiceDate,
    };
  }

  const invoiceDocs = await PlatformInvoice.create([invoiceData], { session });
  const savedInvoice = invoiceDocs[0];
  if (!savedInvoice) {
    throw new Error('Failed to create platform invoice document');
  }

  return savedInvoice;
}
