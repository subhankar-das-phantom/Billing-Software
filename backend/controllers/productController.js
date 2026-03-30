const Product = require('../models/Product');
const { LOW_STOCK_THRESHOLD } = require('../config/constants');
const { getAttribution } = require('../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../utils/activityTracker');

// Escape special regex characters in user input to prevent MongoDB $regex errors
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getSearchPattern = (search, usePrefix = false) => {
  const escaped = escapeRegex(search);
  return usePrefix ? `^${escaped}` : escaped;
};

// @desc    Get all products
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = { isActive: true };

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

    const baseQuery = { isActive: true };

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
    const product = await Product.findById(req.params.id);

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
    let product = await Product.findById(req.params.id);

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

    product = await Product.findByIdAndUpdate(
      req.params.id,
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
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const previousQty = product.currentStockQty;
    const adjustment = type === 'in' ? quantity : -quantity;
    const newQty = previousQty + adjustment;

    // Validate stock won't go negative
    if (newQty < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient stock. Cannot remove more than available quantity.' 
      });
    }

    product.currentStockQty = newQty;
    
    product.stockHistory.push({
      type: 'adjustment',
      changeQty: adjustment,
      previousQty,
      newQty,
      reference: reason || 'Stock adjustment',
      timestamp: new Date(),
      adjustedBy: getAttribution(req)
    });

    // Update lastUpdatedBy
    product.lastUpdatedBy = getAttribution(req);

    await product.save();

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
    const product = await Product.findById(req.params.id);

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

    // Get all active products
    const products = await Product.find({ isActive: true });
    
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
