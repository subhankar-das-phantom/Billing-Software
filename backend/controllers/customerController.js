const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const CreditNote = require('../models/CreditNote');
const ManualEntry = require('../models/ManualEntry');
const { getAttribution } = require('../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../utils/activityTracker');

// Escape special regex characters in user input to prevent MongoDB $regex errors
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Round to 2 decimal places safely (avoids JS floating point drift)
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// @desc    Get customer ledger (merged financial history)
// @route   GET /api/customers/:id/ledger
// @access  Private
exports.getCustomerLedger = async (req, res, next) => {
  try {
    const customerId = req.params.id;

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Fetch all data sources in parallel
    const [invoices, payments, creditNotes, manualEntries] = await Promise.all([
      Invoice.find({ 'customer._id': customerId, status: { $ne: 'Cancelled' } })
        .select('invoiceNumber invoiceDate totals.netTotal items paymentStatus paidAmount')
        .lean(),
      Payment.find({ customer: customerId })
        .populate('invoice', 'invoiceNumber')
        .lean(),
      CreditNote.find({ 'customer._id': customerId })
        .select('creditNoteNumber invoiceNumber totals.netTotal createdAt')
        .lean(),
      ManualEntry.find({ customer: customerId })
        .lean()
    ]);

    // Build ledger entries array
    const entries = [];

    // 1. Invoices → Debit (use invoiceDate as transaction date)
    for (const inv of invoices) {
      const productSummary = (inv.items || [])
        .map(i => i.product?.productName || 'Product')
        .slice(0, 3)
        .join(', ');
      const suffix = inv.items?.length > 3 ? ` +${inv.items.length - 3} more` : '';

      entries.push({
        date: inv.invoiceDate,
        type: 'Invoice',
        ref: inv.invoiceNumber,
        description: productSummary + suffix || 'Invoice',
        debit: round2(inv.totals?.netTotal || 0),
        credit: 0,
        linkId: inv._id,
        linkType: 'invoice'
      });
    }

    // 2. Payments → Credit (use paymentDate as transaction date)
    for (const pay of payments) {
      entries.push({
        date: pay.paymentDate,
        type: 'Payment',
        ref: pay.invoiceSnapshot?.invoiceNumber || pay.invoice?.invoiceNumber || '-',
        description: `${pay.paymentMethod}${pay.referenceNumber ? ' • ' + pay.referenceNumber : ''}${pay.notes ? ' — ' + pay.notes : ''}`,
        debit: 0,
        credit: round2(pay.amount),
        linkId: pay.invoice?._id || pay.invoice,
        linkType: 'payment'
      });
    }

    // 3. Credit Notes → Credit (use createdAt since no dedicated date field)
    for (const cn of creditNotes) {
      entries.push({
        date: cn.createdAt,
        type: 'Credit Note',
        ref: cn.creditNoteNumber,
        description: `Return against ${cn.invoiceNumber}`,
        debit: 0,
        credit: round2(cn.totals?.netTotal || 0),
        linkId: cn._id,
        linkType: 'creditNote'
      });
    }

    // 4. Manual Entries (use entryDate as transaction date)
    for (const me of manualEntries) {
      let debit = 0;
      let credit = 0;
      let type = '';

      switch (me.entryType) {
        case 'opening_balance':
          type = 'Opening Balance';
          debit = round2(me.amount);
          break;
        case 'manual_bill':
          type = 'Manual Bill';
          debit = round2(me.amount);
          break;
        case 'payment_adjustment':
          type = 'Payment Adjustment';
          credit = round2(me.amount);
          break;
        case 'credit_adjustment':
          type = 'Credit Adjustment';
          credit = round2(me.amount);
          break;
        default:
          type = me.entryType;
          debit = round2(me.amount);
      }

      entries.push({
        date: me.entryDate,
        type,
        ref: `ME-${me._id.toString().slice(-6).toUpperCase()}`,
        description: me.description || type,
        debit,
        credit,
        linkId: me._id,
        linkType: 'manualEntry'
      });
    }

    // CRITICAL: Sort by date ASCENDING before computing running balance
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Compute running balance
    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    for (const entry of entries) {
      runningBalance = round2(runningBalance + entry.debit - entry.credit);
      entry.balance = runningBalance;
      totalDebit = round2(totalDebit + entry.debit);
      totalCredit = round2(totalCredit + entry.credit);
    }

    res.status(200).json({
      success: true,
      count: entries.length,
      ledger: entries,
      summary: {
        totalDebit,
        totalCredit,
        closingBalance: round2(totalDebit - totalCredit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
exports.getCustomers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {};
    
    // Only filter by isActive if includeInactive is not set
    if (req.query.includeInactive !== 'true') {
      query.isActive = true;
    }

    // Search
    if (req.query.search) {
      const escaped = escapeRegex(req.query.search);
      query.$or = [
        { customerName: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { gstin: { $regex: escaped, $options: 'i' } }
      ];
    }

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Customer.countDocuments(query);

    res.status(200).json({
      success: true,
      count: customers.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      customers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search customers
// @route   GET /api/customers/search
// @access  Private
exports.searchCustomers = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Please provide search query'
      });
    }

    const customers = await Customer.find({
      isActive: true,
      $or: [
        { customerName: { $regex: escapeRegex(q), $options: 'i' } },
        { phone: { $regex: escapeRegex(q), $options: 'i' } },
        { gstin: { $regex: escapeRegex(q), $options: 'i' } }
      ]
    }).limit(10);

    res.status(200).json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer with invoices
// @route   GET /api/customers/:id
// @access  Private
exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer's invoices
    const invoices = await Invoice.find({ 'customer._id': customer._id })
      .sort({ invoiceDate: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      customer,
      invoices
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
exports.createCustomer = async (req, res, next) => {
  try {
    const {
      customerName,
      address,
      phone,
      email,
      gstin,
      dlNo,
      customerCode
    } = req.body;

    const customer = await Customer.create({
      customerName,
      address,
      phone,
      email,
      gstin,
      dlNo,
      customerCode,
      createdBy: getAttribution(req)
    });

    // Track employee activity
    trackActivity(req, ACTIVITY_TYPES.CUSTOMER_ADDED);

    res.status(201).json({
      success: true,
      customer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
exports.updateCustomer = async (req, res, next) => {
  try {
    let customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const {
      customerName,
      address,
      phone,
      email,
      gstin,
      dlNo,
      customerCode
    } = req.body;

    customer = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        customerName,
        address,
        phone,
        email,
        gstin,
        dlNo,
        customerCode
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      customer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete customer (soft delete)
// @route   DELETE /api/customers/:id
// @access  Private
exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    customer.isActive = false;
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
