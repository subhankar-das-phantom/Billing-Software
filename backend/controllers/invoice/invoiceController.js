const mongoose = require('mongoose');
const Invoice = require('../../models/Invoice');
const CreditNote = require('../../models/CreditNote');
const Product = require('../../models/Product');
const Customer = require('../../models/Customer');
const Admin = require('../../models/Admin');
const { calculateItemAmounts, calculateInvoiceTotals } = require('../../utils/invoiceCalculator');
const { numberToWords } = require('../../utils/numberToWords');
const { getAttribution } = require('../../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../../utils/activityTracker');
const { invalidateGstReportCache } = require('../gstReportController');
const getTenantId = require('../../utils/getTenantId');

const UPDATE_INVOICE_TRANSACTION_RETRIES = 3;
const UPDATE_INVOICE_RETRY_BASE_DELAY_MS = 150;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const { escapeRegex, buildFuzzyPattern } = require('../../utils/searchUtils');

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
const INVOICE_STATUSES = new Set(['Created', 'Printed', 'Cancelled']);
const PAYMENT_STATUSES = new Set(['Unpaid', 'Partial', 'Paid']);

const buildInvoiceItem = ({
  product,
  quantitySold,
  freeQuantity = 0,
  ratePerUnit,
  mrp,
  gstPercentage,
  batchNo,
  expiryDate,
  schemeDiscount = 0,
  batchAllocations,
  allocationMode
}) => {
  const amounts = calculateItemAmounts(
    quantitySold,
    ratePerUnit,
    gstPercentage,
    schemeDiscount
  );

  return {
    product: {
      _id: product._id,
      productName: product.productName,
      hsnCode: product.hsnCode,
      pack: product.pack,
      batchNo: batchNo || '',
      expiryDate: expiryDate || null,
      newMRP: mrp,
      gstPercentage
    },
    ...(batchAllocations ? { batchAllocations } : {}),
    ...(allocationMode ? { allocationMode } : {}),
    quantitySold,
    freeQuantity,
    ratePerUnit,
    schemeDiscount,
    ...amounts
  };
};

const splitInvoiceItemByBatchAllocations = ({ product, item, allocations, allocationMode }) => {
  let remainingSold = Number(item.quantitySold) || 0;
  const splitItemsByKey = new Map();

  for (const allocation of allocations) {
    const allocatedQty = Number(allocation.quantity) || 0;
    const soldFromBatch = Math.min(remainingSold, allocatedQty);
    const freeFromBatch = allocatedQty - soldFromBatch;
    remainingSold -= soldFromBatch;

    const effectiveRate = item.ratePerUnit !== undefined && item.ratePerUnit !== null 
      ? item.ratePerUnit 
      : allocation.rate;

    const key = [
      effectiveRate,
      allocation.mrp,
      allocation.gstPercent,
      item.schemeDiscount || 0
    ].join('|');

    const existing = splitItemsByKey.get(key);
    if (existing) {
      existing.quantitySold += soldFromBatch;
      existing.freeQuantity += freeFromBatch;

      const existingAlloc = existing.batchAllocations.find(a => 
        a.batchId?.toString() === allocation.batchId?.toString()
      );
      if (existingAlloc) {
        existingAlloc.quantity += allocatedQty;
      } else {
        existing.batchAllocations.push(allocation);
      }

      Object.assign(existing, calculateItemAmounts(
        existing.quantitySold,
        existing.ratePerUnit,
        existing.product.gstPercentage,
        existing.schemeDiscount
      ));
      continue;
    }

    splitItemsByKey.set(key, buildInvoiceItem({
      product,
      quantitySold: soldFromBatch,
      freeQuantity: freeFromBatch,
      ratePerUnit: effectiveRate,
      mrp: allocation.mrp,
      gstPercentage: allocation.gstPercent,
      batchNo: allocation.batchNo,
      expiryDate: allocation.expiryDate,
      schemeDiscount: item.schemeDiscount || 0,
      batchAllocations: [allocation],
      allocationMode
    }));
  }

  return [...splitItemsByKey.values()];
};

