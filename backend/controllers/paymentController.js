const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const ManualEntry = require('../models/ManualEntry');
const CreditNote = require('../models/CreditNote');
const { getAttribution } = require('../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../utils/activityTracker');
const getTenantId = require('../utils/getTenantId');

// Round to 2 decimal places safely
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const getRoundedNumber = (n) => round2(Number(n) || 0);

const derivePaymentStatus = (totalAmount, paidAmount) => {
  const roundedTotal = getRoundedNumber(totalAmount);
  const roundedPaid = getRoundedNumber(paidAmount);
  const remaining = round2(roundedTotal - roundedPaid);

  if (remaining <= 0 && roundedPaid > 0) return 'Paid';
  if (roundedPaid > 0) return 'Partial';
  return 'Unpaid';
};

const getInvoiceCreditNoteTotal = async (invoiceId, tenantId) => {
  const result = await CreditNote.aggregate([
    { $match: { invoiceId, tenantId } },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ['$totals.netTotal', 0] } }
      }
    }
  ]);

  return getRoundedNumber(result[0]?.total);
};

const hasExplicitTime = (dateValue) => {
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

const getCollectionSortDate = (entry) => {
  const paymentDate = entry?.paymentDate ? new Date(entry.paymentDate) : null;
  const createdAt = entry?.createdAt ? new Date(entry.createdAt) : null;

  if (hasExplicitTime(entry?.paymentDate) && paymentDate && !Number.isNaN(paymentDate.getTime())) {
    return paymentDate;
  }

  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    return createdAt;
  }

  if (paymentDate && !Number.isNaN(paymentDate.getTime())) {
    return paymentDate;
  }

  return new Date(0);
};

const buildCollectionSortDateExpression = (dateField) => {
  const entryDate = `$${dateField}`;

  return {
    $cond: [
      {
        $ne: [
          {
            $dateToString: {
              format: '%H%M%S%L',
              date: { $ifNull: [entryDate, new Date(0)] },
              timezone: 'UTC'
            }
          },
          '000000000'
        ]
      },
      entryDate,
      { $ifNull: ['$createdAt', { $ifNull: [entryDate, new Date(0)] }] }
    ]
  };
};

