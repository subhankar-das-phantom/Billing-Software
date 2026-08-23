const mongoose = require('mongoose');
const Product = require('../models/Product');
const { LOW_STOCK_THRESHOLD } = require('../config/constants');
const { getAttribution } = require('../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../utils/activityTracker');
const getTenantId = require('../utils/getTenantId');

const { escapeRegex, getSearchPattern } = require('../utils/searchUtils');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const tenantId = getTenantId(req);

    const query = { tenantId, isActive: true };

    // Search
    if (req.query.search) {
      const usePrefix = req.query.prefix === 'true';
      const pattern = getSearchPattern(req.query.search, usePrefix);
      query.$or = [
        { productName: { $regex: pattern, $options: 'i' } },
        { hsnCode: { $regex: pattern, $options: 'i' } },
        { manufacturer: { $regex: pattern, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product statistics
// @route   GET /api/products/stats
// @access  Private
exports.getProductStats = async (req, res, next) => {
  try {
    const today = new Date();
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + 30);
    const tenantId = getTenantId(req);

    const baseQuery = { tenantId, isActive: true };

    if (req.query.search) {
      const usePrefix = req.query.prefix === 'true';
      const pattern = getSearchPattern(req.query.search, usePrefix);
      baseQuery.$or = [
        { productName: { $regex: pattern, $options: 'i' } },
        { hsnCode: { $regex: pattern, $options: 'i' } },
        { manufacturer: { $regex: pattern, $options: 'i' } }
      ];
    }

    const [
      total,
      lowStock,
      outOfStock,
      expiringSoon
    ] = await Promise.all([
      Product.countDocuments(baseQuery),
      Product.countDocuments({ ...baseQuery, currentStockQty: { $lte: LOW_STOCK_THRESHOLD, $gt: 0 } }),
      Product.countDocuments({ ...baseQuery, currentStockQty: 0 }),
      Product.countDocuments({ ...baseQuery, expiryDate: { $gt: today, $lte: threshold } })
    ]);

    res.status(200).json({
      success: true,
      total,
      lowStock,
      outOfStock,
      expiringSoon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
exports.getProduct = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const product = await Product.findOne({
      _id: req.params.id,
      tenantId
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private
exports.createProduct = async (req, res, next) => {
  try {
    const {
      productName,
      hsnCode,
      manufacturer,
      oldMRP,
      newMRP,
      rate,
      gstPercentage,
      openingStockQty,
      unit
    } = req.body;

    const product = await Product.create({
      tenantId: getTenantId(req),
      productName,
      hsnCode,
      manufacturer,
      oldMRP,
      newMRP,
      rate,
      gstPercentage,
      openingStockQty,
      currentStockQty: openingStockQty || 0,
      unit,
      createdBy: getAttribution(req),
      stockHistory: openingStockQty ? [{
        type: 'opening',
        changeQty: openingStockQty,
        previousQty: 0,
        newQty: openingStockQty,
        reference: 'Opening Stock',
        timestamp: new Date(),
        adjustedBy: getAttribution(req)
      }] : []
    });

    // Track employee activity
    trackActivity(req, ACTIVITY_TYPES.PRODUCT_ADDED);

    res.status(201).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
exports.updateProduct = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    let product = await Product.findOne({
      _id: req.params.id,
      tenantId
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const {
      productName,
      hsnCode,
      manufacturer,
      oldMRP,
      newMRP,
      rate,
      gstPercentage,
      unit
    } = req.body;

    product = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      {
        productName,
        hsnCode,
        manufacturer,
        oldMRP,
        newMRP,
        rate,
        gstPercentage,
        unit,
        lastUpdatedBy: getAttribution(req)
      },
      { new: true, runValidators: true }
    );

    // Track employee activity
    trackActivity(req, ACTIVITY_TYPES.PRODUCT_UPDATED);

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Adjust product stock
// @route   PUT /api/products/:id/stock
// @access  Private
exports.adjustStock = async (req, res, next) => {
  try {
    const { quantity, type, reason } = req.body;
    const tenantId = getTenantId(req);
    
    // Validate required fields
    if (quantity === undefined || quantity === null || quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid quantity is required' 
      });
    }

    if (!type || !['in', 'out'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid type (in or out) is required' 
      });
    }

    const adjustment = type === 'in' ? quantity : -quantity;

    // Build the filter — for stock-out, guard against negative stock atomically
    const filter = {
      _id: req.params.id,
      tenantId
    };
    if (type === 'out') {
      filter.currentStockQty = { $gte: quantity };
    }

    // Read current product first to get previousQty for stockHistory
    const currentProduct = await Product.findOne({ _id: req.params.id, tenantId });
    if (!currentProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const previousQty = currentProduct.currentStockQty;
    const newQty = previousQty + adjustment;

    // Validate stock won't go negative (pre-check for better error message)
    if (newQty < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient stock. Cannot remove more than available quantity.' 
      });
    }

    console.log('[DEBUG] Executing adjustStock with $inc:', { currentStockQty: adjustment, stockVersion: 1 });
    // Atomic update: $inc both currentStockQty and stockVersion in the same operation
    const product = await Product.findOneAndUpdate(
      filter,
      {
        $inc: { currentStockQty: adjustment, stockVersion: 1 },
        $push: {
          stockHistory: {
            type: 'adjustment',
            changeQty: adjustment,
            previousQty,
            newQty,
            reference: reason || 'Stock adjustment',
            timestamp: new Date(),
            adjustedBy: getAttribution(req)
          }
        },
        $set: { lastUpdatedBy: getAttribution(req) }
      },
      { new: true, runValidators: true }
    );

    // If product is null, the guard condition failed (concurrent stock-out race)
    if (!product) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient stock. Cannot remove more than available quantity.' 
      });
    }

    // Track employee activity
    trackActivity(req, ACTIVITY_TYPES.STOCK_ADJUSTED);

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
// @access  Private
exports.deleteProduct = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const product = await Product.findOne({
      _id: req.params.id,
      tenantId
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isActive = false;
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get low stock products
// @route   GET /api/products/stock/low
// @access  Private
exports.getLowStock = async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold) || LOW_STOCK_THRESHOLD;
    const tenantId = getTenantId(req);

    // Get all active products
    const products = await Product.find({ tenantId, isActive: true });
    
    // Filter for low stock
    const lowStockProducts = products
      .filter(p => p.currentStockQty <= threshold)
      .sort((a, b) => a.currentStockQty - b.currentStockQty);

    res.status(200).json({
      success: true,
      count: lowStockProducts.length,
      products: lowStockProducts
    });
  } catch (error) {
    next(error);
  }
};

// Valid stock history types from the schema
const VALID_STOCK_HISTORY_TYPES = [
  'invoice', 'invoice_edit', 'invoice_edit_reversal',
  'invoice_cancelled', 'adjustment', 'opening', 'sales_return'
];

// @desc    Get paginated stock history for a product
// @route   GET /api/products/:id/stock-history
// @access  Private
//
// Cursor-based pagination using subdocument _id.
// Assumption: _id creation order matches chronological order (entries are always
// appended at the moment they occur, never backfilled). If historical imports
// are introduced, revisit to sort by timestamp DESC with _id as tiebreaker.
exports.getStockHistory = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const productId = req.params.id;

    // --- Validate & parse query params ---
    let limit = parseInt(req.query.limit) || 20;
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;

    let beforeCursor = null;
    if (req.query.before) {
      if (!mongoose.Types.ObjectId.isValid(req.query.before)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid cursor: "before" must be a valid ObjectId'
        });
      }
      beforeCursor = new mongoose.Types.ObjectId(req.query.before);
    }

    let typeFilter = null;
    if (req.query.type) {
      if (!VALID_STOCK_HISTORY_TYPES.includes(req.query.type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid type filter. Must be one of: ${VALID_STOCK_HISTORY_TYPES.join(', ')}`
        });
      }
      typeFilter = req.query.type;
    }

    // --- Build aggregation pipeline ---
    const pipeline = [
      // Match the specific product
      { $match: { _id: new mongoose.Types.ObjectId(productId), tenantId: new mongoose.Types.ObjectId(tenantId) } },

      // Get total count of valid stock history entries before unwinding
      {
        $addFields: {
          _totalValidHistory: {
            $size: {
              $filter: {
                input: '$stockHistory',
                as: 'entry',
                cond: {
                  $and: [
                    { $ne: ['$$entry', null] },
                    { $ne: ['$$entry.timestamp', null] },
                    { $ne: ['$$entry.type', null] }
                  ]
                }
              }
            }
          }
        }
      },

      // Unwind the stock history array
      { $unwind: '$stockHistory' },

      // Filter out malformed entries (null, missing timestamp, missing type)
      {
        $match: {
          'stockHistory.timestamp': { $ne: null, $exists: true },
          'stockHistory.type': { $ne: null, $exists: true }
        }
      }
    ];

    // Apply cursor filter if provided
    if (beforeCursor) {
      pipeline.push({
        $match: { 'stockHistory._id': { $lt: beforeCursor } }
      });
    }

    // Apply type filter if provided
    if (typeFilter) {
      pipeline.push({
        $match: { 'stockHistory.type': typeFilter }
      });
    }

    // Sort by _id descending (newest first — ObjectIds are monotonically increasing)
    pipeline.push({ $sort: { 'stockHistory._id': -1 } });

    // Fetch limit + 1 to determine hasMore
    pipeline.push({ $limit: limit + 1 });

    // Group back into a single document with the items array and total
    pipeline.push({
      $group: {
        _id: '$_id',
        total: { $first: '$_totalValidHistory' },
        items: {
          $push: {
            _id: '$stockHistory._id',
            type: '$stockHistory.type',
            changeQty: '$stockHistory.changeQty',
            previousQty: '$stockHistory.previousQty',
            newQty: '$stockHistory.newQty',
            reference: '$stockHistory.reference',
            invoiceId: '$stockHistory.invoiceId',
            timestamp: '$stockHistory.timestamp',
            adjustedBy: '$stockHistory.adjustedBy'
          }
        }
      }
    });

    const result = await Product.aggregate(pipeline);

    // Handle case where product not found or no stock history
    if (!result || result.length === 0) {
      // Check if product exists
      const productExists = await Product.exists({ _id: productId, tenantId });
      if (!productExists) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      // Product exists but no stock history (or all filtered out)
      return res.status(200).json({
        items: [],
        pagination: {
          limit,
          total: 0,
          hasMore: false
        }
      });
    }

    const { items, total } = result[0];

    // Determine hasMore by checking if we got more than `limit` items
    const hasMore = items.length > limit;
    const paginatedItems = hasMore ? items.slice(0, limit) : items;

    // nextCursor is the _id of the last item in the current page
    const nextCursor = hasMore && paginatedItems.length > 0
      ? paginatedItems[paginatedItems.length - 1]._id
      : undefined;

    res.status(200).json({
      items: paginatedItems,
      pagination: {
        limit,
        total,
        hasMore,
        ...(nextCursor && { nextCursor })
      }
    });
  } catch (error) {
    next(error);
  }
};