const derivePaymentStatus = (totalAmount, paidAmount) => {
  const roundedTotal = getRoundedNumber(totalAmount);
  const roundedPaid = getRoundedNumber(paidAmount);
  const remaining = round2(roundedTotal - roundedPaid);

  if (remaining <= 0 && roundedPaid > 0) return 'Paid';
  if (roundedPaid > 0) return 'Partial';
  return 'Unpaid';
};

const getQueryValues = (query, key) => {
  const rawValues = [query[key], query[`${key}[]`]].filter(value => value !== undefined);
  return rawValues
    .flatMap(value => Array.isArray(value) ? value : String(value).split(','))
    .map(value => String(value).trim())
    .filter(Boolean);
};

const toMongoFilter = (values) => {
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : { $in: values };
};

const applyInvoiceStatusFilters = (query, reqQuery) => {
  const statusValues = getQueryValues(reqQuery, 'status').filter(value => value !== 'all');
  const paymentStatusValues = getQueryValues(reqQuery, 'paymentStatus').filter(value => value !== 'all');

  const lifecycleStatuses = statusValues.filter(value => INVOICE_STATUSES.has(value));
  const statusesUsedAsPaymentStatuses = statusValues.filter(value => PAYMENT_STATUSES.has(value));
  const paymentStatuses = [...new Set([
    ...paymentStatusValues.filter(value => PAYMENT_STATUSES.has(value)),
    ...statusesUsedAsPaymentStatuses
  ])];

  const lifecycleFilter = toMongoFilter(lifecycleStatuses);
  if (lifecycleFilter !== undefined) {
    query.status = lifecycleFilter;
  }

  const paymentStatusFilter = toMongoFilter(paymentStatuses);
  if (paymentStatusFilter !== undefined) {
    query.paymentStatus = paymentStatusFilter;
    if (lifecycleFilter === undefined) {
      query.status = { $ne: 'Cancelled' };
    }
  }

  return { paymentStatuses };
};

const shouldUsePayableFilter = (reqQuery, paymentStatuses) => {
  const payableOnly = String(reqQuery.payableOnly || reqQuery.onlyPayable || '').toLowerCase() === 'true';
  if (payableOnly) return true;

  return paymentStatuses.some(status => status === 'Unpaid' || status === 'Partial')
    && String(reqQuery.includeCreditNoteSettled || '').toLowerCase() !== 'true';
};

