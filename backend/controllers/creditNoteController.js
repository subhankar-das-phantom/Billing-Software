const mongoose = require('mongoose');
const CreditNote = require('../models/CreditNote');
const Invoice = require('../models/Invoice');
const Batch = require('../models/Batch');
const Customer = require('../models/Customer');
const { calculateItemAmounts, round } = require('../utils/invoiceCalculator');
const { getAttribution } = require('../middleware/auth');

// @desc    Create credit note (sales return)
// @route   POST /api/credit-notes
// @access  Private
exports.createCreditNote = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoiceId, items, reason } = req.body;

    // 1. Validate invoice
    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'Cancelled') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot create credit note for a cancelled invoice'
      });
    }

    // 2. Get existing credit notes for this invoice to check already-returned quantities
    const existingCreditNotes = await CreditNote.find({ invoiceId }).session(session);
    const alreadyReturned = {};
    for (const cn of existingCreditNotes) {
      for (const item of cn.items) {
        const key = item.productId.toString() + (item.batchId ? '_' + item.batchId.toString() : '');
        alreadyReturned[key] = (alreadyReturned[key] || 0) + item.quantityReturned;
      }
    }

    // 3. Validate and process each return item
    const processedItems = [];
    
    for (const returnItem of items) {
      // Find the matching invoice item
      const invoiceItem = invoice.items.find(ii => {
        const productMatch = ii.product._id.toString() === returnItem.productId;
        // For new items: exact match on batchId if they have it
        if (ii.product.batchId) {
          const checkId = returnItem.invoiceBatchId || returnItem.batchId;
          return productMatch && ii.product.batchId.toString() === checkId;
        }
        // For legacy items without batchId, just match the product
        return productMatch;
      });

      if (!invoiceItem) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Product ${returnItem.productId} was not part of this invoice`
        });
      }

      // Check return quantity against sold quantity minus already returned
      const key = returnItem.productId + (returnItem.batchId ? '_' + returnItem.batchId : '');
      const previouslyReturned = alreadyReturned[key] || 0;
      const maxReturnable = invoiceItem.quantitySold - previouslyReturned;

      if (returnItem.quantityReturned > maxReturnable) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Cannot return ${returnItem.quantityReturned} of ${invoiceItem.product.productName}. Maximum returnable: ${maxReturnable} (sold: ${invoiceItem.quantitySold}, already returned: ${previouslyReturned})`
        });
      }

      if (returnItem.quantityReturned <= 0) {
        continue; // Skip items with 0 return quantity
      }

      // Calculate credit amounts using the original rate
      const rate = invoiceItem.ratePerUnit;
      const gstPercent = invoiceItem.product.gstPercentage;
      const amounts = calculateItemAmounts(
        returnItem.quantityReturned,
        rate,
        gstPercent,
        0 // No discount on returns
      );

      let restoreToBatchId = invoiceItem.product.batchId;
      
      if (!restoreToBatchId) {
        if (!returnItem.batchId) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Manual batch selection is required to return legacy items: ${invoiceItem.product.productName}. Please specify target batch.`
          });
        }
        restoreToBatchId = returnItem.batchId;
      }

      processedItems.push({
        productId: invoiceItem.product._id,
        productName: invoiceItem.product.productName,
        batchId: restoreToBatchId,
        batchNo: returnItem.batchNo || invoiceItem.product.batchNo || null,
        quantityReturned: returnItem.quantityReturned,
        rate,
        gstPercent,
        taxableAmount: amounts.taxableAmount,
        gstAmount: amounts.gstAmount,
        cgstAmount: amounts.cgstAmount,
        sgstAmount: amounts.sgstAmount,
        totalAmount: amounts.totalAmount
      });

      // 4. Restore stock to the explicitly targeted batch
      const stockService = require('../services/stockService');
      await stockService.restoreStock(restoreToBatchId, returnItem.quantityReturned, session);
    }

    if (processedItems.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'No items to return'
      });
    }

    // 5. Calculate totals
    const totals = processedItems.reduce((acc, item) => {
      acc.totalTaxable += item.taxableAmount;
      acc.totalGST += item.gstAmount;
      acc.totalCGST += item.cgstAmount;
      acc.totalSGST += item.sgstAmount;
      acc.netTotal += item.totalAmount;
      return acc;
    }, { totalTaxable: 0, totalGST: 0, totalCGST: 0, totalSGST: 0, netTotal: 0 });

    // Round totals
    Object.keys(totals).forEach(key => {
      totals[key] = round(totals[key]);
    });

    // 6. Generate credit note number
    const lastCN = await CreditNote.findOne().sort({ createdAt: -1 }).session(session);
    let creditNoteNumber;
    if (lastCN) {
      const lastNum = parseInt(lastCN.creditNoteNumber.split('-').pop());
      creditNoteNumber = `CN-${new Date().getFullYear()}-${String(lastNum + 1).padStart(4, '0')}`;
    } else {
      creditNoteNumber = `CN-${new Date().getFullYear()}-0001`;
    }

    // 7. Create credit note
    const creditNote = await CreditNote.create([{
      creditNoteNumber,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customer: {
        _id: invoice.customer._id,
        customerName: invoice.customer.customerName,
        phone: invoice.customer.phone,
        gstin: invoice.customer.gstin
      },
      items: processedItems,
      totals,
      reason: reason || '',
      createdBy: getAttribution(req)
    }], { session });

    // 8. Update customer credit balance
    await Customer.findByIdAndUpdate(
      invoice.customer._id,
      { $inc: { creditBalance: totals.netTotal } },
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      creditNote: creditNote[0]
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Get all credit notes
// @route   GET /api/credit-notes
// @access  Private
exports.getCreditNotes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const creditNotes = await CreditNote.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CreditNote.countDocuments();

    res.status(200).json({
      success: true,
      count: creditNotes.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      creditNotes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get credit notes for an invoice
// @route   GET /api/credit-notes/invoice/:invoiceId
// @access  Private
exports.getCreditNotesByInvoice = async (req, res, next) => {
  try {
    const creditNotes = await CreditNote.find({
      invoiceId: req.params.invoiceId
    }).sort({ createdAt: -1 });

    // Calculate total returned per product
    const returnSummary = {};
    for (const cn of creditNotes) {
      for (const item of cn.items) {
        const key = item.productId.toString() + (item.batchId ? '_' + item.batchId.toString() : '');
        if (!returnSummary[key]) {
          returnSummary[key] = {
            productName: item.productName,
            totalReturned: 0
          };
        }
        returnSummary[key].totalReturned += item.quantityReturned;
      }
    }

    res.status(200).json({
      success: true,
      count: creditNotes.length,
      creditNotes,
      returnSummary
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single credit note by ID
// @route   GET /api/credit-notes/:id
// @access  Private
exports.getCreditNote = async (req, res, next) => {
  try {
    const creditNote = await CreditNote.findById(req.params.id);
    if (!creditNote) {
      return res.status(404).json({
        success: false,
        message: 'Credit note not found'
      });
    }

    res.status(200).json({
      success: true,
      creditNote
    });
  } catch (error) {
    next(error);
  }
};
