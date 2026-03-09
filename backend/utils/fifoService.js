/**
 * FIFO Stock Consumption Service
 * 
 * Handles batch-level stock management using First-In-First-Out
 * based on earliest expiry date.
 * 
 * SAFETY: All operations use MongoDB sessions for transactional integrity.
 * If any step fails, the entire operation is rolled back.
 */
const Batch = require('../models/Batch');

/**
 * Consume stock from batches using FIFO (earliest expiry first)
 * 
 * @param {ObjectId} productId - Product to consume stock from
 * @param {Number} quantity - Total quantity to consume
 * @param {Object} session - MongoDB session for transaction
 * @returns {Array} Array of consumption records: [{ batchId, batchNo, expiryDate, mrp, gstPercent, quantity }]
 * @throws {Error} If insufficient total stock across all batches
 */
const consumeStock = async (productId, quantity, session) => {
  // Get all active batches sorted by earliest expiry first (FIFO)
  const batches = await Batch.find({
    productId,
    stock: { $gt: 0 },
    isActive: true
  })
    .sort({ expiryDate: 1, createdAt: 1 })
    .session(session);

  // Calculate total available stock
  const totalAvailable = batches.reduce((sum, b) => sum + b.stock, 0);
  
  if (totalAvailable < quantity) {
    throw new Error(`Insufficient stock. Available: ${totalAvailable}, Required: ${quantity}`);
  }

  const consumptionRecords = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const take = Math.min(batch.stock, remaining);
    
    // Deduct stock from this batch
    await Batch.findByIdAndUpdate(
      batch._id,
      { $inc: { stock: -take } },
      { session }
    );

    consumptionRecords.push({
      batchId: batch._id,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      mrp: batch.mrp,
      gstPercent: batch.gstPercent,
      rate: batch.rate,
      quantity: take
    });

    remaining -= take;
  }

  // Deduct from parent product
  const Product = require('../models/Product');
  await Product.findByIdAndUpdate(
    productId,
    { $inc: { currentStockQty: -quantity } },
    { session }
  );

  return consumptionRecords;
};

/**
 * Restore stock to batches (used for invoice cancellation/edit reversal)
 * 
 * @param {Array} consumptionRecords - Array of { batchId, quantity } to restore
 * @param {Object} session - MongoDB session for transaction
 */
const restoreStock = async (consumptionRecords, session) => {
  for (const record of consumptionRecords) {
    if (!record.batchId || !record.quantity) continue;
    
    const updatedBatch = await Batch.findByIdAndUpdate(
      record.batchId,
      { $inc: { stock: record.quantity } },
      { session, new: true }
    );
    
    if (updatedBatch) {
      const Product = require('../models/Product');
      await Product.findByIdAndUpdate(
        updatedBatch.productId,
        { $inc: { currentStockQty: record.quantity } },
        { session }
      );
    }
  }
};

/**
 * Restore stock to a specific batch by ID
 * 
 * @param {ObjectId} batchId - Batch to restore stock to
 * @param {Number} quantity - Quantity to restore
 * @param {Object} session - MongoDB session for transaction
 */
const restoreStockToBatch = async (batchId, quantity, session) => {
  const updatedBatch = await Batch.findByIdAndUpdate(
    batchId,
    { $inc: { stock: quantity } },
    { session, new: true }
  );
  
  if (updatedBatch) {
    const Product = require('../models/Product');
    await Product.findByIdAndUpdate(
      updatedBatch.productId,
      { $inc: { currentStockQty: quantity } },
      { session }
    );
  }
};

/**
 * Get total stock for a product across all batches
 * 
 * @param {ObjectId} productId - Product ID
 * @returns {Number} Total stock
 */
const getTotalStock = async (productId) => {
  const result = await Batch.aggregate([
    { $match: { productId: productId, isActive: true } },
    { $group: { _id: null, totalStock: { $sum: '$stock' } } }
  ]);
  return result.length > 0 ? result[0].totalStock : 0;
};

/**
 * Get stock summary for multiple products (bulk operation)
 * 
 * @param {Array} productIds - Array of product ObjectIds
 * @returns {Object} Map of productId -> { totalStock, batchCount }
 */
const getStockSummary = async (productIds) => {
  const result = await Batch.aggregate([
    { $match: { productId: { $in: productIds }, isActive: true } },
    {
      $group: {
        _id: '$productId',
        totalStock: { $sum: '$stock' },
        batchCount: { $sum: 1 }
      }
    }
  ]);

  const map = {};
  for (const item of result) {
    map[item._id.toString()] = {
      totalStock: item.totalStock,
      batchCount: item.batchCount
    };
  }
  return map;
};

module.exports = {
  consumeStock,
  restoreStock,
  restoreStockToBatch,
  getTotalStock,
  getStockSummary
};