const getInvoicesWithCreditNotesPage = async (query, { sort, skip, limit, payableOnly = false }) => {
  const pipeline = [
    { $match: query },
    {
      $lookup: {
        from: CreditNote.collection.name,
        let: { invoiceId: '$_id', tenantId: '$tenantId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$invoiceId', '$$invoiceId'] },
                  { $eq: ['$tenantId', '$$tenantId'] }
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ['$totals.netTotal', 0] } }
            }
          }
        ],
        as: 'creditNoteTotals'
      }
    },
    {
      $addFields: {
        creditNoteTotal: {
          $ifNull: [{ $arrayElemAt: ['$creditNoteTotals.total', 0] }, 0]
        }
      }
    },
    {
      $addFields: {
        effectiveDue: {
          $round: [
            {
              $subtract: [
                { $subtract: [{ $ifNull: ['$totals.netTotal', 0] }, { $ifNull: ['$paidAmount', 0] }] },
                '$creditNoteTotal'
              ]
            },
            2
          ]
        }
      }
    },
    ...(payableOnly ? [{ $match: { effectiveDue: { $gt: 0 } } }] : []),
    { $sort: sort },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          { $project: { creditNoteTotals: 0 } }
        ],
        metadata: [{ $count: 'total' }]
      }
    }
  ];

  const result = await Invoice.aggregate(pipeline);

  const pageResult = result[0] || { items: [], metadata: [] };
  return {
    invoices: pageResult.items || [],
    total: pageResult.metadata[0]?.total || 0
  };
};

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const tenantId = getTenantId(req);

    const query = { tenantId };

    const { paymentStatuses } = applyInvoiceStatusFilters(query, req.query);

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

    const sort = { invoiceDate: -1 };
    const usePayableFilter = shouldUsePayableFilter(req.query, paymentStatuses);
    const { invoices, total } = usePayableFilter
      ? await getInvoicesWithCreditNotesPage(query, { sort, skip, limit, payableOnly: true })
      : {
          invoices: await Invoice.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit),
          total: await Invoice.countDocuments(query)
        };

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
    const tenantId = getTenantId(req);
    const baseQuery = { tenantId };

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const nextMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 1);

    const [totalInvoices, todayInvoices, thisMonthInvoices] = await Promise.all([
      Invoice.countDocuments(baseQuery),
      Invoice.countDocuments({ ...baseQuery, invoiceDate: { $gte: todayStart, $lt: tomorrowStart } }),
      Invoice.countDocuments({ ...baseQuery, invoiceDate: { $gte: monthStart, $lt: nextMonthStart } })
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
    const tenantId = getTenantId(req);
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      tenantId
    });

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
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const tenantId = getTenantId(req);

    if (!mongoose.Types.ObjectId.isValid(req.params.customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const query = {
      tenantId,
      'customer._id': new mongoose.Types.ObjectId(req.params.customerId)
    };
    const { paymentStatuses } = applyInvoiceStatusFilters(query, req.query);

    const sort = { invoiceDate: -1 };
    const usePayableFilter = shouldUsePayableFilter(req.query, paymentStatuses);
    const includeCreditNoteTotals = String(req.query.includeCreditNoteTotals || 'true').toLowerCase() !== 'false';
    const { invoices, total } = usePayableFilter || includeCreditNoteTotals
      ? await getInvoicesWithCreditNotesPage(query, {
          sort,
          skip,
          limit,
          payableOnly: usePayableFilter
        })
      : {
          invoices: await Invoice.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit),
          total: await Invoice.countDocuments(query)
        };
    const pages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      items: invoices,
      pagination: {
        page,
        limit,
        total,
        hasMore: page < pages
      },
      // Backward compatibility
      count: invoices.length,
      total,
      page,
      pages,
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
  const tenantId = getTenantId(req);

  if (req.body?.createRequestId !== undefined && !createRequestId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid create request ID'
    });
  }

  if (createRequestId) {
    const existingInvoice = await Invoice.findOne({ createRequestId, tenantId });
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
    const paymentTypeToUse = paymentType || 'Credit';

    // Validate customer
    const customer = await Customer.findOne({
      _id: customerId,
      tenantId
    }).session(session);
    if (!customer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (customer.isActive === false) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot create invoice for an inactive customer'
      });
    }

    // Resolve firm info from the tenant admin.
    const adminInfo = await Admin.findById(tenantId).session(session);

    if (!adminInfo) {
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        message: 'Firm settings not found'
      });
    }

    // Generate invoice number
    const lastInvoice = await Invoice.findOne({ tenantId })
      .sort({ createdAt: -1 })
      .select('invoiceNumber')
      .session(session);
    let invoiceNumber;
    if (lastInvoice) {
      const lastNum = parseInt(String(lastInvoice.invoiceNumber || '').split('-').pop(), 10);
      const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
      invoiceNumber = `INV-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;
    } else {
      invoiceNumber = `INV-${new Date().getFullYear()}-0001`;
    }

    // Batch load products once to avoid N+1 queries during validation and pricing.
    const uniqueProductIds = [...new Set(items.map((item) => String(item.productId)))];
    const products = await Product.find({
      _id: { $in: uniqueProductIds },
      tenantId
    }).session(session);
    const productMap = new Map(products.map((product) => [product._id.toString(), product]));

    if (productMap.size !== uniqueProductIds.length) {
      const missingProductId = uniqueProductIds.find((id) => !productMap.has(id));
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `Product not found: ${missingProductId}`
      });
    }

    const inventoryService = require('../../services/inventoryService');

    // Pre-merge identical items (same product + rate + discount)
    const mergedItemsMap = {};
    items.forEach((item) => {
      const rate = item.ratePerUnit || productMap.get(String(item.productId))?.rate || productMap.get(String(item.productId))?.newMRP;
      const key = `${item.productId}_${rate}_${item.schemeDiscount || 0}`;
      if (mergedItemsMap[key]) {
        mergedItemsMap[key].quantitySold += item.quantitySold;
        mergedItemsMap[key].freeQuantity += (item.freeQuantity || 0);
        if (item.manualAllocations) {
          mergedItemsMap[key].manualAllocations = [
            ...(mergedItemsMap[key].manualAllocations || []),
            ...item.manualAllocations
          ];
        }
      } else {
        mergedItemsMap[key] = {
          productId: item.productId,
          quantitySold: item.quantitySold,
          freeQuantity: item.freeQuantity || 0,
          ratePerUnit: item.ratePerUnit,
          schemeDiscount: item.schemeDiscount || 0,
          allocationMode: item.allocationMode,
          manualAllocations: item.manualAllocations ? [...item.manualAllocations] : undefined
        };
      }
    });

    const mergedItemsList = Object.values(mergedItemsMap);

    // Process items and validate stock
    const processedItems = [];
    const stockDeductions = new Map();

    for (const item of mergedItemsList) {
      const productId = String(item.productId);
      const product = productMap.get(productId);

      const totalQty = item.quantitySold + (item.freeQuantity || 0);
      const alreadyReservedQty = stockDeductions.get(productId) || 0;
      const nextReservedQty = alreadyReservedQty + totalQty;

      // Resolve authoritative stock based on migration state
      const stockInfo = await inventoryService.getProductEffectiveStock(tenantId, product);
      const availableStock = stockInfo.effectiveStockQty;

      // Check stock including repeated line-items of the same product.
      if (availableStock < nextReservedQty) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.productName}. Available: ${availableStock}, Required: ${nextReservedQty}`
        });
      }
      stockDeductions.set(productId, nextReservedQty);

      const rateToUse = item.ratePerUnit || product.rate || product.newMRP;

      processedItems.push(buildInvoiceItem({
        product,
        quantitySold: item.quantitySold,
        freeQuantity: item.freeQuantity || 0,
        ratePerUnit: rateToUse,
        mrp: product.newMRP,
        gstPercentage: product.gstPercentage,
        batchNo: product.batchNo || '',
        expiryDate: product.expiryDate || null,
        schemeDiscount: item.schemeDiscount || 0
      }));
    }

    // Calculate totals
    let totals = calculateInvoiceTotals(processedItems);
    totals.amountInWords = numberToWords(totals.netTotal);

    // Create invoice
    const invoice = await Invoice.create([{
      tenantId,
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
        firmGSTIN: adminInfo.firmGSTIN,
        firmDL: adminInfo.firmDL,
        paymentInformation: adminInfo.paymentInformation
      },
      items: processedItems,
      totals,
      paymentType: paymentTypeToUse,
      notes,
      createRequestId: createRequestId || undefined,
      createdBy: getAttribution(req)
    }], { session });

    const enableBatchTracking = adminInfo.preferences?.enableBatchTracking === true;

    // Update stock in bulk to minimize round-trips within the transaction.
    const stockTimestamp = new Date();
    const stockUpdateOperations = [];

    for (const [productId, deductedQty] of stockDeductions.entries()) {
      if (enableBatchTracking) continue; // Handled per-item below via inventoryService

      const product = productMap.get(productId);
      const previousQty = product.currentStockQty;
      const newQty = previousQty - deductedQty;

      stockUpdateOperations.push({
        updateOne: {
          filter: { _id: product._id, tenantId },
          update: {
            $inc: { currentStockQty: -deductedQty, stockVersion: 1 },
            $push: {
              stockHistory: {
                type: 'invoice',
                invoiceId: invoice[0]._id,
                changeQty: -deductedQty,
                previousQty,
                newQty,
                reference: invoiceNumber,
                timestamp: stockTimestamp
              }
            }
          }
        }
      });
    }

    if (stockUpdateOperations.length > 0) {
      await Product.bulkWrite(stockUpdateOperations, { session });
    }

    if (enableBatchTracking) {
      const inventoryService = require('../../services/inventoryService');
      const batchExpandedItems = [];

      for (let i = 0; i < invoice[0].items.length; i++) {
        const item = invoice[0].items[i];
        const originalItem = mergedItemsList[i];
        const product = productMap.get(item.product._id.toString());
        const totalQty = item.quantitySold + (item.freeQuantity || 0);
        let allocations = [];
        
        if (originalItem.allocationMode === 'MANUAL' && originalItem.manualAllocations) {
          allocations = await inventoryService.allocateManualStock(
            tenantId,
            item.product._id,
            originalItem.manualAllocations,
            totalQty,
            invoice[0]._id,
            invoiceNumber,
            session
          );
        } else {
          allocations = await inventoryService.allocateFifoStock(
            tenantId,
            item.product._id,
            totalQty,
            invoice[0]._id,
            invoiceNumber,
            session
          );
        }
        
        batchExpandedItems.push(...splitInvoiceItemByBatchAllocations({
          product,
          item: originalItem,
          allocations,
          allocationMode: originalItem.allocationMode || 'AUTO'
        }));
      }

      totals = calculateInvoiceTotals(batchExpandedItems);
      totals.amountInWords = numberToWords(totals.netTotal);
      invoice[0].items = batchExpandedItems;
      invoice[0].totals = totals;
      await invoice[0].save({ session });
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
    if (paymentTypeToUse === 'Credit') {
      customerUpdate.$inc.outstandingBalance = totals.netTotal;
    }

    await Customer.findOneAndUpdate(
      { _id: customerId, tenantId },
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
      const existingInvoice = await Invoice.findOne({ createRequestId, tenantId });
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
      const tenantId = getTenantId(req);

    // ── STEP 1: Fetch existing invoice ─────────────────────────────────
    const existingInvoice = await Invoice.findOne({
      _id: req.params.id,
      tenantId
    }).session(session);

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

    // ── STEP 5: Delta-based or Batch-based stock adjustment ───────────────────────────
    const adminInfo = await Admin.findById(tenantId).session(session);
    const enableBatchTracking = adminInfo.preferences?.enableBatchTracking === true;
    const inventoryService = require('../../services/inventoryService');

    const allProductIds = [
      ...new Set([...Object.keys(oldItemsMap), ...Object.keys(newItemsMap)])
    ].sort();

    const allProducts = await Product.find({
      _id: { $in: allProductIds },
      tenantId
    }).session(session);
    const productMap = {};
    for (const p of allProducts) {
      productMap[p._id.toString()] = p;
    }

    for (const pid of allProductIds) {
      if (!productMap[pid]) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Product ${pid} no longer exists. Cannot adjust stock.`
        });
      }
    }

    // Determine which products are batch-managed in this transaction
    const batchManagedProducts = new Set();
    if (enableBatchTracking) {
      Object.keys(newItemsMap).forEach(pid => batchManagedProducts.add(pid));
    }
    for (const item of existingInvoice.items) {
      if (item.batchAllocations && item.batchAllocations.length > 0) {
        batchManagedProducts.add(item.product._id.toString());
      }
    }

    // Process non-batch-managed products via Delta
    for (const pid of allProductIds) {
      if (batchManagedProducts.has(pid)) continue;

      const oldQty = oldItemsMap[pid] || 0;
      const newQty = newItemsMap[pid] || 0;
      const delta = newQty - oldQty;

      if (delta === 0) continue;

      if (delta > 0) {
        const updated = await Product.findOneAndUpdate(
          { _id: pid, tenantId, currentStockQty: { $gte: delta } },
          {
            $inc: { currentStockQty: -delta, stockVersion: 1 },
            $push: {
              stockHistory: {
                type: 'invoice_edit', invoiceId: existingInvoice._id, changeQty: -delta,
                reference: `${existingInvoice.invoiceNumber} - Edit (deducted ${delta})`, timestamp: new Date()
              }
            }
          }, { session, new: true }
        );
        if (!updated) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false, message: `Insufficient stock for ${productMap[pid].productName}. Additional required: ${delta}`
          });
        }
      } else {
        await Product.findOneAndUpdate(
          { _id: pid, tenantId },
          {
            $inc: { currentStockQty: Math.abs(delta), stockVersion: 1 },
            $push: {
              stockHistory: {
                type: 'invoice_edit', invoiceId: existingInvoice._id, changeQty: Math.abs(delta),
                reference: `${existingInvoice.invoiceNumber} - Edit (restored ${Math.abs(delta)})`, timestamp: new Date()
              }
            }
          }, { session }
        );
      }
    }

    // Process batch-managed products via Full Restore (Full Deduct happens per item later)
    for (const item of existingInvoice.items) {
      const pid = item.product._id.toString();
      if (!batchManagedProducts.has(pid)) continue;

      const oldQty = item.quantitySold + (item.freeQuantity || 0);
      if (oldQty === 0) continue;

      if (item.batchAllocations && item.batchAllocations.length > 0) {
        await inventoryService.restoreBatchAllocations(
          tenantId, pid, item.batchAllocations, oldQty, existingInvoice._id,
          `${existingInvoice.invoiceNumber} - Edit (restored ${oldQty})`, 'invoice_edit_reversal', session
        );
      } else {
        await Product.findOneAndUpdate(
          { _id: pid, tenantId },
          {
            $inc: { currentStockQty: oldQty, stockVersion: 1 },
            $push: {
              stockHistory: {
                type: 'invoice_edit_reversal', invoiceId: existingInvoice._id, changeQty: oldQty,
                reference: `${existingInvoice.invoiceNumber} - Edit (restored ${oldQty})`, timestamp: new Date()
              }
            }
          }, { session }
        );
      }
    }
    // ── END OF STOCK CHANGES ──────────────────────────────────────────

    // ── STEP 6: Process items for invoice (amounts only, NO stock logic)
    //
    // Smart duplicate merging:
    //   Same product + same rate + same discount → merge into one line
    //   Same product + different rate or discount → keep separate lines
    //
    const mergeKey = (item, index) => {
      const rate = item.ratePerUnit || productMap[item.productId.toString()]?.rate || productMap[item.productId.toString()]?.newMRP;
      return `${item.productId}_${rate}_${item.schemeDiscount || 0}`;
    };

    const mergedItemsMap = {};
    items.forEach((item, index) => {
      const key = mergeKey(item, index);
      if (mergedItemsMap[key]) {
        mergedItemsMap[key].quantitySold += item.quantitySold;
        mergedItemsMap[key].freeQuantity += (item.freeQuantity || 0);
      } else {
        mergedItemsMap[key] = {
          productId: item.productId,
          quantitySold: item.quantitySold,
          freeQuantity: item.freeQuantity || 0,
          ratePerUnit: item.ratePerUnit,
          schemeDiscount: item.schemeDiscount || 0,
          allocationMode: item.allocationMode,
          manualAllocations: item.manualAllocations
        };
      }
    });

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
      const pItem = buildInvoiceItem({
        product,
        quantitySold: item.quantitySold,
        freeQuantity: item.freeQuantity || 0,
        ratePerUnit: rateToUse,
        mrp: product.newMRP,
        gstPercentage: product.gstPercentage,
        batchNo: product.batchNo || '',
        expiryDate: product.expiryDate || null,
        schemeDiscount: item.schemeDiscount || 0
      });

      const totalQty = item.quantitySold + (item.freeQuantity || 0);

      if (enableBatchTracking) {
        let allocations = [];
        if (item.allocationMode === 'MANUAL' && item.manualAllocations) {
          allocations = await inventoryService.allocateManualStock(
            tenantId, product._id, item.manualAllocations, totalQty, existingInvoice._id,
            `${existingInvoice.invoiceNumber} - Edit`, session
          );
        } else {
          allocations = await inventoryService.allocateFifoStock(
            tenantId, product._id, totalQty, existingInvoice._id,
            `${existingInvoice.invoiceNumber} - Edit`, session
          );
        }
        processedItems.push(...splitInvoiceItemByBatchAllocations({
          product,
          item,
          allocations,
          allocationMode: item.allocationMode || 'AUTO'
        }));
        continue;
      } else if (batchManagedProducts.has(product._id.toString())) {
        // Full deduct for products that were batch-managed but aren't anymore
        await Product.findOneAndUpdate(
          { _id: product._id, tenantId },
          {
            $inc: { currentStockQty: -totalQty, stockVersion: 1 },
            $push: {
              stockHistory: {
                type: 'invoice_edit', invoiceId: existingInvoice._id, changeQty: -totalQty,
                reference: `${existingInvoice.invoiceNumber} - Edit (deducted ${totalQty})`, timestamp: new Date()
              }
            }
          }, { session }
        );
      }

      processedItems.push(pItem);
    }

    // ── STEP 7: Calculate totals ───────────────────────────────────────
    const totals = calculateInvoiceTotals(processedItems);
    totals.amountInWords = numberToWords(totals.netTotal);

    // ── STEP 8: Resolve customer ───────────────────────────────────────
    let customer = existingInvoice.customer;
    if (customerId && customerId !== existingInvoice.customer._id.toString()) {
      const newCustomer = await Customer.findOne({
        _id: customerId,
        tenantId
      }).session(session);
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
      const updatedCust = await Customer.findOneAndUpdate(
        { _id: customer._id, tenantId },
        { $inc: { totalPurchases: totalsDelta }, lastInvoiceDate: new Date() },
        { session, new: true }
      );
      // Clamp — never allow negative totalPurchases
      if (updatedCust && updatedCust.totalPurchases < 0) {
        await Customer.findOneAndUpdate(
          { _id: customer._id, tenantId },
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
      await Customer.findOneAndUpdate(
        { _id: customer._id, tenantId },
        { $inc: { outstandingBalance: outstandingDelta } },
        { session }
      );
    }

    // ── STEP 10: Update invoice document ───────────────────────────────
    const updatedInvoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, tenantId },
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
    const tenantId = getTenantId(req);

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      tenantId
    });

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

          if (item.batchAllocations && item.batchAllocations.length > 0) {
            const inventoryService = require('../../services/inventoryService');
            await inventoryService.restoreBatchAllocations(
              tenantId,
              item.product._id,
              item.batchAllocations,
              totalQty,
              invoice._id,
              `${invoice.invoiceNumber} - Cancelled`,
              'invoice_cancelled',
              session
            );
          } else {
            await Product.findOneAndUpdate(
              { _id: item.product._id, tenantId },
              {
                $inc: { currentStockQty: totalQty, stockVersion: 1 },
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

        await Customer.findOneAndUpdate(
          { _id: invoice.customer._id, tenantId },
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
            await Product.findOneAndUpdate(
              { _id: item.product._id, tenantId },
              {
                $inc: { currentStockQty: totalQty, stockVersion: 1 },
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
          await Customer.findOneAndUpdate(
            { _id: invoice.customer._id, tenantId },
            customerUpdate
          );

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

