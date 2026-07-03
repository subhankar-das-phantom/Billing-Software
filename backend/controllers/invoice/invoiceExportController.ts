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

function drawSingleInvoicePDF(doc: PDFKit.PDFDocument, invoice: IInvoice, distributor: IDistributorSnapshot) {
  const pageLeft = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const isCancelled = invoice.status === 'Cancelled';

  doc.roundedRect(pageLeft, doc.y, contentWidth, 64, 6).fillAndStroke('#f8fafc', '#94a3b8');
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#0f172a')
    .text(safeText(distributor.firmName, 'Firm Name'), pageLeft + 14, doc.y + 11, { width: contentWidth - 28 });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#334155')
    .text(safeText(distributor.firmAddress, ''), pageLeft + 14, doc.y + 4, { width: contentWidth - 28 });
  let phoneGstinText = `Phone: ${safeText(distributor.firmPhone, '')}   GSTIN: ${safeText(distributor.firmGSTIN, '')}`;
  if (distributor.paymentInformation?.enabled) {
    const payInfo = `UPI: ${safeText(distributor.paymentInformation.upiId, '')} | A/C: ${safeText(distributor.paymentInformation.accountNumber, '')} | IFSC: ${safeText(distributor.paymentInformation.ifscCode, '')}`;
    phoneGstinText = `|  ${payInfo}  |  ${phoneGstinText}`;
  }

  doc.text(phoneGstinText, pageLeft + 14, doc.y + 3, { width: contentWidth - 28 });

  doc.y = 104;

  // Cancelled invoice: prominent red banner
  if (isCancelled) {
    doc.roundedRect(pageLeft, doc.y, contentWidth, 28, 4).fillAndStroke('#fef2f2', '#dc2626');
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#dc2626')
      .text('CANCELLED — This invoice has been cancelled and is excluded from financial totals', pageLeft + 10, doc.y + 8, {
        width: contentWidth - 20,
        align: 'center'
      });
    doc.y += 36;
  }

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('TAX INVOICE', { align: 'center' });
  doc.moveDown(0.7);

  const metaY = doc.y;
  const metaWidth = 230;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a');
  drawCell(doc, 'Invoice No.', pageLeft, metaY, 80, 22);
  drawCell(doc, safeText(invoice.invoiceNumber), pageLeft + 80, metaY, metaWidth - 80, 22);
  drawCell(doc, 'Invoice Date', pageLeft, metaY + 22, 80, 22);
  drawCell(doc, formatDate(invoice.invoiceDate), pageLeft + 80, metaY + 22, metaWidth - 80, 22);
  drawCell(doc, 'Payment', pageLeft, metaY + 44, 80, 22);
  drawCell(doc, safeText(invoice.paymentType, 'Credit'), pageLeft + 80, metaY + 44, metaWidth - 80, 22);

  const customerX = pageLeft + metaWidth + 18;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#0f172a')
    .text('Customer Details', customerX, metaY, { width: contentWidth - metaWidth - 18 });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#334155')
    .text(safeText(invoice.customer?.customerName), customerX, metaY + 16, { width: contentWidth - metaWidth - 18 })
    .text(safeText(invoice.customer?.address, ''), { width: contentWidth - metaWidth - 18 })
    .text(`Phone: ${safeText(invoice.customer?.phone, '')}`, { width: contentWidth - metaWidth - 18 })
    .text(`GSTIN: ${safeText(invoice.customer?.gstin, '')}   DL No: ${safeText(invoice.customer?.dlNo, '')}`, {
      width: contentWidth - metaWidth - 18
    });

  doc.y = metaY + 82;

  const columns = [
    { label: 'Sr.', width: 25, align: 'right' as const },
    { label: 'Product', width: 150, align: 'left' as const },
    { label: 'HSN', width: 50, align: 'left' as const },
    { label: 'Pack', width: 44, align: 'left' as const },
    { label: 'Qty', width: 35, align: 'right' as const },
    { label: 'Free', width: 35, align: 'right' as const },
    { label: 'Rate', width: 55, align: 'right' as const },
    { label: 'Disc%', width: 45, align: 'right' as const },
    { label: 'Taxable', width: 65, align: 'right' as const },
    { label: 'CGST', width: 55, align: 'right' as const },
    { label: 'SGST', width: 55, align: 'right' as const },
    { label: 'Total', width: 65, align: 'right' as const }
  ];

  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const drawHeader = () => {
    const y = doc.y;
    doc.rect(pageLeft, y, tableWidth, 22).fill('#0f766e');
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff');
    let x = pageLeft;
    columns.forEach((col) => {
      doc.text(col.label, x + 3, y + 7, { width: col.width - 6, align: col.align });
      x += col.width;
    });
    doc.y = y + 22;
  };

  drawHeader();
  invoice.items.forEach((item, index) => {
    ensureSpace(doc, 28, drawHeader);
    const y = doc.y;
    if (index % 2 === 0) doc.rect(pageLeft, y, tableWidth, 28).fill('#f8fafc');
    doc.font('Helvetica').fontSize(7).fillColor('#0f172a');
    const row = [
      String(index + 1),
      safeText(item.product?.productName),
      safeText(item.product?.hsnCode, ''),
      safeText(item.product?.pack, ''),
      String(item.quantitySold || 0),
      String(item.freeQuantity || 0),
      currency.format(item.ratePerUnit || 0),
      currency.format(item.schemeDiscount || 0),
      currency.format(item.taxableAmount || 0),
      currency.format(item.cgstAmount || 0),
      currency.format(item.sgstAmount || 0),
      currency.format(item.totalAmount || 0)
    ];

    let x = pageLeft;
    columns.forEach((col, colIndex) => {
      drawCell(doc, row[colIndex], x, y, col.width, 28, { align: col.align });
      x += col.width;
    });
    doc.y = y + 28;
  });

  ensureSpace(doc, 132);
  doc.moveDown(0.8);

  const totalsX = pageLeft + contentWidth - 250;
  const totals = [
    ['Base Amount', invoice.totals?.baseAmount],
    ['Discount', invoice.totals?.totalDiscount],
    ['Taxable', invoice.totals?.totalTaxable],
    ['CGST', invoice.totals?.totalCGST],
    ['SGST', invoice.totals?.totalSGST],
    ['Net Total', invoice.totals?.netTotal]
  ];
  const totalsStartY = doc.y;

  totals.forEach(([label, value], index) => {
    const y = totalsStartY + index * 20;
    const isNet = label === 'Net Total';
    doc
      .font(isNet ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isNet ? 10 : 8)
      .fillColor('#0f172a');
    if (isNet) doc.rect(totalsX, y, 250, 20).fillAndStroke('#ecfdf5', '#0f766e').fillColor('#0f172a');
    drawCell(doc, String(label), totalsX, y, 120, 20);
    drawCell(doc, formatCurrency(Number(value) || 0), totalsX + 120, y, 130, 20, { align: 'right' });
  });

  const wordsY = totalsStartY;
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#0f172a')
    .text('Amount in words:', pageLeft, wordsY, { width: 120 });
  doc
    .font('Helvetica')
    .fontSize(8)
    .text(formatAmountInWords(invoice), pageLeft + 100, wordsY, {
      width: contentWidth - 370
    });

  doc.y = Math.max(doc.y + 28, totalsStartY + totals.length * 20 + 12);

  ensureSpace(doc, 34);
  doc
    .moveTo(pageLeft, doc.page.height - 46)
    .lineTo(pageLeft + contentWidth, doc.page.height - 46)
    .stroke('#cbd5e1')
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text(`Computer Generated Invoice | ${formatDateTime()}`, pageLeft, doc.page.height - 36, {
      width: contentWidth,
      align: 'center'
    });
}

async function getDistributor(invoice: IInvoice, req: AuthenticatedRequest): Promise<IDistributorSnapshot> {
  if (invoice.distributor?.firmName) return invoice.distributor;

  const tenantId = getTenantId(req);
  const admin = await Admin.findById(tenantId).lean();
  return {
    firmName: admin?.firmName,
    firmAddress: admin?.firmAddress,
    firmPhone: admin?.firmPhone,
    firmGSTIN: admin?.firmGSTIN,
    paymentInformation: admin?.paymentInformation
  };
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
