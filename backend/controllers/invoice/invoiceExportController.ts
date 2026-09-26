import type { NextFunction, Response } from 'express';
import type PDFKit from 'pdfkit';
import type { AuthenticatedRequest, IDistributorSnapshot, IInvoice } from './types';

const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Invoice = require('../../models/Invoice');
const Admin = require('../../models/Admin');
const { generateInvoiceExcel, generateInvoiceCSV } = require('../../utils/excelExport');
const { numberToWords } = require('../../utils/numberToWords');
const getTenantId = require('../../utils/getTenantId');

type QueryValue = unknown;
type InvoiceQuery = {
  tenantId: unknown;
  _id?: { $in: string[] };
  invoiceDate?: {
    $gte?: Date;
    $lte?: Date;
  };
};

const currency = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatCurrency = (value?: number) => `Rs. ${currency.format(Number(value) || 0)}`;

const formatDate = (dateValue?: Date | string) => {
  const date = new Date(dateValue || '');
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const formatDateTime = (dateValue: Date = new Date()) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateValue);

const parseISTDateBoundary = (dateInput: QueryValue, endOfDay = false) => {
  const raw = singleQueryValue(dateInput);
  if (!raw) return null;

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const timePart = endOfDay ? '23:59:59.999' : '00:00:00.000';
    const parsed = new Date(`${year}-${month}-${day}T${timePart}+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function singleQueryValue(value: QueryValue) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === undefined || rawValue === null) return '';
  return String(rawValue);
}

function buildInvoiceQuery(req: AuthenticatedRequest): InvoiceQuery | { error: string } {
  const { invoices: invoiceIds, startDate, endDate } = req.query as Record<string, QueryValue>;
  const tenantId = getTenantId(req);
  const query: InvoiceQuery = { tenantId };

  const idsValue = singleQueryValue(invoiceIds);
  if (idsValue) {
    const ids = idsValue.split(',').map((id) => id.trim()).filter(Boolean);
    if (!ids.length || ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return { error: 'Invalid invoice IDs for export' };
    }
    query._id = { $in: ids };
    return query;
  }

  const hasStartDate = Boolean(singleQueryValue(startDate));
  const hasEndDate = Boolean(singleQueryValue(endDate));

  if (hasStartDate || hasEndDate) {
    const invoiceDate: InvoiceQuery['invoiceDate'] = {};

    if (hasStartDate) {
      const start = parseISTDateBoundary(startDate, false);
      if (!start) return { error: 'Invalid start date for export' };
      invoiceDate.$gte = start;
    }

    if (hasEndDate) {
      const end = parseISTDateBoundary(endDate, true);
      if (!end) return { error: 'Invalid end date for export' };
      invoiceDate.$lte = end;
    }

    query.invoiceDate = invoiceDate;
  }

  return query;
}

function safeText(value: unknown, fallback = 'N/A') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatAmountInWords(invoice: IInvoice) {
  const existing = safeText(invoice.totals?.amountInWords, '');
  if (existing) return existing;
  return numberToWords(Number(invoice.totals?.netTotal) || 0);
}

function drawCell(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: PDFKit.Mixins.TextOptions = {}
) {
  doc.rect(x, y, width, height).stroke('#cbd5e1');
  doc.text(text, x + 4, y + 5, {
    width: width - 8,
    height: height - 8,
    ellipsis: true,
    ...options
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number, header?: () => void) {
  if (doc.y + neededHeight <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
  if (header) header();
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return 'All Time';
  const start = startDate ? formatDate(startDate) : '';
  const end = endDate ? formatDate(endDate) : '';
  if (start && end) {
    return start === end ? start : `${start} — ${end}`;
  }
  if (start) return `From ${start}`;
  return `Up to ${end}`;
}

function drawReportHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#0f172a')
    .text(title, { align: 'center' });

  if (subtitle) {
    doc
      .moveDown(0.3)
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#475569')
      .text(subtitle, { align: 'center' });
  }

  doc.moveDown(1);
}

interface BulkExportOptions {
  firmName?: string;
  dateRange?: string;
}

function drawBulkInvoicePDF(doc: PDFKit.PDFDocument, invoices: IInvoice[], options: BulkExportOptions = {}) {
  // Firm name banner
  if (options.firmName) {
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#0f172a')
      .text(options.firmName, { align: 'center' });
    doc.moveDown(0.3);
  }

  const subtitleParts = [];
  if (options.dateRange) subtitleParts.push(`Period: ${options.dateRange}`);
  subtitleParts.push(`Generated on ${formatDateTime()}`);

  drawReportHeader(doc, 'Invoice Export Report', subtitleParts.join('  |  '));

  // Exclude cancelled invoices from financial summary
  const activeInvoices = invoices.filter((inv) => inv.status !== 'Cancelled');
  const cancelledCount = invoices.length - activeInvoices.length;
  const totalAmount = activeInvoices.reduce((sum, invoice) => sum + (invoice.totals?.netTotal || 0), 0);
  const totalTaxable = activeInvoices.reduce((sum, invoice) => sum + (invoice.totals?.totalTaxable || 0), 0);
  const totalGST = activeInvoices.reduce((sum, invoice) => sum + (invoice.totals?.totalGST || 0), 0);

  doc
    .roundedRect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 62, 6)
    .fillAndStroke('#f8fafc', '#cbd5e1');

  const summaryY = doc.y + 12;
  const summaryWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 4;
  const invoiceCountLabel = cancelledCount > 0
    ? `${invoices.length} (${activeInvoices.length} active)`
    : String(invoices.length);
  const summary = [
    ['Invoices', invoiceCountLabel],
    ['Taxable', formatCurrency(totalTaxable)],
    ['GST', formatCurrency(totalGST)],
    ['Net Total', formatCurrency(totalAmount)]
  ];

  summary.forEach(([label, value], index) => {
    const x = doc.page.margins.left + index * summaryWidth;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748b')
      .text(label, x + 10, summaryY, { width: summaryWidth - 20, align: 'center' })
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#0f172a')
      .text(value, x + 10, summaryY + 18, { width: summaryWidth - 20, align: 'center' });
  });

  doc.y = summaryY + 58;

  const columns = [
    { label: 'Invoice #', width: 88, align: 'left' as const },
    { label: 'Date', width: 72, align: 'left' as const },
    { label: 'Customer', width: 170, align: 'left' as const },
    { label: 'Items', width: 45, align: 'right' as const },
    { label: 'Status', width: 70, align: 'left' as const },
    { label: 'Net Total', width: 88, align: 'right' as const }
  ];

  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const startX = doc.page.margins.left;
  const drawHeader = () => {
    let x = startX;
    const y = doc.y;
    doc.rect(startX, y, tableWidth, 22).fill('#0f766e');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    columns.forEach((col) => {
      doc.text(col.label, x + 4, y + 7, { width: col.width - 8, align: col.align });
      x += col.width;
    });
    doc.y = y + 22;
  };

  drawHeader();
  invoices.forEach((invoice, index) => {
    const isCancelled = invoice.status === 'Cancelled';
    ensureSpace(doc, 24, drawHeader);
    const y = doc.y;

    // Cancelled rows: light red background; otherwise alternate
    if (isCancelled) {
      doc.rect(startX, y, tableWidth, 24).fill('#fef2f2');
    } else if (index % 2 === 0) {
      doc.rect(startX, y, tableWidth, 24).fill('#f8fafc');
    }

    // Cancelled rows use red text
    doc.font('Helvetica').fontSize(8).fillColor(isCancelled ? '#dc2626' : '#0f172a');
    let x = startX;
    const row = [
      safeText(invoice.invoiceNumber),
      formatDate(invoice.invoiceDate),
      safeText(invoice.customer?.customerName),
      String(invoice.items?.length || 0),
      safeText(invoice.status, 'Created'),
      formatCurrency(invoice.totals?.netTotal)
    ];

    columns.forEach((col, colIndex) => {
      drawCell(doc, row[colIndex], x, y, col.width, 24, { align: col.align });
      x += col.width;
    });
    doc.y = y + 24;
  });
}

function formatExpiryDate(rawDate?: string | Date | null) {
  if (!rawDate) return '-';
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return String(rawDate);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

function drawSingleInvoicePDF(doc: PDFKit.PDFDocument, invoice: IInvoice, distributor: IDistributorSnapshot) {
  const pageLeft = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const isCancelled = invoice.status === 'Cancelled';

  // 1. TOP HEADER BRANDING CARD (Full contentWidth)
  const headerCardY = doc.page.margins.top;
  const headerCardHeight = 60;

  doc.roundedRect(pageLeft, headerCardY, contentWidth, headerCardHeight, 4)
     .fillAndStroke('#f8fafc', '#cbd5e1');

  const distWidth = contentWidth * 0.62;
  const distX = pageLeft + 12;
  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .fillColor('#0f172a')
    .text(safeText(distributor.firmName, 'BHARAT ENTERPRISES'), distX, headerCardY + 8, {
      width: distWidth,
      ellipsis: true
    });

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#475569')
    .text(safeText(distributor.firmAddress, 'Trading & Distribution'), distX, headerCardY + 26, {
      width: distWidth,
      ellipsis: true
    });

  const distMetaParts: string[] = [];
  if (distributor.firmPhone) distMetaParts.push(`Phone: ${distributor.firmPhone}`);
  if (distributor.firmDL) distMetaParts.push(`DL No: ${distributor.firmDL}`);
  if (distributor.firmGSTIN) distMetaParts.push(`GSTIN: ${distributor.firmGSTIN}`);
  const distMetaText = distMetaParts.length > 0 ? distMetaParts.join('   |   ') : 'Authorized Wholesale & Distribution';

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#334155')
    .text(distMetaText, distX, headerCardY + 41, {
      width: distWidth,
      ellipsis: true
    });

  // Right Section: Document Badge & Payment Info
  const rightWidth = contentWidth - distWidth - 24;
  const rightX = pageLeft + distWidth + 12;

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#0f766e')
    .text('TAX INVOICE', rightX, headerCardY + 8, {
      width: rightWidth,
      align: 'right'
    });

  if (distributor.paymentInformation?.enabled) {
    const pay = distributor.paymentInformation;
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor('#0f766e')
      .text('Bank & Payment Information', rightX, headerCardY + 26, { width: rightWidth, align: 'right' });

    const payLines: string[] = [];
    if (pay.upiId) payLines.push(`UPI: ${pay.upiId}`);
    if (pay.accountNumber) payLines.push(`A/C: ${pay.accountNumber}`);
    if (pay.ifscCode) payLines.push(`IFSC: ${pay.ifscCode}`);

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#475569')
      .text(payLines.join('  |  '), rightX, headerCardY + 38, { width: rightWidth, align: 'right' });
  } else {
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#64748b')
      .text('Original for Recipient / Customer Copy', rightX, headerCardY + 28, {
        width: rightWidth,
        align: 'right'
      });
  }

  let currentY = headerCardY + headerCardHeight + 6;

  // CANCELLED BANNER
  if (isCancelled) {
    doc.roundedRect(pageLeft, currentY, contentWidth, 20, 3)
       .fillAndStroke('#fef2f2', '#dc2626');
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#dc2626')
      .text('CANCELLED — This invoice has been cancelled and is excluded from accounts', pageLeft + 10, currentY + 5, {
        width: contentWidth - 20,
        align: 'center'
      });
    currentY += 24;
  }

  // 2. DUAL BALANCED PARTY CARDS
  const partyCardHeight = 64;
  const partyGap = 8;
  const leftCardWidth = Math.floor(contentWidth * 0.60);
  const rightCardWidth = contentWidth - leftCardWidth - partyGap;
  const rightCardX = pageLeft + leftCardWidth + partyGap;

  // Left Card: Customer Details
  doc.roundedRect(pageLeft, currentY, leftCardWidth, partyCardHeight, 4)
     .fillAndStroke('#ffffff', '#cbd5e1');

  doc.roundedRect(pageLeft, currentY, leftCardWidth, 15, 4).fill('#f1f5f9');
  doc.rect(pageLeft, currentY + 11, leftCardWidth, 4).fill('#f1f5f9');
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor('#475569')
    .text('BILLED TO (BUYER DETAILS)', pageLeft + 10, currentY + 4, { width: leftCardWidth - 20 });

  const custName = safeText(invoice.customer?.customerName || (invoice.customer as any)?.name, 'Cash Customer');
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#0f172a')
    .text(`M/s ${custName}`, pageLeft + 10, currentY + 19, { width: leftCardWidth - 20, ellipsis: true });

  const custAddress = safeText(invoice.customer?.address, '');
  if (custAddress) {
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#475569')
      .text(custAddress, pageLeft + 10, currentY + 32, { width: leftCardWidth - 20, ellipsis: true });
  }

  const custMeta: string[] = [];
  if (invoice.customer?.phone) custMeta.push(`Ph: ${invoice.customer.phone}`);
  if (invoice.customer?.gstin) custMeta.push(`GSTIN: ${invoice.customer.gstin}`);
  if (invoice.customer?.dlNo) custMeta.push(`DL: ${invoice.customer.dlNo}`);
  const custMetaLine = custMeta.length > 0 ? custMeta.join('   |   ') : '-';

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#334155')
    .text(custMetaLine, pageLeft + 10, currentY + 46, { width: leftCardWidth - 20, ellipsis: true });

  // Right Card: Invoice Details
  doc.roundedRect(rightCardX, currentY, rightCardWidth, partyCardHeight, 4)
     .fillAndStroke('#f8fafc', '#cbd5e1');

  const metaRowH = 15;
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('#475569')
    .text('Invoice No:', rightCardX + 10, currentY + 4, { width: 75 });
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#0f172a')
    .text(safeText(invoice.invoiceNumber, '-'), rightCardX + 85, currentY + 4, { width: rightCardWidth - 95 });

  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('#475569')
    .text('Date:', rightCardX + 10, currentY + 4 + metaRowH, { width: 75 });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#0f172a')
    .text(formatDate(invoice.invoiceDate), rightCardX + 85, currentY + 4 + metaRowH, { width: rightCardWidth - 95 });

  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('#475569')
    .text('Payment Mode:', rightCardX + 10, currentY + 4 + metaRowH * 2, { width: 75 });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#0f172a')
    .text(safeText(invoice.paymentType, 'Credit').toUpperCase(), rightCardX + 85, currentY + 4 + metaRowH * 2, { width: rightCardWidth - 95 });

  const netDue = Math.max(0, (Number(invoice.totals?.netTotal) || 0) - (Number(invoice.paidAmount) || 0));
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('#475569')
    .text('Status:', rightCardX + 10, currentY + 4 + metaRowH * 3, { width: 75 });
  const statusColor = isCancelled ? '#dc2626' : (netDue <= 0 ? '#0f766e' : '#b45309');
  const statusText = isCancelled ? 'CANCELLED' : (netDue <= 0 ? 'PAID' : `PAYMENT DUE (${formatCurrency(netDue)})`);
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(statusColor)
    .text(statusText, rightCardX + 85, currentY + 4 + metaRowH * 3, { width: rightCardWidth - 95 });

  currentY += partyCardHeight + 6;
  doc.y = currentY;

  // 3. TABLE COLUMNS (Sum mathematically guaranteed to equal contentWidth)
  const baseColumns = [
    { key: 'sr', label: 'Sr.', weight: 24, align: 'center' as const },
    { key: 'desc', label: 'Item Description', weight: 168, align: 'left' as const },
    { key: 'hsn', label: 'HSN', weight: 52, align: 'center' as const },
    { key: 'batch', label: 'Batch', weight: 64, align: 'center' as const },
    { key: 'expiry', label: 'Expiry', weight: 46, align: 'center' as const },
    { key: 'qty', label: 'Qty', weight: 40, align: 'right' as const },
    { key: 'free', label: 'Fr', weight: 28, align: 'right' as const },
    { key: 'mrp', label: 'MRP', weight: 52, align: 'right' as const },
    { key: 'rate', label: 'Rate', weight: 52, align: 'right' as const },
    { key: 'disc', label: 'Disc%', weight: 40, align: 'center' as const },
    { key: 'gst', label: 'GST%', weight: 42, align: 'center' as const },
    { key: 'taxable', label: 'Taxable', weight: 75, align: 'right' as const },
    { key: 'total', label: 'Total', weight: 78, align: 'right' as const }
  ];

  const totalWeight = baseColumns.reduce((sum, col) => sum + col.weight, 0);
  let runningWidth = 0;
  const columns = baseColumns.map((col, idx) => {
    if (idx === baseColumns.length - 1) {
      const lastW = Math.round((contentWidth - runningWidth) * 100) / 100;
      return { ...col, width: lastW };
    }
    const w = Math.round((col.weight / totalWeight) * contentWidth * 100) / 100;
    runningWidth += w;
    return { ...col, width: w };
  });

  const tableWidth = contentWidth;
  const headerHeight = 20;
  const rowHeight = 20;

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(pageLeft, y, tableWidth, headerHeight).fill('#0f766e');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
    let x = pageLeft;
    columns.forEach((col) => {
      doc.text(col.label, x + 3, y + 6, { width: col.width - 6, align: col.align });
      x += col.width;
    });
    doc.y = y + headerHeight;
  };

  drawHeader();

  const items = invoice.items || [];
  items.forEach((item: any, index: number) => {
    ensureSpace(doc, rowHeight, drawHeader);
    const y = doc.y;

    if (index % 2 === 0) {
      doc.rect(pageLeft, y, tableWidth, rowHeight).fill('#f8fafc');
    }

    doc.font('Helvetica').fontSize(7).fillColor('#0f172a');

    const pName = item.product?.productName ?? item.productName ?? item.name ?? '-';
    const pack = item.product?.pack ?? item.pack ?? '';
    const descText = pack ? `${pName} (${pack})` : pName;
    const hsn = item.product?.hsnCode ?? item.hsnCode ?? '-';

    let batch = item.product?.batchNo ?? item.batchNo ?? item.batchNumber ?? '-';
    if (item.batchAllocations?.length > 0) {
      batch = item.batchAllocations.map((b: any) => b.batchNo || 'No Batch').join(', ');
    }

    let expiry = '-';
    if (item.batchAllocations?.length > 0 && item.batchAllocations[0].expiryDate) {
      expiry = formatExpiryDate(item.batchAllocations[0].expiryDate);
    } else {
      expiry = formatExpiryDate(item.product?.expiryDate ?? item.expiryDate);
    }

    const qty = item.quantitySold ?? item.quantity ?? 0;
    const free = item.freeQuantity ?? 0;
    const mrp = item.product?.newMRP ?? item.mrp ?? item.newMRP;
    const rate = Number(item.ratePerUnit ?? item.rate) || 0;
    const disc = Number(item.schemeDiscount ?? item.discountPercentage) || 0;
    const gst = Number(item.product?.gstPercentage ?? item.gstPercentage ?? item.gstRate) || 0;
    const taxable = Number(item.taxableAmount ?? (qty * rate)) || 0;
    const total = Number(item.totalAmount ?? (taxable * (1 + gst / 100))) || 0;

    const row = [
      String(index + 1),
      descText,
      hsn,
      batch,
      expiry,
      String(qty),
      free > 0 ? String(free) : '-',
      mrp ? currency.format(Number(mrp) || 0) : '-',
      currency.format(rate),
      disc > 0 ? `${disc.toFixed(1)}%` : '-',
      `${gst}%`,
      currency.format(taxable),
      currency.format(total)
    ];

    let x = pageLeft;
    columns.forEach((col, colIndex) => {
      drawCell(doc, row[colIndex], x, y, col.width, rowHeight, { align: col.align });
      x += col.width;
    });
    doc.y = y + rowHeight;
  });

  // 4. SUMMARY & TOTALS SECTION
  ensureSpace(doc, 130);
  doc.moveDown(0.5);

  const totalsWidth = 270;
  const totalsX = pageLeft + contentWidth - totalsWidth;
  const leftBoxWidth = contentWidth - totalsWidth - 10;
  const totalsStartY = doc.y;

  // Left Box: Amount in Words & Notes
  const leftBoxHeight = 110;
  doc.roundedRect(pageLeft, totalsStartY, leftBoxWidth, leftBoxHeight, 4)
     .fillAndStroke('#ffffff', '#cbd5e1');

  // Amount in Words sub-header
  doc.roundedRect(pageLeft, totalsStartY, leftBoxWidth, 16, 4).fill('#f1f5f9');
  doc.rect(pageLeft, totalsStartY + 12, leftBoxWidth, 4).fill('#f1f5f9');
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor('#475569')
    .text('AMOUNT IN WORDS', pageLeft + 10, totalsStartY + 4, { width: leftBoxWidth - 20 });

  const words = invoice.totals?.amountInWords || 'Rupees Zero Only';
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#0f172a')
    .text(words.toUpperCase(), pageLeft + 10, totalsStartY + 22, {
      width: leftBoxWidth - 20
    });

  // Terms & Conditions
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor('#64748b')
    .text('Terms & Conditions:', pageLeft + 10, totalsStartY + 52, { width: leftBoxWidth - 20 });
  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor('#475569')
    .text('1. Goods once sold will not be taken back without valid batch verification.\n2. Subject to local jurisdiction only.\n3. Discrepancy if any should be notified within 24 hours of receipt.', pageLeft + 10, totalsStartY + 64, {
      width: leftBoxWidth - 20,
      lineGap: 2
    });

  // Right Box: Financial Breakdown (Aligned flush with right edge of table!)
  const totals = [
    ['Taxable Amount', invoice.totals?.totalTaxable],
    ['Total Discount', invoice.totals?.totalDiscount],
    ['CGST', invoice.totals?.totalCGST],
    ['SGST', invoice.totals?.totalSGST],
    ['Round Off', (invoice.totals as any)?.roundOff],
    ['Grand Total', invoice.totals?.netTotal]
  ];

  let currentTotalsY = totalsStartY;
  const totalsRowH = 18;

  totals.forEach(([label, value]) => {
    const isNet = label === 'Grand Total';
    const isDisc = label === 'Total Discount';
    const isRound = label === 'Round Off';
    const numVal = Number(value) || 0;

    // Skip discount or roundoff if 0
    if (isDisc && numVal <= 0) return;
    if (isRound && numVal === 0) return;

    if (isNet) {
      doc.rect(totalsX, currentTotalsY, totalsWidth, 22)
         .fillAndStroke('#ecfdf5', '#0f766e');
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#0f766e');
      drawCell(doc, 'Net Amount Payable', totalsX, currentTotalsY, 135, 22, { align: 'left' });
      drawCell(doc, formatCurrency(numVal), totalsX + 135, currentTotalsY, totalsWidth - 135, 22, { align: 'right' });
      currentTotalsY += 22;
    } else {
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(isDisc ? '#dc2626' : '#0f172a');
      const formattedVal = isDisc
        ? `-₹${currency.format(numVal)}`
        : isRound
          ? (numVal >= 0 ? `+₹${currency.format(numVal)}` : `-₹${currency.format(Math.abs(numVal))}`)
          : formatCurrency(numVal);

      drawCell(doc, String(label), totalsX, currentTotalsY, 135, totalsRowH, { align: 'left' });
      drawCell(doc, formattedVal, totalsX + 135, currentTotalsY, totalsWidth - 135, totalsRowH, { align: 'right' });
      currentTotalsY += totalsRowH;
    }
  });

  // Signatory Box
  const signY = Math.max(totalsStartY + leftBoxHeight, currentTotalsY) + 10;
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('#334155')
    .text(`For ${safeText(distributor.firmName, 'Bharat Enterprises')}`, totalsX, signY, {
      width: totalsWidth,
      align: 'center'
    });

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#64748b')
    .text('Authorized Signatory', totalsX, signY + 28, {
      width: totalsWidth,
      align: 'center'
    });

  // Bottom Footer
  doc
    .moveTo(pageLeft, doc.page.height - 28)
    .lineTo(pageLeft + contentWidth, doc.page.height - 28)
    .stroke('#e2e8f0');

  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor('#94a3b8')
    .text(`Computer Generated Tax Invoice  |  Generated on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}  |  Powered by Bharat Enterprise`, pageLeft, doc.page.height - 22, {
      width: contentWidth,
      align: 'center'
    });
}


async function getDistributorByTenantId(invoice: IInvoice, tenantId: unknown): Promise<IDistributorSnapshot> {
  const admin = await Admin.findById(tenantId).lean() as any;
  
  const snap = invoice.distributor || {};
  
  return {
    firmName: snap.firmName || admin?.firmName,
    firmAddress: snap.firmAddress || admin?.firmAddress,
    firmPhone: admin?.firmPhone || snap.firmPhone,
    firmGSTIN: snap.firmGSTIN || admin?.firmGSTIN,
    firmDL: snap.firmDL || admin?.firmDL,
    paymentInformation: snap.paymentInformation?.enabled ? snap.paymentInformation : admin?.paymentInformation
  };
}

async function getDistributor(invoice: IInvoice, req: AuthenticatedRequest): Promise<IDistributorSnapshot> {
  const tenantId = getTenantId(req);
  return getDistributorByTenantId(invoice, tenantId);
}

exports.exportInvoices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const format = singleQueryValue(req.query.format as QueryValue).toLowerCase() || 'excel';
    const query = buildInvoiceQuery(req);

    if ('error' in query) {
      return res.status(400).json({ success: false, message: query.error });
    }

    const invoices = await Invoice.find(query).sort({ invoiceDate: -1 }).lean() as IInvoice[];

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No invoices found for export'
      });
    }

    // Fetch firm info for export headers
    const tenantId = getTenantId(req);
    const admin = await Admin.findById(tenantId).lean();
    const firmName = admin?.firmName || '';

    // Build date range label
    const startDateStr = singleQueryValue(req.query.startDate as QueryValue);
    const endDateStr = singleQueryValue(req.query.endDate as QueryValue);
    const dateRange = formatDateRange(startDateStr || undefined, endDateStr || undefined);

    const exportOptions = { firmName, dateRange };

    if (format === 'excel') {
      const buffer = await generateInvoiceExcel(invoices, exportOptions);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=invoices_${Date.now()}.xlsx`);
      return res.send(buffer);
    }

    if (format === 'csv') {
      const csvContent = generateInvoiceCSV(invoices);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=invoices_${Date.now()}.csv`);
      return res.send(csvContent);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoices_${Date.now()}.pdf`);

      const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: false });
      doc.on('error', next);
      doc.pipe(res);
      drawBulkInvoicePDF(doc, invoices, exportOptions);
      return doc.end();
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid export format. Supported: excel, csv, pdf'
    });
  } catch (error) {
    return next(error);
  }
};

exports.generateSingleInvoicePDF = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId }).lean() as IInvoice | null;

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const distributor = await getDistributor(invoice, req);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoiceNumber || req.params.id}.pdf`);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: false });
    doc.on('error', next);
    doc.pipe(res);
    drawSingleInvoicePDF(doc, invoice, distributor);
    return doc.end();
  } catch (error) {
    return next(error);
  }
};

exports.drawSingleInvoicePDF = drawSingleInvoicePDF;
exports.getDistributorByTenantId = getDistributorByTenantId;
