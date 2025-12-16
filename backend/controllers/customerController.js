const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');

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
      query.$or = [
        { customerName: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } },
        { gstin: { $regex: req.query.search, $options: 'i' } }
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
        { customerName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { gstin: { $regex: q, $options: 'i' } }
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
      customerCode
    });

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
