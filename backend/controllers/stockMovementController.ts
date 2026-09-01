import { Request, Response, NextFunction } from 'express';
import { stockMovementService } from '../services/stockMovementService';
const Admin = require('../models/Admin');
import getTenantId from '../utils/getTenantId';
import { ExportDefinition, ExportColumn } from '../utils/export/types';
import { buildWorkbook } from '../utils/export/excel';
import { buildCSV } from '../utils/export/csv';
import { buildPDF } from '../utils/export/pdf';
import { sanitizeFilename } from '../utils/export/helpers';

interface AuthRequest extends Request {
  user?: any;
  admin?: any;
  userRole?: string;
  userModel?: string;
}

interface StockMovementExportRow {
  dateTime: Date | string;
  type: string;
  productName: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  rate: number;
  totalValue: number;
  operator: string;
  referenceType: string;
}

export const getStockMovements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      res.status(401).json({ success: false, message: 'Not authorized - no tenant context' });
      return;
    }

    const {
      productId,
      batchId,
      batchNo,
      type,
      referenceType,
      referenceId,
      dateFrom,
      dateTo,
      page = '1',
      limit = '20'
    } = req.query;

    const parsedPage = parseInt(page as string, 10) || 1;
    const parsedLimit = parseInt(limit as string, 10) || 20;

    // Cap limit to prevent massive queries
    const safeLimit = Math.min(parsedLimit, 100);

    const result = await stockMovementService.getStockMovements(
      tenantId,
      {
        productId: productId as string,
        batchId: (batchId || batchNo) as string,
        batchNo: (batchNo || batchId) as string,
        type: type as string,
        referenceType: referenceType as string,
        referenceId: referenceId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      },
      parsedPage,
      safeLimit
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error: any) {
    console.error('Get stock movements error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching stock movements'
    });
  }
};

export const exportStockMovements = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      res.status(401).json({ success: false, message: 'Not authorized - no tenant context' });
      return;
    }

    const format = (req.query.format as string || 'excel').toLowerCase();
    const { productId, batchId, batchNo, type, referenceType, dateFrom, dateTo } = req.query;

    // Fetch up to 50,000 matching movements
    const result = await stockMovementService.getStockMovements(
      tenantId,
      {
        productId: productId as string,
        batchId: (batchId || batchNo) as string,
        batchNo: (batchNo || batchId) as string,
        type: type as string,
        referenceType: referenceType as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      },
      1,
      50000
    );

    const movements = result.data || [];
    if (movements.length === 0) {
      res.status(404).json({ success: false, message: 'No stock movements found matching criteria for export' });
      return;
    }

    const admin = await Admin.findById(tenantId).lean();
    const firmName = admin?.firmName || 'Bharat Enterprise';

    let generatedBy = 'System User';
    if (req.user) {
      generatedBy = req.user.name || req.user.employeeName || req.user.adminName || req.user.username || 'User';
    }

    const typeLabels: Record<string, string> = {
      PURCHASE: 'Purchase In',
      PURCHASE_RETURN: 'Purchase Return',
      SALE: 'Sale Out',
      SALE_RETURN: 'Sale Return',
      SALE_REVERSAL: 'Sale Reversal',
      OPENING_STOCK: 'Opening Stock',
      MANUAL_ADJUSTMENT_IN: 'Adjustment In',
      MANUAL_ADJUSTMENT_OUT: 'Adjustment Out'
    };

    // 1. Map Data Rows
    const dataRows: StockMovementExportRow[] = movements.map((m: any) => {
      const batchNoStr = m.batch?.batchNo || m.batchNumber;
      const displayBatch = batchNoStr && batchNoStr !== 'UNNAMED' ? batchNoStr : '-';
      const expiryDate = m.batch?.expiryDate
        ? new Date(m.batch.expiryDate).toLocaleDateString('en-IN')
        : '-';

      return {
        dateTime: m.createdAt ? new Date(m.createdAt) : '',
        type: typeLabels[m.type] || m.type || 'Movement',
        productName: m.product?.productName || m.productName || 'General Product',
        batchNo: displayBatch,
        expiryDate,
        quantity: m.quantity || 0,
        rate: m.rate || 0,
        totalValue: m.totalValue || Math.abs((m.quantity || 0) * (m.rate || 0)),
        operator: m.createdBy?.name || 'System',
        referenceType: m.referenceType || '-'
      };
    });

    // 2. Metrics Calculation
    let totalInflowUnits = 0;
    let totalOutflowUnits = 0;
    let totalTurnoverVal = 0;
    const uniqueProducts = new Set<string>();
    const uniqueBatches = new Set<string>();

    dataRows.forEach(r => {
      if (r.quantity > 0) totalInflowUnits += r.quantity;
      else totalOutflowUnits += Math.abs(r.quantity);

      totalTurnoverVal += r.totalValue;
      if (r.productName) uniqueProducts.add(r.productName);
      if (r.batchNo && r.batchNo !== '-') uniqueBatches.add(r.batchNo);
    });

    // 3. Define Export Columns
    const columns: ExportColumn<StockMovementExportRow>[] = [
      { key: 'dateTime', header: 'Date & Time', width: 22, align: 'center', format: 'datetime' },
      { key: 'type', header: 'Movement Type', width: 18, align: 'center' },
      { key: 'productName', header: 'Product Name', width: 28 },
      { key: 'batchNo', header: 'Batch #', width: 16, align: 'center' },
      { key: 'expiryDate', header: 'Expiry Date', width: 14, align: 'center' },
      { key: 'quantity', header: 'Qty Change', width: 14, align: 'center', format: 'number' },
      { key: 'rate', header: 'Unit Rate', width: 14, format: 'currency' },
      { key: 'totalValue', header: 'Total Value', width: 16, format: 'currency' },
      { key: 'operator', header: 'Operator', width: 16, align: 'center' }
    ];

    const filters: Record<string, string> = {};
    if (type) filters['Movement Type'] = String(type);
    if (batchId || batchNo) filters['Batch'] = String(batchId || batchNo);
    if (dateFrom) filters['From Date'] = String(dateFrom);
    if (dateTo) filters['To Date'] = String(dateTo);

    let baseFilename = 'Inventory_Ledger';
    if (type) baseFilename += `_${type}`;
    const dateStr = new Date().toISOString().split('T')[0];
    baseFilename += `_${dateStr}`;
    const filename = sanitizeFilename(baseFilename);

    const exportDefinition: ExportDefinition<StockMovementExportRow> = {
      title: 'Inventory Movement Ledger Report',
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
        { label: 'Total Movement Records', value: dataRows.length, format: 'number' },
        { label: 'Total Stock Inflow Units (+)', value: totalInflowUnits, format: 'number' },
        { label: 'Total Stock Outflow Units (-)', value: totalOutflowUnits, format: 'number' },
        { label: 'Total Transaction Valuation', value: totalTurnoverVal, format: 'currency' },
        { label: 'Unique Products Involved', value: uniqueProducts.size, format: 'number' },
        { label: 'Unique Batches Involved', value: uniqueBatches.size, format: 'number' }
      ]
    };

    // 4. Dispatch to Export Engine
    if (format === 'excel') {
      const buffer = await buildWorkbook(exportDefinition);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
      return;
    } else if (format === 'csv') {
      const csvData = buildCSV(exportDefinition);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvData);
      return;
    } else if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      buildPDF(exportDefinition, res);
      return;
    }

    res.status(400).json({
      success: false,
      message: 'Invalid export format. Supported: excel, csv, pdf'
    });
  } catch (error) {
    next(error);
  }
};
