const Batch = require('../models/Batch');
const Product = require('../models/Product');
const { getAttribution } = require('../middleware/auth');

// @desc    Get batches for a product
// @route   GET /api/batches/product/:productId
// @access  Private
exports.getBatchesByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const batches = await Batch.find({ productId, isActive: true })
      .sort({ expiryDate: 1, createdAt: 1 });

    const totalStock = batches.reduce((sum, b) => sum + b.stock, 0);

    res.status(200).json({
      success: true,
      count: batches.length,
      totalStock,
      batches
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new batch
// @route   POST /api/batches
// @access  Private
exports.createBatch = async (req, res, next) => {
  try {
    const {
      productId,
      batchNo,
      expiryDate,
      rate,
      mrp,
      gstPercent,
      stock
    } = req.body;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const batch = await Batch.create({
      productId,
      batchNo: batchNo || null,
      expiryDate: expiryDate || null,
      rate: rate || 0,
      mrp,
      gstPercent: gstPercent !== undefined ? gstPercent : product.gstPercentage,
      stock: stock || 0,
      createdBy: getAttribution(req)
    });

    // Also update the Product's legacy fields for backward compatibility
    // This keeps existing code working while we transition
    await Product.findByIdAndUpdate(productId, {
      $inc: { currentStockQty: stock || 0 },
      lastUpdatedBy: getAttribution(req)
    });

    res.status(201).json({
      success: true,
      batch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update batch details
// @route   PUT /api/batches/:id
// @access  Private
exports.updateBatch = async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const {
      batchNo,
      expiryDate,
      rate,
      mrp,
      gstPercent
    } = req.body;

    const updateData = {};
    if (batchNo !== undefined) updateData.batchNo = batchNo || null;
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate || null;
    if (rate !== undefined) updateData.rate = rate;
    if (mrp !== undefined) updateData.mrp = mrp;
    if (gstPercent !== undefined) updateData.gstPercent = gstPercent;

    const updatedBatch = await Batch.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      batch: updatedBatch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Adjust batch stock
// @route   PUT /api/batches/:id/adjust-stock
// @access  Private
exports.adjustBatchStock = async (req, res, next) => {
  try {
    const { adjustmentType, quantity, reason } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    if (!adjustmentType || !['IN', 'OUT'].includes(adjustmentType)) {
      return res.status(400).json({
        success: false,
        message: 'Valid adjustmentType (IN or OUT) is required'
      });
    }

    const stockService = require('../services/stockService');
    
    // We catch the specific errors from stockService and return 400 or 404
    try {
        const batch = await stockService.adjustStock(req.params.id, adjustmentType, quantity, reason);
        res.status(200).json({
          success: true,
          batch
        });
    } catch (err) {
        if (err.message.includes('not found')) {
          return res.status(404).json({ success: false, message: err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete batch (only if stock is 0)
// @route   DELETE /api/batches/:id
// @access  Private
exports.deleteBatch = async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    if (batch.stock > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete batch with ${batch.stock} units in stock. Adjust stock to 0 first.`
      });
    }

    batch.isActive = false;
    await batch.save();

    res.status(200).json({
      success: true,
      message: 'Batch deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
