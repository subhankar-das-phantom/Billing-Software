import type { Request, Response, NextFunction } from 'express';
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const ManualEntry = require('../models/ManualEntry');
const Customer = require('../models/Customer');
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

interface CollectionExportRow {
  paymentDate: Date | string;
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  paymentMethod: string;
  referenceNumber: string;
  amount: number;
  recordedByName: string;
  notes: string;
}

const round2 = (n: number) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

const parseISTDateBoundary = (dateInput?: any, endOfDay = false): Date | null => {
  if (!dateInput) return null;
  const raw = String(dateInput).trim();
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

const escapeRegex = (string: string) => {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const CANONICAL_PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT/RTGS'];

const MAX_EXPORT_RECORDS = 5000;
const MAX_EXPORT_DAYS = 365;

export const exportCollections = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const format = ((req.query.format as string) || 'excel').toLowerCase();
    const { date, startDate, endDate, paymentMethod, customerId, search } = req.query as Record<string, string | undefined>;

    // 1. Parse IST date range
    let startBoundary: Date | null = null;
    let endBoundary: Date | null = null;

    if (date) {
      startBoundary = parseISTDateBoundary(date, false);
      endBoundary = parseISTDateBoundary(date, true);
    } else if (startDate || endDate) {
      if (startDate) startBoundary = parseISTDateBoundary(startDate, false);
      if (endDate) endBoundary = parseISTDateBoundary(endDate, true);
    } else {
      const istTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      startBoundary = parseISTDateBoundary(istTodayStr, false);
      endBoundary = parseISTDateBoundary(istTodayStr, true);
    }

    // Date span guard (365 days max)
    if (startBoundary && endBoundary) {
      const diffDays = Math.ceil((endBoundary.getTime() - startBoundary.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > MAX_EXPORT_DAYS) {
        return res.status(400).json({
          success: false,
          message: `Export limit exceeded. Please narrow the date range or apply filters. Maximum export size: ${MAX_EXPORT_RECORDS} records / ${MAX_EXPORT_DAYS} days.`
        });
      }
    }

    // 2. Build query predicates
    const paymentQuery: any = { tenantId };
    const meQuery: any = {
      tenantId,
      entryType: { $in: ['payment_adjustment', 'credit_adjustment'] }
    };

    if (startBoundary || endBoundary) {
      paymentQuery.paymentDate = {};
      meQuery.entryDate = {};
      if (startBoundary) {
        paymentQuery.paymentDate.$gte = startBoundary;
        meQuery.entryDate.$gte = startBoundary;
      }
      if (endBoundary) {
        paymentQuery.paymentDate.$lte = endBoundary;
        meQuery.entryDate.$lte = endBoundary;
      }
    }

    if (paymentMethod && CANONICAL_PAYMENT_METHODS.includes(paymentMethod)) {
      paymentQuery.paymentMethod = paymentMethod;
      meQuery.paymentMethod = paymentMethod;
    }

    if (customerId) {
      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        return res.status(400).json({ success: false, message: 'Invalid customerId' });
      }
      const cId = new mongoose.Types.ObjectId(customerId);
      paymentQuery.customer = cId;
      meQuery.customer = cId;
    }

    const rawSearch = String(search || '').trim().slice(0, 50);
    if (rawSearch.length >= 2) {
      const escaped = escapeRegex(rawSearch);
      const prefixPattern = new RegExp(`^${escaped}`, 'i');
      const containsPattern = new RegExp(escaped, 'i');

      const matchingCustomers = await Customer.find({
        tenantId,
        $or: [{ customerName: prefixPattern }, { phone: prefixPattern }]
      }).select('_id').limit(50).lean();

      const matchingIds = matchingCustomers.map((c: any) => c._id);

      const paymentOr: any[] = [
        { referenceNumber: containsPattern },
        { notes: containsPattern },
        { 'invoiceSnapshot.invoiceNumber': prefixPattern }
      ];
      if (matchingIds.length > 0) {
        paymentOr.push({ customer: { $in: matchingIds } });
      }

      const meOr: any[] = [
        { referenceNumber: containsPattern },
        { description: containsPattern },
        { notes: containsPattern }
      ];
      if (matchingIds.length > 0) {
        meOr.push({ customer: { $in: matchingIds } });
      }

      paymentQuery.$and = paymentQuery.$and || [];
      paymentQuery.$and.push({ $or: paymentOr });

      meQuery.$and = meQuery.$and || [];
      meQuery.$and.push({ $or: meOr });
    }

    // 3. Count before full retrieval to enforce the 5,000 record hard ceiling
    const [payCount, meCount] = await Promise.all([
      Payment.countDocuments(paymentQuery),
      ManualEntry.countDocuments(meQuery)
    ]);

    const totalMatching = payCount + meCount;
    if (totalMatching > MAX_EXPORT_RECORDS) {
      return res.status(400).json({
        success: false,
        message: `Export limit exceeded. Please narrow the date range or apply filters. Maximum export size: ${MAX_EXPORT_RECORDS} records / ${MAX_EXPORT_DAYS} days. Total matching: ${totalMatching}.`
      });
    }

    // 4. Fetch bounded records
    const [payments, manualEntries, admin] = await Promise.all([
      Payment.find(paymentQuery)
        .populate('customer', 'customerName phone')
        .populate('invoice', 'invoiceNumber totals.netTotal')
        .populate('createdBy.user', 'name email')
        .sort({ paymentDate: -1, createdAt: -1, _id: -1 })
        .lean(),
      ManualEntry.find(meQuery)
        .populate('customer', 'customerName phone')
        .populate('createdBy.user', 'name email')
        .sort({ entryDate: -1, createdAt: -1, _id: -1 })
        .lean(),
      Admin.findById(tenantId).select('firmName name').lean()
    ]);

    // 5. Normalize records for Export
    const dataRows: CollectionExportRow[] = [];
    let cashCollected = 0;
    let nonCashCollected = 0;

    const hasExplicitTime = (dateValue?: any): boolean => {
      if (!dateValue) return false;
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return false;
      return (
        d.getUTCHours() !== 0 ||
        d.getUTCMinutes() !== 0 ||
        d.getUTCSeconds() !== 0 ||
        d.getUTCMilliseconds() !== 0
      );
    };

    const getEffectiveDateTime = (primaryDate: any, fallbackCreatedAt: any): Date => {
      const pDate = primaryDate ? new Date(primaryDate) : null;
      const cDate = fallbackCreatedAt ? new Date(fallbackCreatedAt) : null;

      if (pDate && hasExplicitTime(pDate)) return pDate;
      if (cDate && !Number.isNaN(cDate.getTime())) return cDate;
      if (pDate && !Number.isNaN(pDate.getTime())) return pDate;
      return new Date();
    };

    for (const p of payments) {
      const amount = round2(p.amount);
      const method = p.paymentMethod || 'Cash';
      if (method === 'Cash') {
        cashCollected = round2(cashCollected + amount);
      } else {
        nonCashCollected = round2(nonCashCollected + amount);
      }

      dataRows.push({
        paymentDate: getEffectiveDateTime(p.paymentDate, p.createdAt),
        customerName: p.customer?.customerName || 'Unknown',
        customerPhone: p.customer?.phone || '',
        invoiceNumber: p.invoice?.invoiceNumber || p.invoiceSnapshot?.invoiceNumber || '-',
        paymentMethod: method,
        referenceNumber: p.referenceNumber ? String(p.referenceNumber).trim() : '',
        amount,
        recordedByName: p.createdBy?.user?.name || 'Admin',
        notes: p.notes ? String(p.notes).trim() : ''
      });
    }

    for (const me of manualEntries) {
      const amount = round2(me.amount);
      const method = me.paymentMethod || 'Cash';
      if (method === 'Cash') {
        cashCollected = round2(cashCollected + amount);
      } else {
        nonCashCollected = round2(nonCashCollected + amount);
      }

      dataRows.push({
        paymentDate: getEffectiveDateTime(me.entryDate, me.createdAt),
        customerName: me.customer?.customerName || 'Unknown',
        customerPhone: me.customer?.phone || '',
        invoiceNumber: 'Manual Settlement',
        paymentMethod: method,
        referenceNumber: me.referenceNumber ? String(me.referenceNumber).trim() : '',
        amount,
        recordedByName: me.createdBy?.user?.name || 'Admin',
        notes: (me.description || me.notes) ? String(me.description || me.notes).trim() : ''
      });
    }

    // Sort by paymentDate DESC
    dataRows.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

    const totalCollected = round2(cashCollected + nonCashCollected);

    // 6. Define Export Definition
    const firmName = admin?.firmName || admin?.name || 'Bharat Enterprise';
    const generatedBy = req.user?.name || req.admin?.name || 'Admin';

    const columns: ExportColumn<CollectionExportRow>[] = [
      { key: 'paymentDate', header: 'Date & Time', format: 'datetime', width: 22 },
      { key: 'customerName', header: 'Customer Name', format: 'text', width: 25 },
      { key: 'customerPhone', header: 'Customer Phone', format: 'text', width: 16 },
      { key: 'invoiceNumber', header: 'Invoice / Allocation', format: 'text', width: 20 },
      { key: 'paymentMethod', header: 'Payment Method', format: 'text', width: 16 },
      { key: 'referenceNumber', header: 'Reference / UTR', format: 'text', width: 22 },
      { key: 'amount', header: 'Amount (INR)', format: 'currency', width: 18, align: 'right' },
      { key: 'recordedByName', header: 'Recorded By', format: 'text', width: 18 },
      { key: 'notes', header: 'Notes', format: 'text', width: 30 }
    ];

    const dateLabel = date
      ? date
      : (startDate && endDate ? `${startDate}_to_${endDate}` : 'all');
    const filename = sanitizeFilename(`Collections_${dateLabel}`);

    const exportDefinition: ExportDefinition<CollectionExportRow> = {
      title: 'Collections Ledger Report',
      filename,
      columns,
      dataRows,
      metadata: {
        firmName,
        generatedBy,
        generatedAt: new Date(),
        filters: {
          DateRange: date ? date : (startDate && endDate ? `${startDate} to ${endDate}` : 'Default'),
          PaymentMethod: paymentMethod || 'All',
          Search: rawSearch || 'None'
        }
      },
      summary: [
        { label: 'Total Collections', value: totalCollected, format: 'currency' },
        { label: 'Cash Collections', value: cashCollected, format: 'currency' },
        { label: 'Non-Cash Collections', value: nonCashCollected, format: 'currency' },
        { label: 'Total Receipts Recorded', value: dataRows.length, format: 'number' }
      ]
    };

    // 7. Dispatch to Shared Export Engine
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
      message: 'Invalid export format. Supported formats: excel, csv, pdf'
    });
  } catch (error) {
    next(error);
  }
};
