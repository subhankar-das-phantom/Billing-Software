const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');
const { calculateItemAmounts, calculateInvoiceTotals } = require('../utils/invoiceCalculator');
const { numberToWords } = require('../utils/numberToWords');
const { generateInvoiceExcel, generateInvoiceCSV } = require('../utils/excelExport');
const { getAttribution } = require('../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../utils/activityTracker');
const { invalidateGstReportCache } = require('./gstReportController');

const UPDATE_INVOICE_TRANSACTION_RETRIES = 3;
const UPDATE_INVOICE_RETRY_BASE_DELAY_MS = 150;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeRegex = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildFuzzyPattern = (str = '') => {
  const normalized = str.trim().replace(/\s+/g, '');
  if (!normalized) return '';
  const limited = normalized.slice(0, 32);
  return [...limited].map(ch => escapeRegex(ch)).join('.*');
};

const parseISTDateBoundary = (dateInput, endOfDay = false) => {
  const raw = String(dateInput || '').trim();
  if (!raw) return null;

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const timePart = endOfDay ? '23:59:59.999' : '00:00:00.000';
    const parsed = new Date(`${year}-${month}-${day}T${timePart}+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const hasTransientTransactionLabel = (error) => {
  if (!error) return false;

  if (error.errorLabelSet && typeof error.errorLabelSet.has === 'function') {
    return error.errorLabelSet.has('TransientTransactionError');
  }

  const topLevelLabels = Array.isArray(error.errorLabels) ? error.errorLabels : [];
  if (topLevelLabels.includes('TransientTransactionError')) return true;

  const responseLabels = Array.isArray(error.errorResponse?.errorLabels)
    ? error.errorResponse.errorLabels
    : [];

  return responseLabels.includes('TransientTransactionError');
};

const isRetryableInvoiceTransactionError = (error) => {
  const code = error?.code ?? error?.errorResponse?.code;
  return code === 112 || hasTransientTransactionLabel(error);
};

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

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const query = {};

    // Filter by status
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    // Filter by date range
    if (req.query.startDate || req.query.endDate) {
      query.invoiceDate = {};

      if (req.query.startDate) {
        const start = parseISTDateBoundary(req.query.startDate, false);
        if (start) {
          query.invoiceDate.$gte = start;
        }
      }

      if (req.query.endDate) {
        const end = parseISTDateBoundary(req.query.endDate, true);
        if (end) {
          query.invoiceDate.$lte = end;
        }
      }

      if (Object.keys(query.invoiceDate).length === 0) {
        delete query.invoiceDate;
      }
    }

    // Search by invoice number and customer name (server-side)
    const search = String(req.query.search || '').trim();
    if (search) {
      const escaped = escapeRegex(search);
      const usePrefix = req.query.prefix === 'true';
      const useFuzzy = req.query.fuzzy === 'true';

      const primaryPattern = usePrefix ? `^${escaped}` : escaped;
      const primaryConditions = [
        { invoiceNumber: { $regex: primaryPattern, $options: 'i' } },
        { 'customer.customerName': { $regex: primaryPattern, $options: 'i' } }
      ];

      if (useFuzzy && search.length >= 2) {
        const fuzzyPattern = buildFuzzyPattern(search);
        if (fuzzyPattern && fuzzyPattern !== primaryPattern) {
          primaryConditions.push(
            { invoiceNumber: { $regex: fuzzyPattern, $options: 'i' } },
            { 'customer.customerName': { $regex: fuzzyPattern, $options: 'i' } }
          );
        }
      }

      query.$or = primaryConditions;
    }

    const invoices = await Invoice.find(query)
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Invoice.countDocuments(query);

    const pages = Math.max(1, Math.ceil(total / limit));

    res.status(200).json({
      success: true,
      count: invoices.length,
      total,
      page,
      pages,
      hasMore: page < pages,
      invoices
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get invoice stats for cards
// @route   GET /api/invoices/stats
// @access  Private
exports.getInvoiceStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const nextMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 1);

    const [totalInvoices, todayInvoices, thisMonthInvoices] = await Promise.all([
      Invoice.countDocuments(),
      Invoice.countDocuments({ invoiceDate: { $gte: todayStart, $lt: tomorrowStart } }),
      Invoice.countDocuments({ invoiceDate: { $gte: monthStart, $lt: nextMonthStart } })
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalInvoices,
        todayInvoices,
        thisMonthInvoices
      }
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
  const createRequestId = typeof req.body?.createRequestId === 'string'
    ? req.body.createRequestId.trim()
    : '';

  if (req.body?.createRequestId !== undefined && !createRequestId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid create request ID'
    });
  }

  if (createRequestId) {
    const existingInvoice = await Invoice.findOne({ createRequestId });
    if (existingInvoice) {
      return res.status(200).json({
        success: true,
        invoice: existingInvoice,
        message: 'Invoice already created for this request'
      });
    }
  }

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
    const stockUpdates = [];

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

      // Check stock
      if (product.currentStockQty < totalQty) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.productName}. Available: ${product.currentStockQty}, Required: ${totalQty}`
        });
      }

      stockUpdates.push({
        productId: product._id,
        previousQty: product.currentStockQty,
        changeQty: -totalQty,
        newQty: product.currentStockQty - totalQty
      });

      // Calculate amounts and add standard item
      const rateToUse = item.ratePerUnit || product.rate || product.newMRP;
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
          newMRP: product.newMRP,
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
      createRequestId: createRequestId || undefined,
      createdBy: getAttribution(req)
    }], { session });

    // Update stock
    for (const update of stockUpdates) {
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

    // Invalidate GST report cache
    invalidateGstReportCache(invoice[0].invoiceDate);

    // Track employee activity
    trackActivity(req, ACTIVITY_TYPES.INVOICE_CREATED, { amount: totals.netTotal });

    res.status(201).json({
      success: true,
      invoice: invoice[0]
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    const duplicateCreateRequest =
      createRequestId
      && error?.code === 11000
      && (error?.keyPattern?.createRequestId || String(error?.message || '').includes('createRequestId'));

    if (duplicateCreateRequest) {
      const existingInvoice = await Invoice.findOne({ createRequestId });
      if (existingInvoice) {
        return res.status(200).json({
          success: true,
          invoice: existingInvoice,
          message: 'Invoice already created for this request'
        });
      }
    }

    next(error);
  } finally {
    session.endSession();
  }
};

// =============================================================================
// UPDATE INVOICE — PURE DELTA-BASED STOCK ADJUSTMENT
// =============================================================================
//
// STOCK RULE: Stock is modified in exactly ONE place — the delta loop (step 5).
//             There is NO restore step. NO stockUpdates array. NO second deduction.
//
// FLOW:
//   1. Fetch existing invoice
//   2. Idempotency guard
//   3. Build oldItemsMap (from existing invoice)
//   4. Build newItemsMap (from request) + validate inputs
//   5. Delta loop — THE ONLY STOCK CHANGE
//   6. Process items (amounts only, zero stock logic)
//   7. Calculate totals
//   8. Resolve customer
//   9. Update customer stats (delta-based)
//   10. Update invoice document
//   11. Commit
//
// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
exports.updateInvoice = async (req, res, next) => {
  for (let attempt = 1; attempt <= UPDATE_INVOICE_TRANSACTION_RETRIES; attempt += 1) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { customerId, items, paymentType, notes, lastKnownUpdatedAt } = req.body;

    // ── STEP 1: Fetch existing invoice ─────────────────────────────────
    const existingInvoice = await Invoice.findById(req.params.id).session(session);

    if (!existingInvoice) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (existingInvoice.status === 'Cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Cannot edit a cancelled invoice' });
    }

    // ── STEP 2: Idempotency guard ──────────────────────────────────────
    if (
      lastKnownUpdatedAt &&
      new Date(lastKnownUpdatedAt).getTime() !== new Date(existingInvoice.updatedAt).getTime()
    ) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Invoice has been modified by another user. Please refresh and try again.'
      });
    }

    // ── STEP 3: Build oldItemsMap from existing invoice ────────────────
    const oldItemsMap = {};
    for (const item of existingInvoice.items) {
      const pid = item.product._id.toString();
      oldItemsMap[pid] = (oldItemsMap[pid] || 0) + item.quantitySold + (item.freeQuantity || 0);
    }

    // ── STEP 4: Build newItemsMap from request + validate inputs ───────
    const newItemsMap = {};
    for (const item of items) {
      const sold = item.quantitySold;
      const free = item.freeQuantity || 0;

      if (!Number.isFinite(sold) || sold < 1 || !Number.isInteger(sold)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Invalid sold quantity (${sold}) for product ${item.productId}. Must be a positive integer.`
        });
      }
      if (!Number.isFinite(free) || free < 0 || !Number.isInteger(free)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Invalid free quantity (${free}) for product ${item.productId}. Must be a non-negative integer.`
        });
      }

      const pid = item.productId.toString();
      newItemsMap[pid] = (newItemsMap[pid] || 0) + sold + free;
    }

    // ── STEP 5: Delta-based stock adjustment ───────────────────────────
    //
    // THIS IS THE ONLY PLACE STOCK IS MODIFIED.
    // Nothing above or below this block touches Product.currentStockQty.
    //
    const allProductIds = [
      ...new Set([...Object.keys(oldItemsMap), ...Object.keys(newItemsMap)])
    ].sort();

    // Batch-fetch all involved products (eliminates N+1 queries)
    const allProducts = await Product.find({ _id: { $in: allProductIds } }).session(session);
    const productMap = {};
    for (const p of allProducts) {
      productMap[p._id.toString()] = p;
    }

    // Verify all products exist
    for (const pid of allProductIds) {
      if (!productMap[pid]) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Product ${pid} no longer exists. Cannot adjust stock.`
        });
      }
    }

    for (const pid of allProductIds) {
      const oldQty = oldItemsMap[pid] || 0;
      const newQty = newItemsMap[pid] || 0;
      const delta = newQty - oldQty;

      if (delta === 0) continue;

      if (delta > 0) {
        // DEDUCT — safe conditional update prevents negative stock & race conditions
        const updated = await Product.findOneAndUpdate(
          { _id: pid, currentStockQty: { $gte: delta } },
          {
            $inc: { currentStockQty: -delta },
            $push: {
              stockHistory: {
                type: 'invoice_edit',
                invoiceId: existingInvoice._id,
                changeQty: -delta,
                reference: `${existingInvoice.invoiceNumber} - Edit (deducted ${delta})`,
                timestamp: new Date()
              }
            }
          },
          { session, new: true }
        );

        if (!updated) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${productMap[pid].productName}. Additional required: ${delta}`
          });
        }
      } else {
        // RESTORE — delta < 0, return stock to inventory
        await Product.findByIdAndUpdate(
          pid,
          {
            $inc: { currentStockQty: Math.abs(delta) },
            $push: {
              stockHistory: {
                type: 'invoice_edit',
                invoiceId: existingInvoice._id,
                changeQty: Math.abs(delta),
                reference: `${existingInvoice.invoiceNumber} - Edit (restored ${Math.abs(delta)})`,
                timestamp: new Date()
              }
            }
          },
          { session }
        );
      }
    }
    // ── END OF STOCK CHANGES — nothing below touches Product.currentStockQty ──

    // ── STEP 6: Process items for invoice (amounts only, NO stock logic)
    //
    // Smart duplicate merging:
    //   Same product + same rate + same discount → merge into one line
    //   Same product + different rate or discount → keep separate lines
    //
    const mergeKey = (item) => {
      const rate = item.ratePerUnit || productMap[item.productId.toString()]?.rate || productMap[item.productId.toString()]?.newMRP;
      return `${item.productId}_${rate}_${item.schemeDiscount || 0}`;
    };

    const mergedItemsMap = {};
    for (const item of items) {
      const key = mergeKey(item);
      if (mergedItemsMap[key]) {
        mergedItemsMap[key].quantitySold += item.quantitySold;
        mergedItemsMap[key].freeQuantity += (item.freeQuantity || 0);
      } else {
        mergedItemsMap[key] = {
          productId: item.productId,
          quantitySold: item.quantitySold,
          freeQuantity: item.freeQuantity || 0,
          ratePerUnit: item.ratePerUnit,
          schemeDiscount: item.schemeDiscount || 0
        };
      }
    }

    const processedItems = [];
    for (const item of Object.values(mergedItemsMap)) {
      const product = productMap[item.productId.toString()];
      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      const rateToUse = item.ratePerUnit || product.rate || product.newMRP;
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
          newMRP: product.newMRP,
          gstPercentage: product.gstPercentage
        },
        quantitySold: item.quantitySold,
        freeQuantity: item.freeQuantity || 0,
        ratePerUnit: rateToUse,
        schemeDiscount: item.schemeDiscount || 0,
        ...amounts
      });
    }

    // ── STEP 7: Calculate totals ───────────────────────────────────────
    const totals = calculateInvoiceTotals(processedItems);
    totals.amountInWords = numberToWords(totals.netTotal);

    // ── STEP 8: Resolve customer ───────────────────────────────────────
    let customer = existingInvoice.customer;
    if (customerId && customerId !== existingInvoice.customer._id.toString()) {
      const newCustomer = await Customer.findById(customerId).session(session);
      if (!newCustomer) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: 'Customer not found' });
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

    // ── STEP 9: Update customer stats (delta-based) ────────────────────
    const totalsDelta = totals.netTotal - existingInvoice.totals.netTotal;
    if (totalsDelta !== 0) {
      const updatedCust = await Customer.findByIdAndUpdate(
        customer._id,
        { $inc: { totalPurchases: totalsDelta }, lastInvoiceDate: new Date() },
        { session, new: true }
      );
      // Clamp — never allow negative totalPurchases
      if (updatedCust && updatedCust.totalPurchases < 0) {
        await Customer.findByIdAndUpdate(
          customer._id,
          { $set: { totalPurchases: 0 } },
          { session }
        );
      }
    }

    // Recalculate paymentStatus based on new total vs existing paidAmount
    const existingPaidAmount = getRoundedNumber(existingInvoice.paidAmount);
    const newPaymentStatus = derivePaymentStatus(totals.netTotal, existingPaidAmount);

    // Outstanding balance delta for Credit invoices
    // Use actual unpaid amounts (not raw totalsDelta) to account for paidAmount
    const oldPaymentType = existingInvoice.paymentType;
    const newPaymentType = paymentType || existingInvoice.paymentType;
    let outstandingDelta = 0;
    if (oldPaymentType === 'Credit' && newPaymentType === 'Credit') {
      // Old unpaid = what was still owed before edit
      // New unpaid = what is owed after edit
      const oldUnpaid = Math.max(0, existingInvoice.totals.netTotal - existingPaidAmount);
      const newUnpaid = Math.max(0, totals.netTotal - existingPaidAmount);
      outstandingDelta = newUnpaid - oldUnpaid;
    } else if (oldPaymentType === 'Credit' && newPaymentType !== 'Credit') {
      // Switching away from Credit — remove whatever was unpaid
      outstandingDelta = -Math.max(0, existingInvoice.totals.netTotal - existingPaidAmount);
    } else if (oldPaymentType !== 'Credit' && newPaymentType === 'Credit') {
      // Switching to Credit — add the new unpaid amount
      outstandingDelta = Math.max(0, totals.netTotal - existingPaidAmount);
    }
    if (outstandingDelta !== 0) {
      await Customer.findByIdAndUpdate(
        customer._id,
        { $inc: { outstandingBalance: outstandingDelta } },
        { session }
      );
    }

    // ── STEP 10: Update invoice document ───────────────────────────────
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        customer,
        items: processedItems,
        totals,
        paymentType: newPaymentType,
        paymentStatus: newPaymentStatus,
        notes: notes !== undefined ? notes : existingInvoice.notes,
        updatedAt: new Date()
      },
      { new: true, session }
    );

    // ── STEP 11: Commit ────────────────────────────────────────────────
    await session.commitTransaction();

      // Invalidate GST report cache
      invalidateGstReportCache(updatedInvoice.invoiceDate);

      return res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
      });
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      const shouldRetry = isRetryableInvoiceTransactionError(error)
        && attempt < UPDATE_INVOICE_TRANSACTION_RETRIES;

      if (shouldRetry) {
        await sleep(UPDATE_INVOICE_RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      if (isRetryableInvoiceTransactionError(error) && !res.headersSent) {
        return res.status(503).json({
          success: false,
          message: 'Invoice update hit a temporary write conflict. Please retry.'
        });
      }

      return next(error);
    } finally {
      session.endSession();
    }
  }
};

