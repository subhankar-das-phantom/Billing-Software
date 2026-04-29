const ManualEntry = require('../models/ManualEntry');
const Customer = require('../models/Customer');
const { getAttribution } = require('../middleware/auth');
const getTenantId = require('../utils/getTenantId');

/**
 * @desc    Create a new manual entry
 * @route   POST /api/manual-entries
 * @access  Private
 */
exports.createManualEntry = async (req, res, next) => {
  try {
    const { customerId, entryType, paymentType, amount, entryDate, description, notes } = req.body;
    const tenantId = getTenantId(req);

    // Validate customer exists
    const customer = await Customer.findOne({ _id: customerId, tenantId });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Calculate financial impact based on entry type and payment type
    let outstandingChange = 0;
    let totalPurchasesChange = 0;

    switch (entryType) {
      case 'opening_balance':
      case 'manual_bill':
        // Works like invoices: Cash = purchases only, Credit = purchases + outstanding
        totalPurchasesChange = amount;
        if (paymentType === 'Credit') {
          outstandingChange = amount;
        }
        break;

      case 'payment_adjustment':
        // Always decreases outstanding (payment received)
        outstandingChange = -amount;
        break;

      case 'credit_adjustment':
        // Decreases outstanding (correction/discount)
        outstandingChange = -amount;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid entry type'
        });
    }

    // Create the manual entry
    const manualEntry = await ManualEntry.create({
      tenantId,
      customer: customerId,
      entryType,
      paymentType,
      amount,
      entryDate: entryDate || new Date(),
      description,
      notes: notes || '',
      affectInventory: false,
      excludeFromAnalytics: true,
      customerSnapshot: {
        customerName: customer.customerName,
        phone: customer.phone,
        outstandingBefore: customer.outstandingBalance || 0
      },
      createdBy: getAttribution(req)
    });

    // Update customer balances
    const incrementFields = {};
    if (outstandingChange !== 0) {
      incrementFields.outstandingBalance = outstandingChange;
    }
    if (totalPurchasesChange !== 0) {
      incrementFields.totalPurchases = totalPurchasesChange;
    }

    if (Object.keys(incrementFields).length > 0) {
      await Customer.findByIdAndUpdate(
        customerId, 
        { $inc: incrementFields },
        { new: true }
      );
    }

    // Fetch updated customer for response
    const updatedCustomer = await Customer.findById(customerId);

    res.status(201).json({
      success: true,
      manualEntry,
      customerBalance: {
        outstandingBalance: updatedCustomer.outstandingBalance,
        totalPurchases: updatedCustomer.totalPurchases
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all manual entries
 * @route   GET /api/manual-entries
 * @access  Private
 */
exports.getManualEntries = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const tenantId = getTenantId(req);

    const query = { tenantId };

    // Search by customer name or phone
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { 'customerSnapshot.customerName': searchRegex },
        { 'customerSnapshot.phone': searchRegex }
      ];
    }

    // Filter by customer
    if (req.query.customerId) {
      query.customer = req.query.customerId;
    }

    // Filter by entry type
    if (req.query.entryType) {
      query.entryType = req.query.entryType;
    }

    // Filter by date range
    if (req.query.startDate || req.query.endDate) {
      query.entryDate = {};
      if (req.query.startDate) {
        query.entryDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.entryDate.$lte = new Date(req.query.endDate);
      }
    }

    const manualEntries = await ManualEntry.find(query)
      .populate('customer', 'customerName phone')
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ManualEntry.countDocuments(query);

    res.status(200).json({
      success: true,
      manualEntries,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single manual entry
 * @route   GET /api/manual-entries/:id
 * @access  Private
 */
exports.getManualEntry = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const manualEntry = await ManualEntry.findOne({
      _id: req.params.id,
      tenantId
    })
      .populate('customer', 'customerName phone outstandingBalance');

    if (!manualEntry) {
      return res.status(404).json({
        success: false,
        message: 'Manual entry not found'
      });
    }

    res.status(200).json({
      success: true,
      manualEntry
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get manual entries for a specific customer
 * @route   GET /api/manual-entries/customer/:customerId
 * @access  Private
 */
exports.getManualEntriesByCustomer = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const manualEntries = await ManualEntry.find({ tenantId, customer: req.params.customerId })
      .sort({ entryDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      manualEntries
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unpaid opening balance entries for a customer
 * @route   GET /api/manual-entries/customer/:customerId/unpaid
 * @access  Private
 */
exports.getUnpaidOpeningBalances = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const manualEntries = await ManualEntry.find({
      tenantId,
      customer: req.params.customerId,
      entryType: 'opening_balance',
      paymentType: 'Credit'
    }).sort({ entryDate: -1 });

    // Filter to only those with remaining balance
    const unpaidEntries = manualEntries.filter(entry => {
      const remaining = entry.amount - (entry.paidAmount || 0);
      return remaining > 0;
    });

    res.status(200).json({
      success: true,
      manualEntries: unpaidEntries
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record payment against an opening balance entry
 * @route   POST /api/manual-entries/:id/payment
 * @access  Private
 */
exports.recordPaymentAgainstEntry = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const manualEntry = await ManualEntry.findOne({
      _id: req.params.id,
      tenantId
    });

    if (!manualEntry) {
      return res.status(404).json({
        success: false,
        message: 'Manual entry not found'
      });
    }

    // Only allow payments for opening_balance or manual_bill with Credit type
    if (manualEntry.paymentType !== 'Credit' || 
        (manualEntry.entryType !== 'opening_balance' && manualEntry.entryType !== 'manual_bill')) {
      return res.status(400).json({
        success: false,
        message: 'This entry type cannot accept payments'
      });
    }

    const { amount, paymentDate, paymentMethod, referenceNumber, notes } = req.body;

    // Check if fully paid
    if (manualEntry.amount <= (manualEntry.paidAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: 'This entry is already fully paid'
      });
    }

    // Calculate remaining balance
    const remainingBalance = manualEntry.amount - (manualEntry.paidAmount || 0);

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }

    if (amount > remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Payment amount cannot exceed remaining balance (₹${remainingBalance})`
      });
    }

    // 1. Update the original manual entry's paid amount
    manualEntry.paidAmount = (manualEntry.paidAmount || 0) + amount;
    await manualEntry.save();

    // 2. Create a new "payment_adjustment" entry to track this payment
    const customer = await Customer.findById(manualEntry.customer);

    const paymentEntry = await ManualEntry.create({
      tenantId,
      customer: manualEntry.customer,
      entryType: 'payment_adjustment',
      paymentType: 'Cash',
      amount: amount,
      entryDate: paymentDate || new Date(),
      description: `Payment for ${manualEntry.entryType === 'opening_balance' ? 'Opening Balance' : 'Manual Bill'}`,
      notes: notes || '',
      paymentMethod: paymentMethod || 'Cash',
      referenceNumber: referenceNumber || '',
      parentEntry: manualEntry._id,
      customerSnapshot: {
        customerName: customer.customerName,
        phone: customer.phone,
        outstandingBefore: customer.outstandingBalance || 0
      },
      createdBy: getAttribution(req)
    });

    // 3. Update customer outstanding balance (decrease)
    const updatedCustomer = await Customer.findByIdAndUpdate(
      manualEntry.customer, 
      { $inc: { outstandingBalance: -amount } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      manualEntry,
      paymentEntry,
      newRemainingBalance: manualEntry.amount - manualEntry.paidAmount,
      customerOutstandingBalance: updatedCustomer.outstandingBalance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a manual entry (amount, date, description, notes, paymentMethod)
 * @route   PUT /api/manual-entries/:id
 * @access  Private/Admin
 */
exports.updateManualEntry = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const manualEntry = await ManualEntry.findOne({
      _id: req.params.id,
      tenantId
    });

    if (!manualEntry) {
      return res.status(404).json({
        success: false,
        message: 'Manual entry not found'
      });
    }

    const { amount, entryDate, description, notes, paymentMethod, referenceNumber } = req.body;

    // Calculate reverse of OLD financial impact
    let oldOutstandingChange = 0;
    let oldTotalPurchasesChange = 0;
    switch (manualEntry.entryType) {
      case 'opening_balance':
      case 'manual_bill':
        oldTotalPurchasesChange = manualEntry.amount;
        if (manualEntry.paymentType === 'Credit') {
          oldOutstandingChange = manualEntry.amount;
        }
        break;
      case 'payment_adjustment':
        oldOutstandingChange = -manualEntry.amount;
        break;
      case 'credit_adjustment':
        oldOutstandingChange = -manualEntry.amount;
        break;
    }

    // Update fields
    if (amount !== undefined && amount > 0) manualEntry.amount = amount;
    if (entryDate !== undefined) manualEntry.entryDate = entryDate;
    if (description !== undefined) manualEntry.description = description;
    if (notes !== undefined) manualEntry.notes = notes;
    if (paymentMethod !== undefined) manualEntry.paymentMethod = paymentMethod;
    if (referenceNumber !== undefined) manualEntry.referenceNumber = referenceNumber;

    // Calculate NEW financial impact
    let newOutstandingChange = 0;
    let newTotalPurchasesChange = 0;
    switch (manualEntry.entryType) {
      case 'opening_balance':
      case 'manual_bill':
        newTotalPurchasesChange = manualEntry.amount;
        if (manualEntry.paymentType === 'Credit') {
          newOutstandingChange = manualEntry.amount;
        }
        break;
      case 'payment_adjustment':
        newOutstandingChange = -manualEntry.amount;
        break;
      case 'credit_adjustment':
        newOutstandingChange = -manualEntry.amount;
        break;
    }

    // Compute deltas (new impact - old impact)
    const outstandingDelta = newOutstandingChange - oldOutstandingChange;
    const totalPurchasesDelta = newTotalPurchasesChange - oldTotalPurchasesChange;

    await manualEntry.save();

    // If this is a payment_adjustment linked to a parent (opening_balance/manual_bill),
    // update the parent's paidAmount by the amount delta
    if (manualEntry.parentEntry && manualEntry.entryType === 'payment_adjustment' && amount !== undefined) {
      // For payment_adjustment: oldOutstanding = -oldAmount, newOutstanding = -newAmount
      // paymentDelta = newAmount - oldAmount
      const paymentDelta = (-newOutstandingChange) - (-oldOutstandingChange);
      if (paymentDelta !== 0) {
        await ManualEntry.findOneAndUpdate(
          { _id: manualEntry.parentEntry, tenantId },
          { $inc: { paidAmount: paymentDelta } }
        );
      }
    }

    // Update customer balances by delta
    const incrementFields = {};
    if (outstandingDelta !== 0) incrementFields.outstandingBalance = outstandingDelta;
    if (totalPurchasesDelta !== 0) incrementFields.totalPurchases = totalPurchasesDelta;

    if (Object.keys(incrementFields).length > 0) {
      await Customer.findByIdAndUpdate(
        manualEntry.customer,
        { $inc: incrementFields }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Manual entry updated successfully',
      manualEntry
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete manual entry (admin only)
 * @route   DELETE /api/manual-entries/:id
 * @access  Private/Admin
 */
exports.deleteManualEntry = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const manualEntry = await ManualEntry.findOne({
      _id: req.params.id,
      tenantId
    });

    if (!manualEntry) {
      return res.status(404).json({
        success: false,
        message: 'Manual entry not found'
      });
    }

    // Calculate the reverse of financial impact
    let outstandingChange = 0;
    let totalPurchasesChange = 0;

    switch (manualEntry.entryType) {
      case 'opening_balance':
      case 'manual_bill':
        totalPurchasesChange = -manualEntry.amount;
        if (manualEntry.paymentType === 'Credit') {
          const remaining = manualEntry.amount - (manualEntry.paidAmount || 0);
          outstandingChange = -remaining;
        }
        break;

      case 'payment_adjustment':
        outstandingChange = manualEntry.amount;
        break;

      case 'credit_adjustment':
        outstandingChange = manualEntry.amount;
        break;
    }

    // Update customer balances
    const incrementFields = {};
    if (outstandingChange !== 0) {
      incrementFields.outstandingBalance = outstandingChange;
    }
    if (totalPurchasesChange !== 0) {
      incrementFields.totalPurchases = totalPurchasesChange;
    }

    if (Object.keys(incrementFields).length > 0) {
      await Customer.findByIdAndUpdate(
        manualEntry.customer,
        { $inc: incrementFields }
      );
    }

    // If this is a payment_adjustment linked to a parent, reduce the parent's paidAmount
    if (manualEntry.parentEntry && manualEntry.entryType === 'payment_adjustment') {
      await ManualEntry.findOneAndUpdate(
        { _id: manualEntry.parentEntry, tenantId },
        { $inc: { paidAmount: -manualEntry.amount } }
      );
    }

    await manualEntry.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Manual entry deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
