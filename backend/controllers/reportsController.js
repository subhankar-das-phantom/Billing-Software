const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const CreditNote = require('../models/CreditNote');
const getTenantId = require('../utils/getTenantId');

// Round to 2 decimal places safely (avoids JS floating point drift)
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// @desc    Get outstanding report - customers with pending amounts
// @route   GET /api/reports/outstanding
// @access  Private
exports.getOutstandingReport = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const unpaidFilter = {
      tenantId,
      paymentStatus: { $in: ['Unpaid', 'Partial'] },
      status: { $ne: 'Cancelled' }
    };

    // Two separate aggregations + merge in JS (faster than $lookup)
    const [customerOutstanding, creditNoteTotals] = await Promise.all([
      // Aggregation 1: Group unpaid invoices by customer
      Invoice.aggregate([
        { $match: unpaidFilter },
        { $addFields: { remaining: { $subtract: ['$totals.netTotal', { $ifNull: ['$paidAmount', 0] }] } } },
        { $match: { remaining: { $gt: 0 } } },
        { $group: {
          _id: '$customer._id',
          customerName: { $first: '$customer.customerName' },
          phone: { $first: '$customer.phone' },
          address: { $first: '$customer.address' },
          outstandingBalance: { $sum: '$remaining' },
          invoiceCount: { $sum: 1 },
          overdueAmount: { $sum: {
            $cond: [{ $lt: ['$invoiceDate', thirtyDaysAgo] }, '$remaining', 0]
          }}
        }},
        { $sort: { outstandingBalance: -1 } }
      ]),

      // Aggregation 2: Credit note totals per customer
      CreditNote.aggregate([
        { $match: { tenantId } },
        { $group: { _id: '$customer._id', total: { $sum: '$totals.netTotal' } } }
      ])
    ]);

    // Merge credit note deductions in JS (fast — only customer-level rows)
    const creditMap = new Map(creditNoteTotals.map(cn => [cn._id.toString(), cn.total]));

    const allCustomers = customerOutstanding.map(c => ({
      _id: c._id,
      customerName: c.customerName,
      phone: c.phone,
      address: c.address,
      outstandingBalance: round2(Math.max(0, c.outstandingBalance - (creditMap.get(c._id.toString()) || 0))),
      invoiceCount: c.invoiceCount
    })).filter(c => c.outstandingBalance > 0)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    // Summary stats from ALL customers (not just current page)
    const totalOutstanding = allCustomers.reduce((sum, c) => sum + c.outstandingBalance, 0);
    const customersWithDues = allCustomers.length;
    const overdueAmount = customerOutstanding.reduce((sum, c) => sum + c.overdueAmount, 0);

    // Paginate customers
    const customers = allCustomers.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      summary: {
        totalOutstanding,
        overdueAmount,
        customersWithDues
      },
      customers,
      page,
      total: customersWithDues,
      hasMore: skip + limit < customersWithDues
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ageing report - breakdown by days overdue
// @route   GET /api/reports/ageing
// @access  Private
exports.getAgeingReport = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const unpaidFilter = {
      tenantId,
      paymentStatus: { $in: ['Unpaid', 'Partial'] },
      status: { $ne: 'Cancelled' }
    };

    // Same formula: remaining = totals.netTotal - (paidAmount || 0)
    const remainingExpr = { $subtract: ['$totals.netTotal', { $ifNull: ['$paidAmount', 0] }] };

    // Two parallel aggregations
    const [bucketSummaries, paginatedInvoices] = await Promise.all([
      // 1. Bucket summaries — same thresholds as before (30/60/90 days)
      Invoice.aggregate([
        { $match: unpaidFilter },
        { $addFields: { remaining: remainingExpr } },
        { $match: { remaining: { $gt: 0 } } },
        { $addFields: {
          bucket: { $switch: {
            branches: [
              { case: { $gte: ['$invoiceDate', thirtyDaysAgo] }, then: 'current' },
              { case: { $gte: ['$invoiceDate', sixtyDaysAgo] }, then: 'overdue30' },
              { case: { $gte: ['$invoiceDate', ninetyDaysAgo] }, then: 'overdue60' }
            ],
            default: 'overdue90'
          }}
        }},
        { $group: {
          _id: '$bucket',
          amount: { $sum: '$remaining' },
          count: { $sum: 1 }
        }}
      ]),

      // 2. Paginated invoice list (oldest first = most overdue)
      Invoice.aggregate([
        { $match: unpaidFilter },
        { $addFields: { remaining: remainingExpr } },
        { $match: { remaining: { $gt: 0 } } },
        { $project: {
          invoiceNumber: 1,
          invoiceDate: 1,
          'customer.customerName': 1,
          'customer._id': 1,
          'totals.netTotal': 1,
          paidAmount: 1,
          remaining: 1
        }},
        { $sort: { invoiceDate: 1 } },
        { $skip: skip },
        { $limit: limit }
      ])
    ]);

    // Build buckets — same keys and labels as before
    const bucketLabels = {
      current: '0-30 Days',
      overdue30: '31-60 Days',
      overdue60: '61-90 Days',
      overdue90: '90+ Days'
    };

    const buckets = {};
    for (const [key, label] of Object.entries(bucketLabels)) {
      const summary = bucketSummaries.find(b => b._id === key);
      buckets[key] = {
        label,
        amount: summary?.amount || 0,
        count: summary?.count || 0
      };
    }

    // Totals from bucket summaries — same calculation
    const totalAmount = Object.values(buckets).reduce((sum, b) => sum + b.amount, 0);
    const totalCount = Object.values(buckets).reduce((sum, b) => sum + b.count, 0);

    // Map invoices to same shape the frontend expects
    const invoices = paginatedInvoices.map(inv => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      customerName: inv.customer.customerName,
      customerId: inv.customer._id,
      totalAmount: inv.totals.netTotal,
      paidAmount: inv.paidAmount,
      remainingAmount: inv.remaining
    }));

    res.status(200).json({
      success: true,
      summary: {
        totalAmount,
        totalCount
      },
      buckets,
      invoices,
      page,
      total: totalCount,
      hasMore: page * limit < totalCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get credit dashboard stats
// @route   GET /api/reports/credit-stats
// @access  Private
exports.getCreditStats = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const unpaidFilter = {
      tenantId,
      paymentStatus: { $in: ['Unpaid', 'Partial'] },
      status: { $ne: 'Cancelled' }
    };

    // 3 parallel aggregations — replaces 2x Invoice.find() + all JS processing
    const [invoiceStats, paymentsThisMonth, totalCreditNotes] = await Promise.all([
      // Single aggregation: outstanding + overdue + unique customers
      Invoice.aggregate([
        { $match: unpaidFilter },
        { $project: {
          remaining: { $subtract: ['$totals.netTotal', { $ifNull: ['$paidAmount', 0] }] },
          invoiceDate: 1,
          customerId: '$customer._id'
        }},
        { $match: { remaining: { $gt: 0 } } },
        { $group: {
          _id: null,
          totalOutstanding: { $sum: '$remaining' },
          overdueAmount: { $sum: {
            $cond: [{ $lt: ['$invoiceDate', thirtyDaysAgo] }, '$remaining', 0]
          }},
          customerIds: { $addToSet: '$customerId' }
        }}
      ]),

      // Payments this month (already an aggregation — unchanged)
      Payment.aggregate([
        { $match: { tenantId, paymentDate: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),

      // Credit note total (already an aggregation — unchanged)
      CreditNote.aggregate([
        { $match: { tenantId } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ])
    ]);

    const stats = invoiceStats[0] || { totalOutstanding: 0, overdueAmount: 0, customerIds: [] };
    const creditNoteDeduction = totalCreditNotes[0]?.total || 0;
    const adjustedOutstanding = round2(Math.max(0, stats.totalOutstanding - creditNoteDeduction));

    res.status(200).json({
      success: true,
      stats: {
        totalOutstanding: adjustedOutstanding,
        overdueAmount: stats.overdueAmount,
        customersWithDues: stats.customerIds.length,
        paymentsThisMonth: paymentsThisMonth[0]?.total || 0,
        paymentsThisMonthCount: paymentsThisMonth[0]?.count || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recent payments
// @route   GET /api/reports/recent-payments
// @access  Private
exports.getRecentPayments = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const tenantId = getTenantId(req);

    const payments = await Payment.find({ tenantId })
      .populate('customer', 'customerName phone')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    next(error);
  }
};