// @desc    Update invoice status
// @route   PUT /api/invoices/:id/status
// @access  Private
exports.updateInvoiceStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Cancellation requires multi-document changes (stock + customer stats),
    // so use a transaction only when available (replica set / Atlas).
    // Simple Created↔Printed toggles are single-document and need no transaction.
    if (status === 'Cancelled' && invoice.status !== 'Cancelled') {
      let session;
      try {
        session = await mongoose.startSession();
        session.startTransaction();

        // Restore stock for each item
        for (const item of invoice.items) {
          const totalQty = item.quantitySold + (item.freeQuantity || 0);

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

        invoice.status = status;
        await invoice.save({ session });

        await session.commitTransaction();
        invalidateGstReportCache(invoice.invoiceDate);
      } catch (txError) {
        if (session?.inTransaction()) {
          await session.abortTransaction();
        }

        // Fallback: if transactions aren't supported (standalone MongoDB),
        // perform the operations without a session
        if (txError.code === 20 || txError.codeName === 'IllegalOperation') {
          for (const item of invoice.items) {
            const totalQty = item.quantitySold + (item.freeQuantity || 0);
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
              }
            );
          }

          const customerUpdate = {
            $inc: {
              totalPurchases: -invoice.totals.netTotal,
              invoiceCount: -1
            }
          };
          if (invoice.paymentType === 'Credit') {
            const unpaidAmount = (invoice.totals.netTotal || 0) - (invoice.paidAmount || 0);
            if (unpaidAmount > 0) {
              customerUpdate.$inc.outstandingBalance = -unpaidAmount;
            }
          }
          await Customer.findByIdAndUpdate(invoice.customer._id, customerUpdate);

          invoice.status = status;
          await invoice.save();
          invalidateGstReportCache(invoice.invoiceDate);
        } else {
          throw txError;
        }
      } finally {
        if (session) session.endSession();
      }
    } else {
      // Simple status toggle (Created ↔ Printed) — single document, no transaction needed
      invoice.status = status;
      await invoice.save();
    }

    res.status(200).json({
      success: true,
      invoice
    });
  } catch (error) {
    next(error);
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
        const start = parseISTDateBoundary(startDate, false);
        const end = parseISTDateBoundary(endDate, true);

        if (start && end) {
          query.invoiceDate = {
            $gte: start,
            $lte: end
          };
        } else {
          return res.status(400).json({
            success: false,
            message: 'Invalid date range for export'
          });
        }
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
