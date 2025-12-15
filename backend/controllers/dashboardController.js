const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { LOW_STOCK_THRESHOLD } = require('../config/constants');

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
exports.getStats = async (req, res, next) => {
  try {
    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

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
      Product.countDocuments({ isActive: true }),
      Customer.countDocuments({ isActive: true }),
      Invoice.countDocuments(),
      
      // Today's invoices
      Invoice.countDocuments({ invoiceDate: { $gte: today, $lt: tomorrow } }),
      
      // Yesterday's invoices
      Invoice.countDocuments({ invoiceDate: { $gte: yesterday, $lt: today } }),
      
      // Today's sales
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]),
      
      // Yesterday's sales
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: yesterday, $lt: today } } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]),
      
      // This month's sales
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]),
      
      // Previous month's sales
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$totals.netTotal' } } }
      ]),
      
      // Previous month's counts
      Product.countDocuments({ isActive: true, createdAt: { $lte: prevMonthEnd } }),
      Customer.countDocuments({ isActive: true, createdAt: { $lte: prevMonthEnd } }),
      
      // Low stock count
      Product.countDocuments({ isActive: true, currentStockQty: { $lte: LOW_STOCK_THRESHOLD } }),
      
      // Recent invoices
      Invoice.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('invoiceNumber invoiceDate customer.customerName totals.netTotal')
    ]);

    // Extract aggregation results
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

    const products = await Product.find({
      isActive: true,
      currentStockQty: { $lte: threshold }
    })
    .sort({ currentStockQty: 1 })
    .limit(10)
    .select('productName currentStockQty unit batchNo expiryDate');

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
    
    const query = {};
    
    if (startDate && endDate) {
      query.invoiceDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const count = await Invoice.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    next(error);
  }
};
