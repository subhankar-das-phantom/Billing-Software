const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const CreditNote = require('../models/CreditNote');
const ManualEntry = require('../models/ManualEntry');
const { getAttribution } = require('../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../utils/activityTracker');
const mongoose = require('mongoose');

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
    const { startDate, endDate, sortOrder, limit = 200, offset = 0 } = req.query;
    
    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const objectId = new mongoose.Types.ObjectId(customerId);

    // Parse dates
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set time to end of day for the end date to include the whole day
    if (endDate) {
      end.setHours(23, 59, 59, 999);
    }

    // --- 1. Compute Opening Balance Using Aggregate ($unionWith) ---
    let openingBalanceDebit = 0;
    let openingBalanceCredit = 0;

    if (start) {
      const openingBalanceResult = await Invoice.aggregate([
        { 
          $match: { 
            'customer._id': objectId, 
            invoiceDate: { $lt: start }, 
            status: { $ne: 'Cancelled' } 
          } 
        },
        { 
          $project: { _id: 0, debit: '$totals.netTotal', credit: { $literal: 0 } } 
        },
        {
          $unionWith: {
            coll: 'payments',
            pipeline: [
              { $match: { customer: objectId, paymentDate: { $lt: start } } },
              { $project: { _id: 0, debit: { $literal: 0 }, credit: '$amount' } }
            ]
          }
        },
        {
          $unionWith: {
            coll: 'creditnotes',
            pipeline: [
              { $match: { 'customer._id': objectId, createdAt: { $lt: start } } },
              { $project: { _id: 0, debit: { $literal: 0 }, credit: '$totals.netTotal' } }
            ]
          }
        },
        {
          $unionWith: {
            coll: 'manualentries',
            pipeline: [
              { $match: { customer: objectId, entryDate: { $lt: start } } },
              { 
                $project: { 
                  _id: 0, 
                  debit: { 
                    $cond: [{ $in: ['$entryType', ['opening_balance', 'manual_bill']] }, '$amount', 0] 
                  },
                  credit: { 
                    $cond: [{ $in: ['$entryType', ['payment_adjustment', 'credit_adjustment']] }, '$amount', 0] 
                  }
                } 
              }
            ]
          }
        },
        {
          $group: {
            _id: null,
            totalDebit: { $sum: '$debit' },
            totalCredit: { $sum: '$credit' }
          }
        }
      ]);

      if (openingBalanceResult.length > 0) {
        openingBalanceDebit = openingBalanceResult[0].totalDebit || 0;
        openingBalanceCredit = openingBalanceResult[0].totalCredit || 0;
      }
    }

    // Compute net opening balance 
    const netOpening = openingBalanceDebit - openingBalanceCredit;
    const isOpeningCredit = netOpening < 0;

    // --- 2. Fetch Ledger Entries Using Aggregate ($unionWith) ---
    const dateMatchInvoice = start ? { invoiceDate: { $gte: start, $lte: end } } : { invoiceDate: { $lte: end } };
    const dateMatchPayment = start ? { paymentDate: { $gte: start, $lte: end } } : { paymentDate: { $lte: end } };
    const dateMatchCreditNote = start ? { createdAt: { $gte: start, $lte: end } } : { createdAt: { $lte: end } };
    const dateMatchManual = start ? { entryDate: { $gte: start, $lte: end } } : { entryDate: { $lte: end } };

    const ledgerEntries = await Invoice.aggregate([
      // Invoices pipeline
      { 
        $match: { 'customer._id': objectId, status: { $ne: 'Cancelled' }, ...dateMatchInvoice } 
      },
      { 
        $project: { 
          date: '$invoiceDate', 
          type: { $literal: 'Invoice' }, 
          debit: '$totals.netTotal', 
          credit: { $literal: 0 }, 
          ref: '$invoiceNumber', 
          linkId: '$_id', 
          linkType: { $literal: 'invoice' },
          items: '$items' 
        } 
      },
      // Payments union
      {
        $unionWith: {
          coll: 'payments',
          pipeline: [
            { $match: { customer: objectId, ...dateMatchPayment } },
            { 
              $lookup: {
                from: 'invoices',
                localField: 'invoice',
                foreignField: '_id',
                as: 'invoiceData'
              }
            },
            {
              $project: { 
                date: '$paymentDate', 
                type: { $literal: 'Payment' }, 
                debit: { $literal: 0 }, 
                credit: '$amount', 
                ref: {
                  $cond: { 
                    if: { $gt: [{ $size: '$invoiceData' }, 0] }, 
                    then: { $arrayElemAt: ['$invoiceData.invoiceNumber', 0] }, 
                    else: '-' 
                  }
                },
                linkId: '$invoice', 
                linkType: { $literal: 'payment' },
                descriptionInfo: { 
                  method: '$paymentMethod', 
                  ref: '$referenceNumber', 
                  notes: '$notes' 
                }
              } 
            }
          ]
        }
      },
      // Credit Notes union
      {
        $unionWith: {
          coll: 'creditnotes',
          pipeline: [
            { $match: { 'customer._id': objectId, ...dateMatchCreditNote } },
            { 
              $project: { 
                date: '$createdAt', 
                type: { $literal: 'Credit Note' }, 
                debit: { $literal: 0 }, 
                credit: '$totals.netTotal', 
                ref: '$creditNoteNumber', 
                linkId: '$_id', 
                linkType: { $literal: 'creditNote' },
                invoiceNumber: '$invoiceNumber'
              } 
            }
          ]
        }
      },
      // Manual Entries union
      {
        $unionWith: {
          coll: 'manualentries',
          pipeline: [
            { $match: { customer: objectId, ...dateMatchManual } },
            { 
              $project: { 
                date: '$entryDate', 
                type: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$entryType', 'opening_balance'] }, then: 'Opening Balance' },
                      { case: { $eq: ['$entryType', 'manual_bill'] }, then: 'Manual Bill' },
                      { case: { $eq: ['$entryType', 'payment_adjustment'] }, then: 'Payment Adjustment' },
                      { case: { $eq: ['$entryType', 'credit_adjustment'] }, then: 'Credit Adjustment' }
                    ],
                    default: '$entryType'
                  }
                }, 
                debit: { 
                  $cond: [{ $in: ['$entryType', ['opening_balance', 'manual_bill']] }, '$amount', 0] 
                },
                credit: { 
                  $cond: [{ $in: ['$entryType', ['payment_adjustment', 'credit_adjustment']] }, '$amount', 0] 
                }, 
                ref: { $concat: ['ME-', { $toUpper: { $substr: [{ $toString: '$_id' }, 18, 6] } }] }, 
                linkId: '$_id', 
                linkType: { $literal: 'manualEntry' },
                descriptionInfo: { 
                  desc: '$description',
                  method: '$paymentMethod'
                }
              } 
            }
          ]
        }
      },
      { $sort: { date: 1 } },
      {
        $facet: {
          metadata: [
            { $count: 'totalCount' }
          ],
          skippedSum: [
            { $limit: parsedOffset > 0 ? parsedOffset : 1 }, // limit 1 if offset 0 to avoid empty pipeline error in some mongo versions
            { 
               $group: { 
                 _id: null, 
                 skippedDebit: { $sum: '$debit' }, 
                 skippedCredit: { $sum: '$credit' } 
               } 
            }
          ],
          data: [
            { $skip: parsedOffset },
            { $limit: parsedLimit }
          ]
        }
      }
    ]);

    const result = ledgerEntries[0] || { metadata: [], skippedSum: [], data: [] };
    const rawData = result.data || [];
    const totalCount = result.metadata[0]?.totalCount || 0;
    
    let skippedDebit = 0;
    let skippedCredit = 0;
    
    if (parsedOffset > 0 && result.skippedSum.length > 0) {
      skippedDebit = result.skippedSum[0].skippedDebit || 0;
      skippedCredit = result.skippedSum[0].skippedCredit || 0;
    }

    // Build ledger array from sorted raw aggregated entries
    const entries = [];

    // Format fields in JS cleanly
    for (const item of rawData) {
      let description = '';
      let mode = '-';

      if (item.type === 'Invoice') {
        const productSummary = (item.items || [])
          .map(i => i.product?.productName || 'Product')
          .slice(0, 3)
          .join(', ');
        const suffix = item.items?.length > 3 ? ` +${item.items.length - 3} more` : '';
        description = productSummary + (suffix || '');
        delete item.items;
      } else if (item.type === 'Payment') {
        const info = item.descriptionInfo || {};
        mode = info.method || 'Cash';
        description = `${info.ref ? 'Ref: ' + info.ref : ''}${info.notes ? ' — ' + info.notes : ''}`.trim() || 'Payment Received';
        delete item.descriptionInfo;
      } else if (item.type === 'Credit Note') {
        description = `Return against ${item.invoiceNumber || 'Unknown'}`;
        delete item.invoiceNumber;
      } else {
        // Manual entry
        const info = item.descriptionInfo || {};
        if (item.type === 'Opening Balance') {
          description = 'Opening balance carried forward from previous records';
        } else {
          description = info.desc || item.type;
        }
        
        if (['Payment Adjustment', 'Opening Balance', 'Manual Bill'].includes(item.type)) {
           mode = info.method || 'Cash';
        }
        
        delete item.descriptionInfo;
      }

      item.description = description || item.type;
      item.mode = mode;
      item.debit = round2(item.debit);
      item.credit = round2(item.credit);

      entries.push(item);
    }

    // --- 3. Compute running balance ---
    let runningBalance = netOpening + (skippedDebit - skippedCredit);
    
    // Period total variables
    let totalDebit = round2(openingBalanceDebit + skippedDebit);
    let totalCredit = round2(openingBalanceCredit + skippedCredit);

    // If there is an opening balance, inject it as the first row natively
    // We only show the Opening Balance row on the FIRST page (offset === 0)
    if (start && netOpening !== 0 && parsedOffset === 0) {
      entries.unshift({
        date: start, // Place at start date
        type: 'Opening Balance',
        ref: '-',
        description: 'B/F Balance',
        debit: !isOpeningCredit ? round2(Math.abs(netOpening)) : 0,
        credit: isOpeningCredit ? round2(Math.abs(netOpening)) : 0,
        linkId: null,
        linkType: 'system',
        balance: round2(netOpening),
        isOpeningRow: true
      });
    } else if (parsedOffset > 0) {
      // If we are on page 2+, inject a "Brought Forward" row representing everything prior
      entries.unshift({
        date: rawData.length > 0 ? rawData[0].date : start || new Date(),
        type: 'Brought Forward',
        ref: '-',
        description: 'Balance from previous pages',
        debit: runningBalance > 0 ? round2(Math.abs(runningBalance)) : 0,
        credit: runningBalance < 0 ? round2(Math.abs(runningBalance)) : 0,
        linkId: null,
        linkType: 'system',
        balance: round2(runningBalance),
        isOpeningRow: true
      });
    } else if (!start) {
      // If full history fetched and offset 0, no explicit prior opening balance.
      totalDebit = 0;
      totalCredit = 0;
    }

    let currentBalance = round2(runningBalance);

    for (let i = 0; i < entries.length; i++) {
       if (entries[i].isOpeningRow) {
          continue;
       }
       currentBalance = round2(currentBalance + entries[i].debit - entries[i].credit);
       entries[i].balance = currentBalance;
       
       // Track totals for the queried period (plus opening history)
       if (start || !entries[i].isOpeningRow) {
          totalDebit = round2(totalDebit + entries[i].debit);
          totalCredit = round2(totalCredit + entries[i].credit);
       }
    }

    // Reverse if requested
    if (sortOrder === 'desc') {
      entries.reverse();
    }

    res.status(200).json({
      success: true,
      count: entries.length,
      totalCount,
      hasMore: (parsedOffset + parsedLimit) < totalCount,
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
