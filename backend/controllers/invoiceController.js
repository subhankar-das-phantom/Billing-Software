const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Batch = require('../models/Batch');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');
const { calculateItemAmounts, calculateInvoiceTotals } = require('../utils/invoiceCalculator');
const { numberToWords } = require('../utils/numberToWords');
const { generateInvoiceExcel, generateInvoiceCSV } = require('../utils/excelExport');
const { getAttribution } = require('../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../utils/activityTracker');
const { consumeStock, restoreStock } = require('../utils/fifoService');

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {};

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      query.invoiceDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    const invoices = await Invoice.find(query)
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      count: invoices.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      invoices
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.status(200).json({
      success: true,
      invoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get invoices by customer
// @route   GET /api/invoices/customer/:customerId
// @access  Private
exports.getCustomerInvoices = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const invoices = await Invoice.find({ 'customer._id': req.params.customerId })
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Invoice.countDocuments({ 'customer._id': req.params.customerId });

    res.status(200).json({
      success: true,
      count: invoices.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      invoices
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create invoice
// @route   POST /api/invoices
// @access  Private
exports.createInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerId, items, paymentType, notes } = req.body;

    // Validate customer
    const customer = await Customer.findById(customerId).session(session);
    if (!customer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get admin for distributor info (always use Admin model for firm settings)
    // If user is employee, we need to fetch the admin for firm info
    let adminInfo;
    if (req.userRole === 'admin') {
      adminInfo = await Admin.findById(req.user._id).session(session);
    } else {
      // For employees, get the first admin (firm owner)
      adminInfo = await Admin.findOne().session(session);
    }
    
    if (!adminInfo) {
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        message: 'Firm settings not found'
      });
    }

    // Generate invoice number
    const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 }).session(session);
    let invoiceNumber;
    if (lastInvoice) {
      const lastNum = parseInt(lastInvoice.invoiceNumber.split('-').pop());
      invoiceNumber = `INV-${new Date().getFullYear()}-${String(lastNum + 1).padStart(4, '0')}`;
    } else {
      invoiceNumber = `INV-${new Date().getFullYear()}-0001`;
    }

    // Process items and validate stock
    const processedItems = [];
    const legacyStockUpdates = []; // For pre-migration products without batches

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      
      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      const totalQty = item.quantitySold + (item.freeQuantity || 0);

      // Check if product has batches (new system) or uses legacy stock
      const batchCount = await Batch.countDocuments({ productId: product._id, isActive: true }).session(session);
      const useBatches = batchCount > 0;

      let batchInfo = null; // Will hold FIFO batch info if using batches

      if (useBatches) {
        // NEW PATH: FIFO batch consumption
        try {
          const consumptionRecords = await consumeStock(product._id, totalQty, session);
          // Use the first consumed batch for the invoice item snapshot
          // (for multi-batch consumption, we take the primary batch)
          batchInfo = consumptionRecords[0];
        } catch (err) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `${err.message} for ${product.productName}`
          });
        }
      } else {
        // LEGACY PATH: Use product-level currentStockQty
        if (product.currentStockQty < totalQty) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.productName}. Available: ${product.currentStockQty}, Required: ${totalQty}`
          });
        }

        legacyStockUpdates.push({
          productId: product._id,
          previousQty: product.currentStockQty,
          changeQty: -totalQty,
          newQty: product.currentStockQty - totalQty
        });
      }

      // Calculate amounts
      const rateToUse = item.ratePerUnit || (batchInfo ? batchInfo.purchaseRate : product.rate) || product.newMRP;
      const amounts = calculateItemAmounts(
        item.quantitySold,
        rateToUse,
        product.gstPercentage,
        item.schemeDiscount || 0
      );

      processedItems.push({
        product: {
          _id: product._id,
          productName: product.productName,
          hsnCode: product.hsnCode,
          pack: product.pack,
          batchId: batchInfo ? batchInfo.batchId : undefined,
          batchNo: batchInfo ? batchInfo.batchNo : product.batchNo,
          expiryDate: batchInfo ? batchInfo.expiryDate : product.expiryDate,
          newMRP: batchInfo ? batchInfo.mrp : product.newMRP,
          gstPercentage: product.gstPercentage
        },
        quantitySold: item.quantitySold,
        freeQuantity: item.freeQuantity || 0,
        ratePerUnit: rateToUse,
        schemeDiscount: item.schemeDiscount || 0,
        ...amounts
      });
    }

    // Calculate totals
    const totals = calculateInvoiceTotals(processedItems);
    totals.amountInWords = numberToWords(totals.netTotal);

    // Create invoice
    const invoice = await Invoice.create([{
      invoiceNumber,
      invoiceDate: new Date(),
      customer: {
        _id: customer._id,
        customerName: customer.customerName,
        address: customer.address,
        phone: customer.phone,
        gstin: customer.gstin,
        dlNo: customer.dlNo
      },
      distributor: {
        firmName: adminInfo.firmName,
        firmAddress: adminInfo.firmAddress,
        firmPhone: adminInfo.firmPhone,
        firmGSTIN: adminInfo.firmGSTIN
      },
      items: processedItems,
      totals,
      paymentType: paymentType || 'Credit',
      notes,
      createdBy: getAttribution(req)
    }], { session });

    // Update legacy stock (for products without batches)
    for (const update of legacyStockUpdates) {
      await Product.findByIdAndUpdate(
        update.productId,
        {
          $inc: { currentStockQty: update.changeQty },
          $push: {
            stockHistory: {
              type: 'invoice',
              invoiceId: invoice[0]._id,
              changeQty: update.changeQty,
              previousQty: update.previousQty,
              newQty: update.newQty,
              reference: invoiceNumber,
              timestamp: new Date()
            }
          }
        },
        { session }
      );
    }

    // Update customer stats
    const customerUpdate = {
      $inc: { 
        totalPurchases: totals.netTotal,
        invoiceCount: 1
      },
      lastInvoiceDate: new Date()
    };

    // If Credit invoice, add to outstanding balance
    if (paymentType === 'Credit' || !paymentType) {
      customerUpdate.$inc.outstandingBalance = totals.netTotal;
    }

    await Customer.findByIdAndUpdate(
      customerId,
      customerUpdate,
      { session }
    );

    await session.commitTransaction();

    // Track employee activity
    trackActivity(req, ACTIVITY_TYPES.INVOICE_CREATED, { amount: totals.netTotal });

    res.status(201).json({
      success: true,
      invoice: invoice[0]
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
exports.updateInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerId, items, paymentType, notes } = req.body;

    // Find existing invoice
    const existingInvoice = await Invoice.findById(req.params.id).session(session);
    
    if (!existingInvoice) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Don't allow editing cancelled invoices
    if (existingInvoice.status === 'Cancelled') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a cancelled invoice'
      });
    }

    // Step 1: Reverse stock for old items
    for (const oldItem of existingInvoice.items) {
      const totalQty = oldItem.quantitySold + (oldItem.freeQuantity || 0);
      
      if (oldItem.product.batchId) {
        // NEW PATH: Restore to batch
        await Batch.findByIdAndUpdate(
          oldItem.product.batchId,
          { $inc: { stock: totalQty } },
          { session }
        );
      } else {
        // LEGACY PATH: Restore to product
        await Product.findByIdAndUpdate(
          oldItem.product._id,
          {
            $inc: { currentStockQty: totalQty },
            $push: {
              stockHistory: {
                type: 'invoice_edit_reversal',
                invoiceId: existingInvoice._id,
                changeQty: totalQty,
                reference: `${existingInvoice.invoiceNumber} - Edit Reversal`,
                timestamp: new Date()
              }
            }
          },
          { session }
        );
      }
    }

    // Reverse customer stats for old invoice
    await Customer.findByIdAndUpdate(
      existingInvoice.customer._id,
      {
        $inc: { 
          totalPurchases: -existingInvoice.totals.netTotal
        }
      },
      { session }
    );

    // Step 2: Validate and process new items
    let customer = existingInvoice.customer;
    
    // If customer changed, get new customer details
    if (customerId && customerId !== existingInvoice.customer._id.toString()) {
      const newCustomer = await Customer.findById(customerId).session(session);
      if (!newCustomer) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }
      customer = {
        _id: newCustomer._id,
        customerName: newCustomer.customerName,
        address: newCustomer.address,
        phone: newCustomer.phone,
        gstin: newCustomer.gstin,
        dlNo: newCustomer.dlNo
      };
    }

    const processedItems = [];
    const legacyStockUpdates = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      
      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      const totalQty = item.quantitySold + (item.freeQuantity || 0);

      // Check if product has batches (new system) or uses legacy stock
      const batchCount = await Batch.countDocuments({ productId: product._id, isActive: true }).session(session);
      const useBatches = batchCount > 0;

      let batchInfo = null;

      if (useBatches) {
        try {
          const consumptionRecords = await consumeStock(product._id, totalQty, session);
          batchInfo = consumptionRecords[0];
        } catch (err) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `${err.message} for ${product.productName}`
          });
        }
      } else {
        if (product.currentStockQty < totalQty) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.productName}. Available: ${product.currentStockQty}, Required: ${totalQty}`
          });
        }

        legacyStockUpdates.push({
          productId: product._id,
          previousQty: product.currentStockQty,
          changeQty: -totalQty,
          newQty: product.currentStockQty - totalQty
        });
      }

      // Calculate amounts
      const rateToUse = item.ratePerUnit || (batchInfo ? batchInfo.purchaseRate : product.rate) || product.newMRP;
      const amounts = calculateItemAmounts(
        item.quantitySold,
        rateToUse,
        product.gstPercentage,
        item.schemeDiscount || 0
      );

      processedItems.push({
        product: {
          _id: product._id,
          productName: product.productName,
          hsnCode: product.hsnCode,
          pack: product.pack,
          batchId: batchInfo ? batchInfo.batchId : undefined,
          batchNo: batchInfo ? batchInfo.batchNo : product.batchNo,
          expiryDate: batchInfo ? batchInfo.expiryDate : product.expiryDate,
          newMRP: batchInfo ? batchInfo.mrp : product.newMRP,
          gstPercentage: product.gstPercentage
        },
        quantitySold: item.quantitySold,
        freeQuantity: item.freeQuantity || 0,
        ratePerUnit: rateToUse,
        schemeDiscount: item.schemeDiscount || 0,
        ...amounts
      });
    }

    // Calculate new totals
    const totals = calculateInvoiceTotals(processedItems);
    totals.amountInWords = numberToWords(totals.netTotal);

    // Step 3: Update legacy stock for products without batches
    for (const update of legacyStockUpdates) {
      await Product.findByIdAndUpdate(
        update.productId,
        {
          $inc: { currentStockQty: update.changeQty },
          $push: {
            stockHistory: {
              type: 'invoice_edit',
              invoiceId: existingInvoice._id,
              changeQty: update.changeQty,
              previousQty: update.previousQty,
              newQty: update.newQty,
              reference: existingInvoice.invoiceNumber,
              timestamp: new Date()
            }
          }
        },
        { session }
      );
    }

    // Step 4: Update customer stats with new totals
    await Customer.findByIdAndUpdate(
      customer._id,
      {
        $inc: { 
          totalPurchases: totals.netTotal
        },
        lastInvoiceDate: new Date()
      },
      { session }
    );

    // Step 5: Update the invoice
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        customer,
        items: processedItems,
        totals,
        paymentType: paymentType || existingInvoice.paymentType,
        notes: notes !== undefined ? notes : existingInvoice.notes,
        updatedAt: new Date()
      },
      { new: true, session }
    );

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Update invoice status
// @route   PUT /api/invoices/:id/status
// @access  Private
exports.updateInvoiceStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;

    const invoice = await Invoice.findById(req.params.id).session(session);

    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // If cancelling, restore stock and reverse customer stats
    if (status === 'Cancelled' && invoice.status !== 'Cancelled') {
      // Restore stock for each item
      for (const item of invoice.items) {
        const totalQty = item.quantitySold + (item.freeQuantity || 0);

        if (item.product.batchId) {
          // NEW PATH: Restore to batch
          await Batch.findByIdAndUpdate(
            item.product.batchId,
            { $inc: { stock: totalQty } },
            { session }
          );
        } else {
          // LEGACY PATH: Restore to product
          await Product.findByIdAndUpdate(
            item.product._id,
            {
              $inc: { currentStockQty: totalQty },
              $push: {
                stockHistory: {
                  type: 'invoice_cancelled',
                  invoiceId: invoice._id,
                  changeQty: totalQty,
                  reference: `${invoice.invoiceNumber} - Cancelled`,
                  timestamp: new Date()
                }
              }
            },
            { session }
          );
        }
      }

      // Reverse customer stats
      const customerUpdate = {
        $inc: {
          totalPurchases: -invoice.totals.netTotal,
          invoiceCount: -1
        }
      };

      // If it was a Credit invoice, reverse outstanding balance
      if (invoice.paymentType === 'Credit') {
        const unpaidAmount = (invoice.totals.netTotal || 0) - (invoice.paidAmount || 0);
        if (unpaidAmount > 0) {
          customerUpdate.$inc.outstandingBalance = -unpaidAmount;
        }
      }

      await Customer.findByIdAndUpdate(
        invoice.customer._id,
        customerUpdate,
        { session }
      );
    }

    // Update the status
    invoice.status = status;
    await invoice.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      invoice
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Export invoices
// @route   GET /api/invoices/export
// @access  Private
exports.exportInvoices = async (req, res, next) => {
  try {
    const { format = 'excel', invoices: invoiceIds, startDate, endDate } = req.query;

    // Build query
    const query = {};
    
    if (invoiceIds) {
      // Specific invoices
      const ids = invoiceIds.split(',');
      query._id = { $in: ids };
    } else {
      // Date range filter
      if (startDate && endDate) {
        query.invoiceDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
    }

    // Fetch invoices with populated data
    const invoices = await Invoice.find(query).sort({ invoiceDate: -1 });

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No invoices found for export'
      });
    }

    // Generate export based on format
    if (format === 'excel') {
      const buffer = await generateInvoiceExcel(invoices);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=invoices_${Date.now()}.xlsx`);
      res.send(buffer);
    } else if (format === 'csv') {
      const csvContent = generateInvoiceCSV(invoices);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=invoices_${Date.now()}.csv`);
      res.send(csvContent);
    } else if (format === 'pdf') {
      // PDF export - for now return a message
      // You can implement PDF generation later using puppeteer or pdfkit
      res.status(501).json({
        success: false,
        message: 'PDF export is not yet implemented'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid export format. Supported: excel, csv, pdf'
      });
    }
  } catch (error) {
    next(error);
  }
};

