const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const ManualEntry = require('../models/ManualEntry');
const { getAttribution } = require('../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../utils/activityTracker');

// Round to 2 decimal places safely
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// @desc    Get daily collections summary + payment list
// @route   GET /api/payments/collections
// @access  Private
exports.getCollections = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    // Build date range
    let startOfDay, endOfDay;
    if (req.query.date) {
      const d = new Date(req.query.date);
      startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    } else if (req.query.startDate || req.query.endDate) {
      if (req.query.startDate) {
        const s = new Date(req.query.startDate);
        startOfDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      }
      if (req.query.endDate) {
        const e = new Date(req.query.endDate);
        endOfDay = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
      }
    } else {
      const today = new Date();
      startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    }

    // Build payment query
    const paymentQuery = {};
    const paymentMatch = {};
    if (startOfDay || endOfDay) {
      paymentQuery.paymentDate = {};
      paymentMatch.paymentDate = {};
      if (startOfDay) { paymentQuery.paymentDate.$gte = startOfDay; paymentMatch.paymentDate.$gte = startOfDay; }
      if (endOfDay) { paymentQuery.paymentDate.$lt = endOfDay; paymentMatch.paymentDate.$lt = endOfDay; }
    }
    if (req.query.paymentMethod) {
      paymentQuery.paymentMethod = req.query.paymentMethod;
      paymentMatch.paymentMethod = req.query.paymentMethod;
    }
    if (req.query.customerId) {
      const mongoose = require('mongoose');
      paymentQuery.customer = new mongoose.Types.ObjectId(req.query.customerId);
      paymentMatch.customer = paymentQuery.customer;
    }

    // Build manual entry query (payment_adjustment and credit_adjustment)
    const meQuery = {
      entryType: { $in: ['payment_adjustment', 'credit_adjustment'] }
    };
    if (startOfDay || endOfDay) {
      meQuery.entryDate = {};
      if (startOfDay) meQuery.entryDate.$gte = startOfDay;
      if (endOfDay) meQuery.entryDate.$lt = endOfDay;
    }
    if (req.query.paymentMethod) {
      meQuery.paymentMethod = req.query.paymentMethod;
    }
    if (req.query.customerId) {
      const mongoose = require('mongoose');
      meQuery.customer = new mongoose.Types.ObjectId(req.query.customerId);
    }

    // Run all queries in parallel
    const [summaryResult, payments, manualEntries] = await Promise.all([
      Payment.aggregate([
        { $match: paymentMatch },
        {
          $facet: {
            totals: [{ $group: { _id: null, totalCollected: { $sum: '$amount' }, paymentCount: { $sum: 1 } } }],
            byMethod: [{ $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } }]
          }
        }
      ]),
      Payment.find(paymentQuery)
        .populate('customer', 'customerName phone')
        .populate('invoice', 'invoiceNumber totals.netTotal')
        .sort({ paymentDate: -1, createdAt: -1 })
        .lean(),
      ManualEntry.find(meQuery)
        .populate('customer', 'customerName phone')
        .lean()
    ]);

    // Process payment aggregation
    const payTotals = summaryResult[0]?.totals[0] || { totalCollected: 0, paymentCount: 0 };
    const byMethodArray = summaryResult[0]?.byMethod || [];

    // Merge manual entry payments into totals and byMethod
    let meTotalCollected = 0;
    let mePaymentCount = manualEntries.length;
    const meByMethod = {};

    for (const me of manualEntries) {
      meTotalCollected += me.amount;
      const method = me.paymentMethod || 'Cash';
      if (!meByMethod[method]) meByMethod[method] = { count: 0, total: 0 };
      meByMethod[method].count += 1;
      meByMethod[method].total += me.amount;
    }

    // Merge byMethod from both sources
    const byMethod = {};
    for (const m of byMethodArray) {
      byMethod[m._id] = { count: m.count, total: round2(m.total) };
    }
    for (const [method, info] of Object.entries(meByMethod)) {
      if (byMethod[method]) {
        byMethod[method].count += info.count;
        byMethod[method].total = round2(byMethod[method].total + info.total);
      } else {
        byMethod[method] = { count: info.count, total: round2(info.total) };
      }
    }

    // Normalize manual entries to look like payments for frontend
    const normalizedME = manualEntries.map(me => ({
      _id: me._id,
      paymentDate: me.entryDate,
      amount: me.amount,
      paymentMethod: me.paymentMethod || 'Cash',
      referenceNumber: me.referenceNumber || '',
      notes: me.description || me.notes || '',
      customer: me.customer,
      invoice: null,
      invoiceSnapshot: null,
      isManualEntry: true,
      entryType: me.entryType,
      description: me.description
    }));

    // Merge and sort all payments by date descending
    const allPayments = [...payments, ...normalizedME]
      .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    const total = allPayments.length;
    const paginatedPayments = allPayments.slice((page - 1) * limit, page * limit);

    res.status(200).json({
      success: true,
      summary: {
        totalCollected: round2(payTotals.totalCollected + meTotalCollected),
        paymentCount: payTotals.paymentCount + mePaymentCount,
        byMethod
      },
      count: paginatedPayments.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      payments: paginatedPayments
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

    // Validate invoice exists
    const invoice = await Invoice.findById(invoiceId);
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

    // Calculate remaining amount (handle undefined paidAmount for old invoices)
    const remainingAmount = invoice.totals.netTotal - (invoice.paidAmount || 0);
    
    // Validate payment amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }

    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${amount}) exceeds remaining balance (₹${remainingAmount})`
      });
    }

    // Create payment record
    const payment = await Payment.create({
      invoice: invoiceId,
      customer: invoice.customer._id,
      amount,
      paymentDate: paymentDate || new Date(),
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
    const newPaidAmount = (invoice.paidAmount || 0) + amount;
    const newPaymentStatus = newPaidAmount >= invoice.totals.netTotal ? 'Paid' : 'Partial';

    await Invoice.findByIdAndUpdate(invoiceId, {
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus
    });

    // Update customer outstanding balance (decrease by payment amount, but don't go below 0)
    const customer = await Customer.findById(invoice.customer._id);
    const currentBalance = customer?.outstandingBalance || 0;
    const newBalance = Math.max(0, currentBalance - amount);
    await Customer.findByIdAndUpdate(invoice.customer._id, {
      outstandingBalance: newBalance
    });

    // Track employee activity
    trackActivity(req, ACTIVITY_TYPES.PAYMENT_RECORDED, amount);

    res.status(201).json({
      success: true,
      payment,
      invoiceUpdate: {
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus,
        remainingAmount: invoice.totals.netTotal - newPaidAmount
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

    const query = {};

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
    const payment = await Payment.findById(req.params.id)
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
    const payments = await Payment.find({ customer: req.params.customerId })
      .populate('invoice', 'invoiceNumber invoiceDate totals.netTotal')
      .sort({ paymentDate: -1 })
      .limit(100);

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      success: true,
      count: payments.length,
      totalPaid,
      payments
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
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const payments = await Payment.find({ invoice: req.params.invoiceId })
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

// @desc    Delete/reverse a payment
// @route   DELETE /api/payments/:id
// @access  Private
exports.deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Get the invoice
    const invoice = await Invoice.findById(payment.invoice);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Associated invoice not found'
      });
    }

    // Reverse the payment on invoice
    const newPaidAmount = Math.max(0, invoice.paidAmount - payment.amount);
    let newPaymentStatus = 'Unpaid';
    if (newPaidAmount > 0 && newPaidAmount < invoice.totals.netTotal) {
      newPaymentStatus = 'Partial';
    } else if (newPaidAmount >= invoice.totals.netTotal) {
      newPaymentStatus = 'Paid';
    }

    await Invoice.findByIdAndUpdate(payment.invoice, {
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus
    });

    // Increase customer outstanding balance
    await Customer.findByIdAndUpdate(payment.customer, {
      $inc: { outstandingBalance: payment.amount }
    });

    // Delete the payment
    await Payment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Payment deleted and reversed successfully'
    });
  } catch (error) {
    next(error);
  }
};
