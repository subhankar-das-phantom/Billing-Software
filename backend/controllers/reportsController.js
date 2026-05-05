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

    const customers = customerOutstanding.map(c => ({
      _id: c._id,
      customerName: c.customerName,
      phone: c.phone,
      address: c.address,
      outstandingBalance: round2(Math.max(0, c.outstandingBalance - (creditMap.get(c._id.toString()) || 0))),
      invoiceCount: c.invoiceCount
    })).filter(c => c.outstandingBalance > 0)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    // Summary stats
    const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
    const customersWithDues = customers.length;
    const overdueAmount = customerOutstanding.reduce((sum, c) => sum + c.overdueAmount, 0);

    res.status(200).json({
      success: true,
      summary: {
        totalOutstanding,
        overdueAmount,
        customersWithDues
      },
      customers
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
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get all unpaid/partial invoices that are not cancelled
    const invoices = await Invoice.find({
      tenantId,
      paymentStatus: { $in: ['Unpaid', 'Partial'] },
      status: { $ne: 'Cancelled' }
    }).select('invoiceNumber invoiceDate customer totals.netTotal paidAmount paymentStatus');

    // Filter out fully paid invoices (in case paidAmount matches total but status wasn't updated)
    const unpaidInvoices = invoices.filter(inv => {
      const remaining = inv.totals.netTotal - (inv.paidAmount || 0);
      return remaining > 0;
    });

    // Categorize by age
    const buckets = {
      current: { label: '0-30 Days', invoices: [], amount: 0, count: 0 },
      overdue30: { label: '31-60 Days', invoices: [], amount: 0, count: 0 },
      overdue60: { label: '61-90 Days', invoices: [], amount: 0, count: 0 },
      overdue90: { label: '90+ Days', invoices: [], amount: 0, count: 0 }
    };

    unpaidInvoices.forEach(inv => {
      const remainingAmount = inv.totals.netTotal - (inv.paidAmount || 0);
      const invDate = new Date(inv.invoiceDate);

      let bucket;
      if (invDate >= thirtyDaysAgo) {
        bucket = buckets.current;
      } else if (invDate >= sixtyDaysAgo) {
        bucket = buckets.overdue30;
      } else if (invDate >= ninetyDaysAgo) {
        bucket = buckets.overdue60;
      } else {
        bucket = buckets.overdue90;
      }

      bucket.invoices.push({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        customerName: inv.customer.customerName,
        customerId: inv.customer._id,
        totalAmount: inv.totals.netTotal,
        paidAmount: inv.paidAmount,
        remainingAmount
      });
      bucket.amount += remainingAmount;
      bucket.count += 1;
    });

    // Calculate totals
    const totalAmount = Object.values(buckets).reduce((sum, b) => sum + b.amount, 0);
    const totalCount = Object.values(buckets).reduce((sum, b) => sum + b.count, 0);

    res.status(200).json({
      success: true,
      summary: {
        totalAmount,
        totalCount
      },
      buckets
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