// IST date boundary parser for accurate Indian timezone filtering (UTC+5:30)
const parseISTDateBoundary = (dateInput, endOfDay = false) => {
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

// Preserve explicit recording time when date is provided without a time component
const resolvePaymentDate = (inputDate) => {
  if (!inputDate) return new Date();
  const raw = String(inputDate).trim();
  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    if (raw === todayIST) {
      return new Date();
    }
    const now = new Date();
    const [, year, month, day] = ymdMatch;
    const istTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
    const parsed = new Date(`${year}-${month}-${day}T${istTimeStr}+05:30`);
    return Number.isNaN(parsed.getTime()) ? new Date(raw) : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const escapeRegex = (string) => {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const CANONICAL_PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT/RTGS'];

// @desc    Get daily collections summary + payment list
// @route   GET /api/payments/collections
// @access  Private
exports.getCollections = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const tenantId = getTenantId(req);

    // Build IST date range
    let startOfDay = null;
    let endOfDay = null;

    if (req.query.date) {
      startOfDay = parseISTDateBoundary(req.query.date, false);
      endOfDay = parseISTDateBoundary(req.query.date, true);
    } else if (req.query.startDate || req.query.endDate) {
      if (req.query.startDate) startOfDay = parseISTDateBoundary(req.query.startDate, false);
      if (req.query.endDate) endOfDay = parseISTDateBoundary(req.query.endDate, true);
    } else {
      const istTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      startOfDay = parseISTDateBoundary(istTodayStr, false);
      endOfDay = parseISTDateBoundary(istTodayStr, true);
    }

    // Shared base predicates (constructed once)
    const paymentQuery = { tenantId };
    const meQuery = {
      tenantId,
      entryType: { $in: ['payment_adjustment', 'credit_adjustment'] }
    };

    if (startOfDay || endOfDay) {
      paymentQuery.paymentDate = {};
      meQuery.entryDate = {};
      if (startOfDay) {
        paymentQuery.paymentDate.$gte = startOfDay;
        meQuery.entryDate.$gte = startOfDay;
      }
      if (endOfDay) {
        paymentQuery.paymentDate.$lte = endOfDay;
        meQuery.entryDate.$lte = endOfDay;
      }
    }

    // Payment method filter (canonical only)
    if (req.query.paymentMethod && CANONICAL_PAYMENT_METHODS.includes(req.query.paymentMethod)) {
      paymentQuery.paymentMethod = req.query.paymentMethod;
      meQuery.paymentMethod = req.query.paymentMethod;
    }

    // Customer ID filter
    if (req.query.customerId) {
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(req.query.customerId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customerId'
        });
      }
      const custId = new mongoose.Types.ObjectId(req.query.customerId);
      paymentQuery.customer = custId;
      meQuery.customer = custId;
    }

    // Guarded search: prefix-indexed where possible, max 50 chars, bounded customer lookups
    const rawSearch = String(req.query.search || '').trim().slice(0, 50);
    if (rawSearch.length >= 2) {
      const escaped = escapeRegex(rawSearch);
      const prefixPattern = new RegExp(`^${escaped}`, 'i');
      const containsPattern = new RegExp(escaped, 'i');

      // Bounded customer lookup utilizing existing { tenantId: 1, customerName: 1 } / phone indexes
      const matchingCustomers = await Customer.find({
        tenantId,
        $or: [
          { customerName: prefixPattern },
          { phone: prefixPattern }
        ]
      }).select('_id').limit(50).lean();

      const matchingCustomerIds = matchingCustomers.map(c => c._id);

      const paymentOr = [
        { referenceNumber: containsPattern },
        { notes: containsPattern },
        { 'invoiceSnapshot.invoiceNumber': prefixPattern }
      ];
      if (matchingCustomerIds.length > 0) {
        paymentOr.push({ customer: { $in: matchingCustomerIds } });
      }

      const meOr = [
        { referenceNumber: containsPattern },
        { description: containsPattern },
        { notes: containsPattern }
      ];
      if (matchingCustomerIds.length > 0) {
        meOr.push({ customer: { $in: matchingCustomerIds } });
      }

      paymentQuery.$and = paymentQuery.$and || [];
      paymentQuery.$and.push({ $or: paymentOr });

      meQuery.$and = meQuery.$and || [];
      meQuery.$and.push({ $or: meOr });
    }

    // Run bounded queries in parallel with cashier attribution
    const [payments, manualEntries] = await Promise.all([
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
        .lean()
    ]);

    // Normalize both collections into UnifiedCollectionRecord DTO
    const getEffectiveDate = (primaryDate, fallbackCreatedAt) => {
      if (primaryDate && hasExplicitTime(primaryDate)) return primaryDate;
      if (fallbackCreatedAt) return fallbackCreatedAt;
      return primaryDate;
    };

    const normalizedPayments = payments.map(p => ({
      id: p._id.toString(),
      sourceType: 'payment',
      paymentDate: p.paymentDate,
      createdAt: p.createdAt,
      effectiveDate: getEffectiveDate(p.paymentDate, p.createdAt),
      amount: round2(p.amount),
      paymentMethod: p.paymentMethod || 'Cash',
      referenceNumber: p.referenceNumber ? String(p.referenceNumber).trim() : null,
      notes: p.notes ? String(p.notes).trim() : null,
      customer: {
        id: p.customer?._id?.toString() || '',
        name: p.customer?.customerName || 'Unknown',
        phone: p.customer?.phone || ''
      },
      invoice: p.invoice ? {
        id: p.invoice._id?.toString() || '',
        invoiceNumber: p.invoice.invoiceNumber || p.invoiceSnapshot?.invoiceNumber || '-',
        netTotal: p.invoice.totals?.netTotal ?? p.invoiceSnapshot?.netTotal ?? null
      } : (p.invoiceSnapshot?.invoiceNumber ? {
        id: null,
        invoiceNumber: p.invoiceSnapshot.invoiceNumber,
        netTotal: p.invoiceSnapshot.netTotal ?? null
      } : null),
      entryType: null,
      recordedBy: p.createdBy?.user ? {
        name: p.createdBy.user.name || 'Admin',
        email: p.createdBy.user.email || '',
        role: p.createdBy.userModel || 'Admin'
      } : null
    }));

    const normalizedME = manualEntries.map(me => ({
      id: me._id.toString(),
      sourceType: 'manual_entry',
      paymentDate: me.entryDate,
      createdAt: me.createdAt,
      effectiveDate: getEffectiveDate(me.entryDate, me.createdAt),
      amount: round2(me.amount),
      paymentMethod: me.paymentMethod || 'Cash',
      referenceNumber: me.referenceNumber ? String(me.referenceNumber).trim() : null,
      notes: (me.description || me.notes) ? String(me.description || me.notes).trim() : null,
      customer: {
        id: me.customer?._id?.toString() || '',
        name: me.customer?.customerName || 'Unknown',
        phone: me.customer?.phone || ''
      },
      invoice: null,
      entryType: me.entryType,
      recordedBy: me.createdBy?.user ? {
        name: me.createdBy.user.name || 'Admin',
        email: me.createdBy.user.email || '',
        role: me.createdBy.userModel || 'Admin'
      } : null
    }));

    // Deterministic sort: event time DESC -> creation time DESC -> ID tie-breaker
    const allRecords = [...normalizedPayments, ...normalizedME].sort((a, b) => {
      const dateA = getCollectionSortDate(a).getTime();
      const dateB = getCollectionSortDate(b).getTime();
      if (dateB !== dateA) return dateB - dateA;
      const createdA = new Date(a.createdAt || 0).getTime();
      const createdB = new Date(b.createdAt || 0).getTime();
      if (createdB !== createdA) return createdB - createdA;
      return String(b.id).localeCompare(String(a.id));
    });

    // Compute executive summary metrics with reconciliation invariants
    let cashCollected = 0;
    let cashCount = 0;
    let nonCashCollected = 0;
    let nonCashCount = 0;

    const byMethod = {
      'Cash': { count: 0, total: 0 },
      'UPI': { count: 0, total: 0 },
      'Bank Transfer': { count: 0, total: 0 },
      'Cheque': { count: 0, total: 0 },
      'NEFT/RTGS': { count: 0, total: 0 }
    };

    for (const rec of allRecords) {
      const m = (rec.paymentMethod in byMethod) ? rec.paymentMethod : 'Cash';
      byMethod[m].count += 1;
      byMethod[m].total = round2(byMethod[m].total + rec.amount);

      if (m === 'Cash') {
        cashCollected = round2(cashCollected + rec.amount);
        cashCount += 1;
      } else {
        nonCashCollected = round2(nonCashCollected + rec.amount);
        nonCashCount += 1;
      }
    }

    const totalCollected = round2(cashCollected + nonCashCollected);
    const paymentCount = cashCount + nonCashCount;

    const total = allRecords.length;
    const paginatedRecords = allRecords.slice((page - 1) * limit, page * limit);

    res.status(200).json({
      success: true,
      summary: {
        totalCollected,
        paymentCount,
        cashCollected,
        cashCount,
        nonCashCollected,
        nonCashCount,
        byMethod
      },
      count: paginatedRecords.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      payments: paginatedRecords
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record a new payment
// @route   POST /api/payments
// @access  Private
exports.createPayment = async (req, res, next) => {
  try {
    const { invoiceId, amount, paymentDate, paymentMethod, referenceNumber, notes } = req.body;
    const tenantId = getTenantId(req);

    // Validate invoice exists
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      tenantId
    });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check if invoice is cancelled
    if (invoice.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot record payment for cancelled invoice'
      });
    }

    const creditNoteTotal = await getInvoiceCreditNoteTotal(invoice._id, tenantId);

    // Calculate effective remaining amount after payments and credit note returns.
    // Use round2 to avoid floating-point precision drift (e.g. 0.01 vs 0.009999...)
    const remainingAmount = Math.max(
      0,
      round2(
        getRoundedNumber(invoice.totals.netTotal)
        - getRoundedNumber(invoice.paidAmount)
        - creditNoteTotal
      )
    );
    const normalizedAmount = getRoundedNumber(amount);
    
    // Validate payment amount
    if (normalizedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }

    if (remainingAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already fully paid or settled by credit notes'
      });
    }

    if (normalizedAmount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${normalizedAmount}) exceeds remaining balance (₹${remainingAmount})`
      });
    }

    // Create payment record
    let customer = null;
    
    // Always fetch customer to check active status
    customer = await Customer.findOne({
      _id: invoice.customer._id,
      tenantId
    });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Associated customer not found'
      });
    }

    if (customer.isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot record payment for an inactive customer'
      });
    }

    const payment = await Payment.create({
      tenantId,
      invoice: invoiceId,
      customer: invoice.customer._id,
      amount: normalizedAmount,
      paymentDate: resolvePaymentDate(paymentDate),
      paymentMethod: paymentMethod || 'Cash',
      referenceNumber: referenceNumber || '',
      notes: notes || '',
      invoiceSnapshot: {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        netTotal: invoice.totals.netTotal
      },
      createdBy: getAttribution(req)
    });

    // Update invoice paid amount and status
    const newPaidAmount = getRoundedNumber(getRoundedNumber(invoice.paidAmount) + normalizedAmount);
    const newPaymentStatus = derivePaymentStatus(invoice.totals.netTotal, newPaidAmount);

    await Invoice.findOneAndUpdate({
      _id: invoiceId,
      tenantId
    }, {
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus
    });

    // Update customer outstanding balance only for Credit invoices
    if (invoice.paymentType === 'Credit') {
      const currentBalance = getRoundedNumber(customer?.outstandingBalance);
      const newBalance = Math.max(0, round2(currentBalance - normalizedAmount));
      await Customer.findOneAndUpdate({
        _id: invoice.customer._id,
        tenantId
      }, {
        outstandingBalance: newBalance
      });
    }

    // Track employee activity
    trackActivity(req, ACTIVITY_TYPES.PAYMENT_RECORDED, normalizedAmount);

    res.status(201).json({
      success: true,
      payment,
      invoiceUpdate: {
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus,
        remainingAmount: Math.max(0, round2(getRoundedNumber(invoice.totals.netTotal) - newPaidAmount - creditNoteTotal))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
exports.getPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const tenantId = getTenantId(req);

    const query = { tenantId };

    // Filter by customer
    if (req.query.customerId) {
      query.customer = req.query.customerId;
    }

    // Filter by payment method
    if (req.query.paymentMethod) {
      query.paymentMethod = req.query.paymentMethod;
    }

    // Filter by date range
    if (req.query.startDate || req.query.endDate) {
      query.paymentDate = {};
      if (req.query.startDate) {
        query.paymentDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.paymentDate.$lte = new Date(req.query.endDate);
      }
    }

    const payments = await Payment.find(query)
      .populate('customer', 'customerName phone')
      .populate('invoice', 'invoiceNumber totals.netTotal')
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments(query);

    // Calculate totals
    const aggregation = await Payment.aggregate([
      { $match: query },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      totalAmount: aggregation[0]?.totalAmount || 0,
      page,
      pages: Math.ceil(total / limit),
      payments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
exports.getPayment = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const payment = await Payment.findOne({
      _id: req.params.id,
      tenantId
    })
      .populate('customer', 'customerName phone address')
      .populate('invoice', 'invoiceNumber invoiceDate totals');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get payments by customer
// @route   GET /api/payments/customer/:customerId
// @access  Private
exports.getPaymentsByCustomer = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const tenantId = getTenantId(req);
    const customerId = req.params.customerId;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customerId'
      });
    }

    const customerObjectId = new mongoose.Types.ObjectId(customerId);
    
    const query = { tenantId, customer: customerObjectId };
    const meQuery = {
      tenantId,
      customer: customerObjectId,
      entryType: { $in: ['payment_adjustment', 'credit_adjustment'] }
    };

    const [result = {}] = await Payment.aggregate([
      { $match: query },
      {
        $addFields: {
          sortDate: buildCollectionSortDateExpression('paymentDate'),
          isManualEntry: false
        }
      },
      {
        $project: {
          _id: 1,
          paymentDate: 1,
          createdAt: 1,
          amount: 1,
          paymentMethod: 1,
          referenceNumber: 1,
          notes: 1,
          customer: 1,
          invoice: 1,
          invoiceSnapshot: 1,
          isManualEntry: 1,
          sortDate: 1
        }
      },
      {
        $unionWith: {
          coll: ManualEntry.collection.name,
          pipeline: [
            { $match: meQuery },
            {
              $addFields: {
                paymentDate: '$entryDate',
                sortDate: buildCollectionSortDateExpression('entryDate'),
                isManualEntry: true
              }
            },
            {
              $project: {
                _id: 1,
                paymentDate: 1,
                createdAt: 1,
                amount: 1,
                paymentMethod: { $ifNull: ['$paymentMethod', 'Cash'] },
                referenceNumber: { $ifNull: ['$referenceNumber', ''] },
                notes: { $ifNull: ['$description', '$notes'] },
                customer: 1,
                invoice: { $literal: null },
                invoiceSnapshot: { $literal: null },
                isManualEntry: 1,
                entryType: 1,
                description: 1,
                sortDate: 1
              }
            }
          ]
        }
      },
      {
        $facet: {
          items: [
            { $sort: { sortDate: -1, createdAt: -1, _id: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: Invoice.collection.name,
                localField: 'invoice',
                foreignField: '_id',
                as: 'invoiceDoc'
              }
            },
            { $unwind: { path: '$invoiceDoc', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: Customer.collection.name,
                localField: 'customer',
                foreignField: '_id',
                as: 'customerDoc'
              }
            },
            { $unwind: { path: '$customerDoc', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                paymentDate: 1,
                createdAt: 1,
                amount: 1,
                paymentMethod: 1,
                referenceNumber: 1,
                notes: 1,
                customer: {
                  $cond: [
                    '$isManualEntry',
                    {
                      _id: '$customerDoc._id',
                      customerName: '$customerDoc.customerName',
                      phone: '$customerDoc.phone'
                    },
                    '$customer'
                  ]
                },
                invoice: {
                  $cond: [
                    { $ifNull: ['$invoiceDoc._id', false] },
                    {
                      _id: '$invoiceDoc._id',
                      invoiceNumber: '$invoiceDoc.invoiceNumber',
                      invoiceDate: '$invoiceDoc.invoiceDate',
                      totals: { netTotal: '$invoiceDoc.totals.netTotal' },
                      paidAmount: '$invoiceDoc.paidAmount',
                      paymentType: '$invoiceDoc.paymentType'
                    },
                    null
                  ]
                },
                invoiceSnapshot: 1,
                isManualEntry: 1,
                entryType: 1,
                description: 1
              }
            }
          ],
          metadata: [{ $count: 'total' }],
          totals: [{ $group: { _id: null, totalPaid: { $sum: '$amount' } } }]
        }
      }
    ]).allowDiskUse(true);

    const paginatedPayments = result.items || [];
    const total = result.metadata?.[0]?.total || 0;
    const pages = Math.ceil(total / limit);
    const totalPaid = result.totals?.[0]?.totalPaid || 0;

    res.status(200).json({
      success: true,
      items: paginatedPayments,
      pagination: {
        page,
        limit,
        total,
        hasMore: page < pages
      },
      // Backward compatibility
      count: paginatedPayments.length,
      totalPaid,
      payments: paginatedPayments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get payments by invoice
// @route   GET /api/payments/invoice/:invoiceId
// @access  Private
exports.getPaymentsByInvoice = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const invoice = await Invoice.findOne({
      _id: req.params.invoiceId,
      tenantId
    });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const payments = await Payment.find({ invoice: req.params.invoiceId, tenantId })
      .sort({ paymentDate: -1 });

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = invoice.totals.netTotal - totalPaid;

    res.status(200).json({
      success: true,
      count: payments.length,
      invoiceTotal: invoice.totals.netTotal,
      totalPaid,
      remainingAmount,
      paymentStatus: invoice.paymentStatus,
      payments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a payment
// @route   PUT /api/payments/:id
// @access  Private
exports.updatePayment = async (req, res, next) => {
  try {
    const { amount, paymentDate, paymentMethod, referenceNumber, notes } = req.body;
    const tenantId = getTenantId(req);

    const payment = await Payment.findOne({
      _id: req.params.id,
      tenantId
    });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const invoice = await Invoice.findOne({
      _id: payment.invoice,
      tenantId
    });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Associated invoice not found'
      });
    }

    if (invoice.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit payment for a cancelled invoice'
      });
    }

    // If amount is being changed, validate it
    if (amount !== undefined) {
      const newAmount = round2(amount);
      if (newAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Payment amount must be greater than 0'
        });
      }

      // How much room is available?  remaining + old payment amount
      const currentRemaining = round2(getRoundedNumber(invoice.totals.netTotal) - getRoundedNumber(invoice.paidAmount));
      const maxAllowed = round2(currentRemaining + getRoundedNumber(payment.amount));

      if (newAmount > maxAllowed) {
        return res.status(400).json({
          success: false,
          message: `Payment amount (₹${newAmount}) exceeds maximum allowed (₹${maxAllowed})`
        });
      }

      // Update invoice paidAmount by the delta
      const delta = round2(newAmount - getRoundedNumber(payment.amount));
      if (delta !== 0) {
        let newBalance = null;
        if (invoice.paymentType === 'Credit') {
          const customer = await Customer.findOne({
            _id: payment.customer,
            tenantId
          });
          if (!customer) {
            return res.status(404).json({
              success: false,
              message: 'Associated customer not found'
            });
          }
          const currentBalance = getRoundedNumber(customer?.outstandingBalance);
          // delta > 0 means more paid → reduce outstanding
          // delta < 0 means less paid → increase outstanding
          newBalance = Math.max(0, round2(currentBalance - delta));
        }

        const newPaidAmount = round2(getRoundedNumber(invoice.paidAmount) + delta);
        const newPaymentStatus = derivePaymentStatus(invoice.totals.netTotal, newPaidAmount);

        await Invoice.findOneAndUpdate({
          _id: invoice._id,
          tenantId
        }, {
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus
        });

        // Update customer outstanding balance (for Credit invoices)
        if (invoice.paymentType === 'Credit') {
          await Customer.findOneAndUpdate({
            _id: payment.customer,
            tenantId
          }, {
            outstandingBalance: newBalance
          });
        }
      }

      payment.amount = newAmount;
    }

    // Update other fields if provided
    if (paymentDate !== undefined) payment.paymentDate = resolvePaymentDate(paymentDate);
    if (paymentMethod !== undefined) payment.paymentMethod = paymentMethod;
    if (referenceNumber !== undefined) payment.referenceNumber = referenceNumber;
    if (notes !== undefined) payment.notes = notes;

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/reverse a payment
// @route   DELETE /api/payments/:id
// @access  Private
exports.deletePayment = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const payment = await Payment.findOne({
      _id: req.params.id,
      tenantId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Get the invoice
    const invoice = await Invoice.findOne({
      _id: payment.invoice,
      tenantId
    });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Associated invoice not found'
      });
    }

    // Reverse the payment on invoice
    const newPaidAmount = Math.max(0, round2(getRoundedNumber(invoice.paidAmount) - getRoundedNumber(payment.amount)));
    const newPaymentStatus = derivePaymentStatus(invoice.totals.netTotal, newPaidAmount);

    await Invoice.findOneAndUpdate({
      _id: payment.invoice,
      tenantId
    }, {
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus
    });

    // Increase customer outstanding balance only for Credit invoices
    if (invoice.paymentType === 'Credit') {
      await Customer.findOneAndUpdate({
        _id: payment.customer,
        tenantId
      }, {
        $inc: { outstandingBalance: payment.amount }
      });
    }

    // Delete the payment
    await Payment.findOneAndDelete({
      _id: req.params.id,
      tenantId
    });

    res.status(200).json({
      success: true,
      message: 'Payment deleted and reversed successfully'
    });
  } catch (error) {
    next(error);
  }
};

