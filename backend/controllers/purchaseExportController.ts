import type { Request, Response, NextFunction } from 'express';
import Purchase from '../models/Purchase';
const Admin = require('../models/Admin');
const getTenantId = require('../utils/getTenantId');
import { ExportDefinition, ExportColumn } from '../utils/export/types';
import { buildWorkbook } from '../utils/export/excel';
import { buildCSV } from '../utils/export/csv';
import { buildPDF } from '../utils/export/pdf';
import { sanitizeFilename } from '../utils/export/helpers';

interface AuthenticatedRequest extends Request {
  user?: any;
  admin?: any;
}

interface PurchaseExportRow {
  purchaseNumber: string;
  purchaseDate: Date | string;
  supplierName: string;
  supplierGstin: string;
  supplierInvoiceNumber: string;
  itemCount: number;
  subtotal: number;
  totalTaxable: number;
  totalGST: number;
  grandTotal: number;
  paymentType: string;
  status: string;
}

export const exportPurchases = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
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

    if (!purchases || purchases.length === 0) {
      return res.status(404).json({ success: false, message: 'No purchases found for export matching the criteria' });
    }

    if (purchases.length > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Export exceeds the maximum supported size of 50,000 rows. Please apply additional filters.'
      });
    }

    const admin = await Admin.findById(tenantId).lean();
    const firmName = admin?.firmName || 'Bharat Enterprise';

    let generatedBy = 'System User';
    if (req.user) {
      generatedBy = req.user.name || req.user.employeeName || req.user.adminName || req.user.username || 'User';
    }

    // 1. Data Mapping
    const dataRows: PurchaseExportRow[] = purchases.map((p: any) => ({
      purchaseNumber: p.purchaseNumber || '',
      purchaseDate: p.purchaseDate ? new Date(p.purchaseDate) : '',
      supplierName: p.supplierId?.name || 'Unknown Supplier',
      supplierGstin: p.supplierId?.gstin || '-',
      supplierInvoiceNumber: p.supplierInvoiceNumber || '-',
      itemCount: p.items?.length || 0,
      subtotal: p.totals?.subtotal || 0,
      totalTaxable: p.totals?.totalTaxable || 0,
      totalGST: p.totals?.totalGST || 0,
      grandTotal: p.totals?.grandTotal || 0,
      paymentType: p.paymentType || 'Credit',
      status: p.status || 'COMPLETED'
    }));

    // 2. Metrics calculation
    let completedCount = 0;
    let cancelledCount = 0;
    let draftCount = 0;
    let totalExpenditure = 0;
    let totalTaxableAmount = 0;
    let totalGstAmount = 0;
    const uniqueSuppliers = new Set<string>();

    purchases.forEach((p: any) => {
      if (p.status === 'CANCELLED') {
        cancelledCount++;
      } else {
        if (p.status === 'DRAFT') draftCount++;
        else completedCount++;

        totalExpenditure += p.totals?.grandTotal || 0;
        totalTaxableAmount += p.totals?.totalTaxable || 0;
        totalGstAmount += p.totals?.totalGST || 0;
      }
      if (p.supplierId?.name) uniqueSuppliers.add(p.supplierId.name);
    });

    // 3. Define Export Columns
    const columns: ExportColumn<PurchaseExportRow>[] = [
      { key: 'purchaseNumber', header: 'Purchase #', width: 18, align: 'center' },
      { key: 'purchaseDate', header: 'Date', width: 15, align: 'center', format: 'date' },
      { key: 'supplierName', header: 'Supplier Name', width: 28 },
      { key: 'supplierGstin', header: 'GSTIN', width: 18, align: 'center' },
      { key: 'supplierInvoiceNumber', header: 'Bill / Inv #', width: 16, align: 'center' },
      { key: 'itemCount', header: 'Items', width: 10, align: 'center', format: 'number' },
      { key: 'subtotal', header: 'Subtotal', width: 15, format: 'currency' },
      { key: 'totalTaxable', header: 'Taxable Amt', width: 15, format: 'currency' },
      { key: 'totalGST', header: 'GST Amt', width: 15, format: 'currency' },
      { key: 'grandTotal', header: 'Grand Total', width: 16, format: 'currency' },
      { key: 'paymentType', header: 'Payment', width: 14, align: 'center' },
      { key: 'status', header: 'Status', width: 14, align: 'center' }
    ];

    const filters: Record<string, string> = {};
    if (status && status !== 'all') filters['Status'] = String(status);
    if (startDate) filters['Start Date'] = String(startDate);
    if (endDate) filters['End Date'] = String(endDate);

    let baseFilename = 'Purchases';
    if (status && status !== 'all') baseFilename += `_${status}`;
    const dateStr = new Date().toISOString().split('T')[0];
    baseFilename += `_${dateStr}`;
    const filename = sanitizeFilename(baseFilename);

    const exportDefinition: ExportDefinition<PurchaseExportRow> = {
      title: 'Purchase Orders Report',
      filename,
      columns,
      dataRows,
      metadata: {
        firmName,
        generatedBy,
        generatedAt: new Date(),
        filters
      },
      summary: [
        { label: 'Total Purchases', value: purchases.length, format: 'number' },
        { label: 'Completed Purchases', value: completedCount, format: 'number' },
        { label: 'Draft Purchases', value: draftCount, format: 'number' },
        { label: 'Cancelled Purchases', value: cancelledCount, format: 'number' },
        { label: 'Total Expenditure (Active)', value: totalExpenditure, format: 'currency' },
        { label: 'Total Taxable Amount (Active)', value: totalTaxableAmount, format: 'currency' },
        { label: 'Total GST Paid (Active)', value: totalGstAmount, format: 'currency' },
        { label: 'Unique Suppliers', value: uniqueSuppliers.size, format: 'number' }
      ]
    };

    // 4. Dispatch to Engine
    if (format === 'excel') {
      const buffer = await buildWorkbook(exportDefinition);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(buffer);
    } else if (format === 'csv') {
      const csvData = buildCSV(exportDefinition);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csvData);
    } else if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return buildPDF(exportDefinition, res);
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid export format. Supported: excel, csv, pdf'
    });
  } catch (error) {
    next(error);
  }
};
