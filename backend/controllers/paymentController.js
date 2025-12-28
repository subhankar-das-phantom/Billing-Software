const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');

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
      createdBy: req.admin._id
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
