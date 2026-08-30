import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
import Purchase, { IPurchase } from '../models/Purchase';
const Admin = require('../models/Admin');

interface AuthenticatedRequest extends Request {
  user?: any;
  admin?: any;
}

const currency = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatCurrency = (value?: number) => `₹${currency.format(Number(value) || 0)}`;

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

const formatDateRange = (startDate?: string, endDate?: string) => {
  if (startDate && endDate) return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  if (startDate) return `From ${formatDate(startDate)}`;
  if (endDate) return `Until ${formatDate(endDate)}`;
  return 'All Time';
};

const generatePurchaseExcel = async (purchases: any[], options: { firmName?: string; dateRange?: string } = {}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bharat Enterprise Billing System';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Purchases', {
    properties: { tabColor: { argb: 'FF2563EB' } }
  });

  let headerRowsCount = 0;

  if (options.firmName) {
    sheet.mergeCells('A1:J1');
    const firmCell = sheet.getCell('A1');
    firmCell.value = options.firmName;
    firmCell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
    firmCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;
    headerRowsCount = 1;
  }

  if (options.dateRange) {
    const dateRowNum = headerRowsCount + 1;
    sheet.mergeCells(`A${dateRowNum}:J${dateRowNum}`);
    const dateCell = sheet.getCell(`A${dateRowNum}`);
    dateCell.value = `Purchase Report Period: ${options.dateRange}`;
    dateCell.font = { size: 10, color: { argb: 'FF475569' }, italic: true };
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(dateRowNum).height = 20;
    headerRowsCount = dateRowNum;
  }

  if (headerRowsCount > 0) {
    headerRowsCount += 1;
    sheet.getRow(headerRowsCount).height = 8;
  }

  sheet.columns = [
    { key: 'purchaseNumber', width: 16 },
    { key: 'purchaseDate', width: 14 },
    { key: 'supplierName', width: 26 },
    { key: 'supplierGstin', width: 18 },
    { key: 'billNumber', width: 16 },
    { key: 'itemCount', width: 10 },
    { key: 'subtotal', width: 14 },
    { key: 'taxable', width: 14 },
    { key: 'totalGst', width: 12 },
    { key: 'grandTotal', width: 16 },
    { key: 'paymentType', width: 14 },
    { key: 'status', width: 14 }
  ];

  const columnHeaderRowNum = headerRowsCount + 1;
  const columnHeaders = [
    'Purchase #', 'Date', 'Supplier Name', 'Supplier GSTIN', 'Bill / Inv #',
    'Items', 'Subtotal', 'Taxable', 'GST Amount', 'Grand Total (₹)', 'Payment', 'Status'
  ];
  const headerRow = sheet.getRow(columnHeaderRowNum);
  columnHeaders.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' } // Blue-800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: columnHeaderRowNum }];

  let grandTotalSum = 0;
  let taxableSum = 0;
  let gstSum = 0;

  purchases.forEach((p, index) => {
    const isCancelled = p.status === 'CANCELLED';
    const rowNum = columnHeaderRowNum + 1 + index;
    const row = sheet.getRow(rowNum);

    const subtotal = p.totals?.subtotal || 0;
    const taxable = p.totals?.totalTaxable || 0;
    const totalGst = p.totals?.totalGST || 0;
    const grandTotal = p.totals?.grandTotal || 0;

    if (!isCancelled) {
      taxableSum += taxable;
      gstSum += totalGst;
      grandTotalSum += grandTotal;
    }

    row.getCell(1).value = p.purchaseNumber || '';
    row.getCell(2).value = formatDate(p.purchaseDate);
    row.getCell(3).value = p.supplierId?.name || 'Unknown Supplier';
    row.getCell(4).value = p.supplierId?.gstin || '';
    row.getCell(5).value = p.supplierInvoiceNumber || '';
    row.getCell(6).value = p.items?.length || 0;
    row.getCell(7).value = subtotal;
    row.getCell(8).value = taxable;
    row.getCell(9).value = totalGst;
    row.getCell(10).value = grandTotal;
    row.getCell(11).value = p.paymentType || 'Credit';
    row.getCell(12).value = p.status || 'COMPLETED';

    // Formatting numbers
    [7, 8, 9, 10].forEach(col => {
      row.getCell(col).numFmt = '₹#,##0.00';
      row.getCell(col).alignment = { horizontal: 'right' };
    });

    [1, 2, 5, 6, 11, 12].forEach(col => {
      row.getCell(col).alignment = { horizontal: 'center' };
    });

    if (isCancelled) {
      row.font = { color: { argb: 'FFEF4444' }, italic: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    } else if (index % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }

    row.height = 20;
  });

  // Totals Row
  const totalRowNum = columnHeaderRowNum + 1 + purchases.length;
  const totalRow = sheet.getRow(totalRowNum);
  sheet.mergeCells(`A${totalRowNum}:G${totalRowNum}`);
  totalRow.getCell(1).value = 'TOTAL (Excl. Cancelled)';
  totalRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
  totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(8).value = taxableSum;
  totalRow.getCell(8).numFmt = '₹#,##0.00';
  totalRow.getCell(9).value = gstSum;
  totalRow.getCell(9).numFmt = '₹#,##0.00';
  totalRow.getCell(10).value = grandTotalSum;
  totalRow.getCell(10).numFmt = '₹#,##0.00';
  totalRow.getCell(10).font = { bold: true, size: 11, color: { argb: 'FF059669' } };

  totalRow.height = 24;
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

  return workbook.xlsx.writeBuffer();
};

