const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { LOW_STOCK_THRESHOLD } = require('../config/constants');
const getTenantId = require('../utils/getTenantId');

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getISTDateRanges = (referenceDate = new Date()) => {
  const shiftedNowMs = referenceDate.getTime() + IST_OFFSET_MS;
  const shiftedNow = new Date(shiftedNowMs);
  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth();
  const day = shiftedNow.getUTCDate();

  const todayStartMs = Date.UTC(year, month, day) - IST_OFFSET_MS;
  const tomorrowStartMs = todayStartMs + DAY_MS;
  const yesterdayStartMs = todayStartMs - DAY_MS;
  const monthStartMs = Date.UTC(year, month, 1) - IST_OFFSET_MS;
  const nextMonthStartMs = Date.UTC(year, month + 1, 1) - IST_OFFSET_MS;
  const prevMonthStartMs = Date.UTC(year, month - 1, 1) - IST_OFFSET_MS;
  const prevMonthEndMs = monthStartMs - 1;

  return {
    todayStart: new Date(todayStartMs),
    tomorrowStart: new Date(tomorrowStartMs),
    yesterdayStart: new Date(yesterdayStartMs),
    monthStart: new Date(monthStartMs),
    nextMonthStart: new Date(nextMonthStartMs),
    prevMonthStart: new Date(prevMonthStartMs),
    prevMonthEnd: new Date(prevMonthEndMs)
  };
};

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
exports.getStats = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    // Use fixed IST boundaries for business-day metrics regardless of server timezone.
    const {
      todayStart,
      tomorrowStart,
      yesterdayStart,
      monthStart,
      nextMonthStart,
      prevMonthStart,
      prevMonthEnd
    } = getISTDateRanges();
    const nonCancelledInvoiceQuery = { tenantId, status: { $ne: 'Cancelled' } };

    // Helper function to calculate percentage change
    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    };

    // Run ALL queries in parallel for maximum performance
    const [
      totalProducts,
      totalCustomers,
      totalInvoices,
      totalInvoiceAmountAgg,
      todayInvoices,
      yesterdayInvoices,
      todaySalesAgg,
      yesterdaySalesAgg,
      monthSalesAgg,
      prevMonthSalesAgg,
      prevMonthProducts,
      prevMonthCustomers,
      lowStockCount,
      recentInvoices
    ] = await Promise.all([
      // Total counts
      Product.countDocuments({ tenantId, isActive: true }),
      Customer.countDocuments({ tenantId, isActive: true }),
      Invoice.countDocuments(nonCancelledInvoiceQuery),
      Invoice.aggregate([
        { $match: nonCancelledInvoiceQuery },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]),
      
      // Today's invoices
      Invoice.countDocuments({ invoiceDate: { $gte: todayStart, $lt: tomorrowStart }, ...nonCancelledInvoiceQuery }),
      
      // Yesterday's invoices
      Invoice.countDocuments({ invoiceDate: { $gte: yesterdayStart, $lt: todayStart }, ...nonCancelledInvoiceQuery }),
      
      // Today's sales
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: todayStart, $lt: tomorrowStart }, ...nonCancelledInvoiceQuery } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]),
      
      // Yesterday's sales
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: yesterdayStart, $lt: todayStart }, ...nonCancelledInvoiceQuery } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]),
      
      // This month's sales
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: monthStart, $lt: nextMonthStart }, ...nonCancelledInvoiceQuery } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]),
      
      // Previous month's sales
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: prevMonthStart, $lt: monthStart }, ...nonCancelledInvoiceQuery } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]),
      
      // Previous month's counts
      Product.countDocuments({ tenantId, isActive: true, createdAt: { $lte: prevMonthEnd } }),
      Customer.countDocuments({ tenantId, isActive: true, createdAt: { $lte: prevMonthEnd } }),
      
      // Low stock count
      Product.countDocuments({ tenantId, isActive: true, currentStockQty: { $lte: LOW_STOCK_THRESHOLD } }),
      
      // Recent invoices
      Invoice.find(nonCancelledInvoiceQuery)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('invoiceNumber invoiceDate customer.customerName totals.netTotal status')
    ]);

    // Extract aggregation results
    const totalInvoiceAmount = totalInvoiceAmountAgg[0]?.total || 0;
    const todaySales = todaySalesAgg[0]?.total || 0;
    const yesterdaySales = yesterdaySalesAgg[0]?.total || 0;
    const monthSales = monthSalesAgg[0]?.total || 0;
    const prevMonthSales = prevMonthSalesAgg[0]?.total || 0;

    // Calculate growth percentages
    const growth = {
      totalProducts: calculateGrowth(totalProducts, prevMonthProducts),
      totalCustomers: calculateGrowth(totalCustomers, prevMonthCustomers),
      todaySales: calculateGrowth(todaySales, yesterdaySales),
      monthSales: calculateGrowth(monthSales, prevMonthSales),
      todayInvoices: calculateGrowth(todayInvoices, yesterdayInvoices)
    };

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        totalCustomers,
        totalInvoices,
        totalInvoiceAmount,
        todayInvoices,
        todaySales,
        monthSales,
        lowStockCount,
        growth
      },
      recentInvoices
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get low stock products
// @route   GET /api/dashboard/low-stock
// @access  Private
exports.getLowStock = async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold) || LOW_STOCK_THRESHOLD;
    const tenantId = getTenantId(req);

    const products = await Product.find({
      tenantId,
      isActive: true,
      currentStockQty: { $lte: threshold }
    })
    .sort({ currentStockQty: 1 })
    .limit(10)
    .select('productName currentStockQty unit');

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get invoice count for date range
// @route   GET /api/dashboard/invoice-count
// @access  Private
exports.getInvoiceCount = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const tenantId = getTenantId(req);
    
    const query = { tenantId };
    
    
    if (startDate && endDate) {
      query.invoiceDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    query.status = { $ne: 'Cancelled' };
    
    const count = await Invoice.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    next(error);
  }
};
