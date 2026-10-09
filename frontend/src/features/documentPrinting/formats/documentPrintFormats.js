/**
 * Authoritative Multi-Document Print Formats & Capability Matrix
 * Bharat Enterprise Billing System
 */

export const PRINT_FORMATS = Object.freeze({
  A4: 'A4',
  A5: 'A4', // Deprecated: unified into A4 (A4 / A5)
  THERMAL_80: 'THERMAL_80',
  THERMAL_58: 'THERMAL_58'
});

export const DOCUMENT_TYPES = Object.freeze({
  INVOICE: 'invoice',
  CREDIT_NOTE: 'creditNote',
  PAYMENT_RECEIPT: 'paymentReceipt',
  CUSTOMER_LEDGER: 'customerLedger',
  SUPPLIER_LEDGER: 'supplierLedger',
  DAILY_CLOSEOUT: 'dailyCloseout'
});

export const FORMAT_METADATA = Object.freeze({
  [PRINT_FORMATS.A4]: {
    id: PRINT_FORMATS.A4,
    label: 'A4 / A5',
    sublabel: 'Standard Sheet / Half Cut (210 × 297 mm)',
    pageWidthMm: 210,
    contentWidthMm: 190,
    marginMm: 6,
    cssClass: 'print-format-a4',
    badge: 'Sheet',
    supportsDoubleCopy: true
  },
  // Backward compatibility alias for legacy 'A5' preference reads
  A5: {
    id: 'A4',
    label: 'A4 / A5',
    sublabel: 'Standard Sheet / Half Cut (210 × 297 mm)',
    pageWidthMm: 210,
    contentWidthMm: 190,
    marginMm: 6,
    cssClass: 'print-format-a4',
    badge: 'Sheet',
    supportsDoubleCopy: true
  },
  [PRINT_FORMATS.THERMAL_80]: {
    id: PRINT_FORMATS.THERMAL_80,
    label: 'Thermal 80mm',
    sublabel: '3-inch POS Roll (~72mm printable width)',
    pageWidthMm: 80,
    contentWidthMm: 72,
    marginMm: 2,
    cssClass: 'print-format-thermal-80',
    badge: '3-Inch POS',
    supportsDoubleCopy: false
  },
  [PRINT_FORMATS.THERMAL_58]: {
    id: PRINT_FORMATS.THERMAL_58,
    label: 'Thermal 58mm',
    sublabel: '2-inch POS Roll (~48mm printable width)',
    pageWidthMm: 58,
    contentWidthMm: 48,
    marginMm: 2,
    cssClass: 'print-format-thermal-58',
    badge: '2-Inch POS',
    supportsDoubleCopy: false
  }
});

export const DOCUMENT_CAPABILITY_MATRIX = Object.freeze({
  [DOCUMENT_TYPES.INVOICE]: [
    PRINT_FORMATS.A4,
    PRINT_FORMATS.THERMAL_80,
    PRINT_FORMATS.THERMAL_58
  ],
  [DOCUMENT_TYPES.CREDIT_NOTE]: [
    PRINT_FORMATS.A4,
    PRINT_FORMATS.THERMAL_80,
    PRINT_FORMATS.THERMAL_58
  ],
  [DOCUMENT_TYPES.PAYMENT_RECEIPT]: [
    PRINT_FORMATS.A4,
    PRINT_FORMATS.THERMAL_80,
    PRINT_FORMATS.THERMAL_58
  ],
  [DOCUMENT_TYPES.CUSTOMER_LEDGER]: [
    PRINT_FORMATS.A4
  ],
  [DOCUMENT_TYPES.SUPPLIER_LEDGER]: [
    PRINT_FORMATS.A4
  ],
  [DOCUMENT_TYPES.DAILY_CLOSEOUT]: [
    PRINT_FORMATS.A4
  ]
});

/**
 * Pure, tested fallback resolution function.
 * Resolves account-configured default format for document type with fallback to A4.
 *
 * @param {Object} preferences - Admin or populated employee preferences object
 * @param {string} documentType - Key in DOCUMENT_TYPES
 * @returns {string} One of PRINT_FORMATS
 */
export function resolveDocumentPrintFormat(preferences, documentType) {
  const allowed = DOCUMENT_CAPABILITY_MATRIX[documentType] || [PRINT_FORMATS.A4];
  const configured = preferences?.documentPrintFormats?.[documentType];
  if (configured === 'A5') {
    return PRINT_FORMATS.A4;
  }
  if (configured && allowed.includes(configured)) {
    return configured;
  }
  return PRINT_FORMATS.A4;
}
