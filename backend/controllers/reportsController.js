const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');

// @desc    Get outstanding report - customers with pending amounts
// @route   GET /api/reports/outstanding
// @access  Private
exports.getOutstandingReport = async (req, res, next) => {
  try {
    // Get all unpaid invoices - include those where paymentStatus is not set (old invoices)
    const unpaidInvoices = await Invoice.find({
      $or: [
        { paymentStatus: { $in: ['Unpaid', 'Partial'] } },
        { paymentStatus: { $exists: false } },
        { paymentStatus: null }
      ],
      status: { $ne: 'Cancelled' }
    });

    // Group by customer and calculate outstanding
    const customerMap = new Map();
    
    unpaidInvoices.forEach(inv => {
      const remaining = inv.totals.netTotal - (inv.paidAmount || 0);
      if (remaining <= 0) return; // Skip fully paid invoices
      
      const customerId = inv.customer._id.toString();
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          _id: inv.customer._id,
          customerName: inv.customer.customerName,
          phone: inv.customer.phone,
          address: inv.customer.address,
          outstandingBalance: 0,
          invoiceCount: 0
        });
      }
      
      const customer = customerMap.get(customerId);
      customer.outstandingBalance += remaining;
      customer.invoiceCount += 1;
    });

    // Convert to array and sort
    const customers = Array.from(customerMap.values())
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    // Get additional stats
    const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
    const customersWithDues = customers.length;

    // Get overdue amount (invoices older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const overdueAmount = unpaidInvoices.reduce((sum, inv) => {
      if (new Date(inv.invoiceDate) >= thirtyDaysAgo) return sum;
      const remaining = inv.totals.netTotal - (inv.paidAmount || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

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
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get all unpaid/partial invoices that are not cancelled
    // Include invoices where paymentStatus is not set (old invoices before credit feature)
    const invoices = await Invoice.find({
      $or: [
        { paymentStatus: { $in: ['Unpaid', 'Partial'] } },
        { paymentStatus: { $exists: false } },
        { paymentStatus: null }
      ],
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
    // Calculate total outstanding from actual invoices (more reliable than customer.outstandingBalance)
    const unpaidInvoices = await Invoice.find({
      $or: [
        { paymentStatus: { $in: ['Unpaid', 'Partial'] } },
        { paymentStatus: { $exists: false } },
        { paymentStatus: null }
      ],
      status: { $ne: 'Cancelled' }
    });

    // Filter to only invoices with actual remaining balance and sum up
    const totalOutstanding = unpaidInvoices.reduce((sum, inv) => {
      const remaining = inv.totals.netTotal - (inv.paidAmount || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

    // Count unique customers with unpaid invoices
    const customersWithDues = new Set(
      unpaidInvoices
        .filter(inv => (inv.totals.netTotal - (inv.paidAmount || 0)) > 0)
        .map(inv => inv.customer._id.toString())
    ).size;

    // Payments this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const paymentsThisMonth = await Payment.aggregate([
      { $match: { paymentDate: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Overdue amount (> 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Include invoices where paymentStatus is not set (old invoices)
    const overdueInvoices = await Invoice.find({
      $or: [
        { paymentStatus: { $in: ['Unpaid', 'Partial'] } },
        { paymentStatus: { $exists: false } },
        { paymentStatus: null }
      ],
      invoiceDate: { $lt: thirtyDaysAgo },
      status: { $ne: 'Cancelled' }
    });

    const overdueAmount = overdueInvoices.reduce((sum, inv) => {
      const remaining = inv.totals.netTotal - (inv.paidAmount || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

    res.status(200).json({
      success: true,
      stats: {
        totalOutstanding,
        overdueAmount,
        customersWithDues,
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

    const payments = await Payment.find()
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