const generatePurchaseCSV = (purchases: any[]) => {
  const headers = [
    'Purchase Number',
    'Purchase Date',
    'Supplier Name',
    'Supplier GSTIN',
    'Supplier Phone',
    'Supplier Bill Number',
    'Items Count',
    'Subtotal',
    'Taxable Amount',
    'GST Amount',
    'Grand Total',
    'Payment Mode',
    'Status'
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = purchases.map(p => [
    escapeCSV(p.purchaseNumber),
    escapeCSV(formatDate(p.purchaseDate)),
    escapeCSV(p.supplierId?.name || 'Unknown Supplier'),
    escapeCSV(p.supplierId?.gstin || ''),
    escapeCSV(p.supplierId?.phone || ''),
    escapeCSV(p.supplierInvoiceNumber || ''),
    p.items?.length || 0,
    (p.totals?.subtotal || 0).toFixed(2),
    (p.totals?.totalTaxable || 0).toFixed(2),
    (p.totals?.totalGST || 0).toFixed(2),
    (p.totals?.grandTotal || 0).toFixed(2),
    escapeCSV(p.paymentType || 'Credit'),
    escapeCSV(p.status || 'COMPLETED')
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

const drawBulkPurchasePDF = (doc: any, purchases: any[], options: { firmName?: string; dateRange?: string } = {}) => {
  const pageLeft = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Header banner
  doc.rect(pageLeft, doc.y, contentWidth, 54).fill('#1e3a8a');
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff').text(options.firmName || 'Bharat Enterprise Billing', pageLeft + 14, doc.y + 12, { width: contentWidth - 28 });
  doc.font('Helvetica').fontSize(9).fillColor('#bfdbfe').text(`Purchase Statement • ${options.dateRange || 'All Time'}`, pageLeft + 14, doc.y + 2, { width: contentWidth - 28 });
  doc.y += 28;

  const columns = [
    { label: 'Purchase #', width: 90, align: 'left' },
    { label: 'Date', width: 70, align: 'center' },
    { label: 'Supplier', width: 140, align: 'left' },
    { label: 'Bill No', width: 75, align: 'left' },
    { label: 'Items', width: 40, align: 'center' },
    { label: 'Payment', width: 65, align: 'center' },
    { label: 'Status', width: 65, align: 'center' },
    { label: 'Total (₹)', width: 85, align: 'right' }
  ];

  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

  const drawHeader = () => {
    let x = pageLeft;
    const y = doc.y;
    doc.rect(pageLeft, y, tableWidth, 20).fill('#1e40af');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    columns.forEach((col) => {
      doc.text(col.label, x + 3, y + 6, { width: col.width - 6, align: col.align });
      x += col.width;
    });
    doc.y = y + 20;
  };

  drawHeader();

  let totalSpend = 0;

  purchases.forEach((p, index) => {
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
      drawHeader();
    }

    const isCancelled = p.status === 'CANCELLED';
    const y = doc.y;

    if (isCancelled) {
      doc.rect(pageLeft, y, tableWidth, 20).fill('#fee2e2');
    } else if (index % 2 === 0) {
      doc.rect(pageLeft, y, tableWidth, 20).fill('#f8fafc');
    }

    if (!isCancelled) {
      totalSpend += (p.totals?.grandTotal || 0);
    }

    doc.font('Helvetica').fontSize(8).fillColor(isCancelled ? '#dc2626' : '#0f172a');
    let x = pageLeft;
    const row = [
      p.purchaseNumber || '',
      formatDate(p.purchaseDate),
      p.supplierId?.name || 'Unknown Supplier',
      p.supplierInvoiceNumber || '-',
      String(p.items?.length || 0),
      p.paymentType || 'Credit',
      p.status || 'COMPLETED',
      formatCurrency(p.totals?.grandTotal)
    ];

    columns.forEach((col, colIndex) => {
      doc.text(row[colIndex], x + 3, y + 5, { width: col.width - 6, align: col.align });
      x += col.width;
    });

    doc.y = y + 20;
  });

  // Summary Row
  if (doc.y > doc.page.height - 50) {
    doc.addPage();
  }
  doc.rect(pageLeft, doc.y, tableWidth, 22).fill('#e2e8f0');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a');
  doc.text('TOTAL EXPENDITURE (Active Purchases):', pageLeft + 10, doc.y + 6, { width: tableWidth - 110, align: 'right' });
  doc.fillColor('#059669').text(formatCurrency(totalSpend), pageLeft + tableWidth - 95, doc.y + 6, { width: 90, align: 'right' });
};

export const exportPurchases = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id;
    const format = (req.query.format as string || 'excel').toLowerCase();
    const { startDate, endDate, status, supplierId } = req.query;

    const query: any = { tenantId };

    if (status && status !== 'all') {
      query.status = status;
    }
    if (supplierId) {
      query.supplierId = supplierId;
    }
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = end;
      }
    }

    const purchases = await Purchase.find(query)
      .populate('supplierId', 'name gstin phone address')
      .sort({ purchaseDate: -1, createdAt: -1 })
      .lean();

    if (purchases.length === 0) {
      return res.status(404).json({ success: false, message: 'No purchases found for export' });
    }

    const admin = await Admin.findById(tenantId).lean();
    const firmName = admin?.firmName || 'Bharat Enterprise';
    const dateRange = formatDateRange(startDate as string, endDate as string);
    const exportOptions = { firmName, dateRange };

    if (format === 'excel') {
      const buffer = await generatePurchaseExcel(purchases, exportOptions);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=purchases_export_${Date.now()}.xlsx`);
      return res.send(buffer);
    }

    if (format === 'csv') {
      const csvContent = generatePurchaseCSV(purchases);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=purchases_export_${Date.now()}.csv`);
      return res.send(csvContent);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=purchases_export_${Date.now()}.pdf`);

      const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: false });
      doc.on('error', next);
      doc.pipe(res);
      drawBulkPurchasePDF(doc, purchases, exportOptions);
      return doc.end();
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid export format. Supported: excel, csv, pdf'
    });
  } catch (error: any) {
    console.error('Export Purchases Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error exporting purchases'
    });
  }
};
