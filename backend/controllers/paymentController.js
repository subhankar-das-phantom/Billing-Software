const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const ManualEntry = require('../models/ManualEntry');
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

// @desc    Get daily collections summary + payment list
// @route   GET /api/payments/collections
// @access  Private
exports.getCollections = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const tenantId = getTenantId(req);

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
    const paymentQuery = { tenantId };
    const paymentMatch = { tenantId };
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
      createdAt: me.createdAt,
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

    // Merge and sort all payments by effective event time descending
    const allPayments = [...payments, ...normalizedME]
      .sort((a, b) => getCollectionSortDate(b) - getCollectionSortDate(a));

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

    // Calculate remaining amount (handle undefined paidAmount for old invoices)
    // Use round2 to avoid floating-point precision drift (e.g. 0.01 vs 0.009999...)
    const remainingAmount = round2(getRoundedNumber(invoice.totals.netTotal) - getRoundedNumber(invoice.paidAmount));
    const normalizedAmount = getRoundedNumber(amount);
    
    // Validate payment amount
    if (normalizedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }

    if (normalizedAmount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${normalizedAmount}) exceeds remaining balance (₹${remainingAmount})`
      });
    }

    // Create payment record
    const payment = await Payment.create({
      tenantId,
      invoice: invoiceId,
      customer: invoice.customer._id,
      amount: normalizedAmount,
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
    const newPaidAmount = getRoundedNumber(getRoundedNumber(invoice.paidAmount) + normalizedAmount);
    const newPaymentStatus = derivePaymentStatus(invoice.totals.netTotal, newPaidAmount);

    await Invoice.findByIdAndUpdate(invoiceId, {
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus
    });

    // Update customer outstanding balance (decrease by payment amount, but don't go below 0)
    const customer = await Customer.findById(invoice.customer._id);
    const currentBalance = getRoundedNumber(customer?.outstandingBalance);
    const newBalance = Math.max(0, round2(currentBalance - normalizedAmount));
    await Customer.findByIdAndUpdate(invoice.customer._id, {
      outstandingBalance: newBalance
    });

    // Track employee activity
    trackActivity(req, ACTIVITY_TYPES.PAYMENT_RECORDED, normalizedAmount);

    res.status(201).json({
      success: true,
      payment,
      invoiceUpdate: {
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus,
        remainingAmount: round2(getRoundedNumber(invoice.totals.netTotal) - newPaidAmount)
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
    const tenantId = getTenantId(req);
    const payments = await Payment.find({ tenantId, customer: req.params.customerId })
      .populate('invoice', 'invoiceNumber invoiceDate totals.netTotal paidAmount paymentType')
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

// @desc    Update a payment
// @route   PUT /api/payments/:id
// @access  Private
exports.updatePayment = async (req, res, next) => {
  try {
    const { amount, paymentDate, paymentMethod, referenceNumber, notes } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const invoice = await Invoice.findById(payment.invoice);
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
        const newPaidAmount = round2(getRoundedNumber(invoice.paidAmount) + delta);
        const newPaymentStatus = derivePaymentStatus(invoice.totals.netTotal, newPaidAmount);

        await Invoice.findByIdAndUpdate(invoice._id, {
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus
        });

        // Update customer outstanding balance (for Credit invoices)
        if (invoice.paymentType === 'Credit') {
          const customer = await Customer.findById(payment.customer);
          const currentBalance = getRoundedNumber(customer?.outstandingBalance);
          // delta > 0 means more paid → reduce outstanding
          // delta < 0 means less paid → increase outstanding
          const newBalance = Math.max(0, round2(currentBalance - delta));
          await Customer.findByIdAndUpdate(payment.customer, {
            outstandingBalance: newBalance
          });
        }
      }

      payment.amount = newAmount;
    }

    // Update other fields if provided
    if (paymentDate !== undefined) payment.paymentDate = paymentDate;
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
    const invoice = await Invoice.findById(payment.invoice);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Associated invoice not found'
      });
    }

    // Reverse the payment on invoice
    const newPaidAmount = Math.max(0, round2(getRoundedNumber(invoice.paidAmount) - getRoundedNumber(payment.amount)));
    const newPaymentStatus = derivePaymentStatus(invoice.totals.netTotal, newPaidAmount);

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

