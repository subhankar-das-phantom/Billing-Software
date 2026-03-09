const Product = require('../models/Product');
const Batch = require('../models/Batch');
const { LOW_STOCK_THRESHOLD } = require('../config/constants');
const { getAttribution } = require('../middleware/auth');
const { trackActivity, ACTIVITY_TYPES } = require('../utils/activityTracker');
const { getStockSummary } = require('../utils/fifoService');

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
      query.$or = [
        { productName: { $regex: req.query.search, $options: 'i' } },
        { hsnCode: { $regex: req.query.search, $options: 'i' } },
        { manufacturer: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(query);

    // Enrich products with batch stock data
    const productIds = products.map(p => p._id);
    const stockMap = await getStockSummary(productIds);

    const enrichedProducts = products.map(p => {
      const pObj = p.toObject();
      const batchData = stockMap[p._id.toString()];
      if (batchData) {
        pObj.totalBatchStock = batchData.totalStock;
        pObj.batchCount = batchData.batchCount;
      } else {
        pObj.totalBatchStock = 0;
        pObj.batchCount = 0;
      }
      return pObj;
    });

    res.status(200).json({
      success: true,
      count: enrichedProducts.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      products: enrichedProducts
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

    // Get batch data for this product
    const batches = await Batch.find({ productId: product._id, isActive: true })
      .sort({ expiryDate: 1, createdAt: 1 });

    const totalBatchStock = batches.reduce((sum, b) => sum + b.stock, 0);

    const productObj = product.toObject();
    productObj.batches = batches;
    productObj.totalBatchStock = totalBatchStock;
    productObj.batchCount = batches.length;

    res.status(200).json({
      success: true,
      product: productObj
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
      batchNo,
      expiryDate,
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
      batchNo,
      expiryDate,
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

    // Also create a Batch record if batchNo is provided
    if (batchNo) {
      await Batch.create({
        productId: product._id,
        batchNo,
        expiryDate,
        purchaseRate: rate || 0,
        mrp: newMRP,
        gstPercent: gstPercentage || 12,
        stock: openingStockQty || 0,
        createdBy: getAttribution(req)
      });
    }

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
      batchNo,
      expiryDate,
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
        batchNo,
        expiryDate,
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
    
    // Get batch stock for all products
    const productIds = products.map(p => p._id);
    const stockMap = await getStockSummary(productIds);

    // Filter for low stock (using batch stock if available, otherwise legacy stock)
    const lowStockProducts = products
      .map(p => {
        const pObj = p.toObject();
        const batchData = stockMap[p._id.toString()];
        if (batchData && batchData.batchCount > 0) {
          pObj.totalBatchStock = batchData.totalStock;
          pObj.batchCount = batchData.batchCount;
          pObj.effectiveStock = batchData.totalStock;
        } else {
          pObj.totalBatchStock = 0;
          pObj.batchCount = 0;
          pObj.effectiveStock = pObj.currentStockQty;
        }
        return pObj;
      })
      .filter(p => p.effectiveStock <= threshold)
      .sort((a, b) => a.effectiveStock - b.effectiveStock);

    res.status(200).json({
      success: true,
      count: lowStockProducts.length,
      products: lowStockProducts
    });
  } catch (error) {
    next(error);
  }
};
