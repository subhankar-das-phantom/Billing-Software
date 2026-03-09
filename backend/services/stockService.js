const Batch = require('../models/Batch');

class StockService {
  /**
   * Deduct stock for an array of batch allocations.
   * Assumes atomic updates using $inc within a session.
   *
   * @param {Array} allocations - [{ batchId, allocatedQty }]
   * @param {Object} session - Mongoose session
   */
  async processAllocations(allocations, session) {
    for (const alloc of allocations) {
      if (!alloc.batchId || alloc.allocatedQty <= 0) continue;

      const batch = await Batch.findOneAndUpdate(
        { _id: alloc.batchId, stock: { $gte: alloc.allocatedQty } },
        { $inc: { stock: -alloc.allocatedQty } },
        { new: true, session, runValidators: true }
      );

      if (!batch) {
        throw new Error(`Insufficient stock or batch not found for batchId ${alloc.batchId} during deduction. Concurrent update may have occurred.`);
      }

      // Sync parent product stock
      const Product = require('../models/Product');
      await Product.findByIdAndUpdate(
        batch.productId,
        { $inc: { currentStockQty: -alloc.allocatedQty } },
        { session }
      );
    }
  }

  /**
   * Restore stock to a batch (used for credit notes or invoice edits).
   *
   * @param {string} batchId - Batch to restore to
   * @param {number} qty - Quantity to restore
   * @param {Object} session - Mongoose session
   */
  async restoreStock(batchId, qty, session) {
    if (!batchId) return; // Legacy invoices without batchId handled via manual selection before reaching here

    const batch = await Batch.findByIdAndUpdate(
      batchId,
      { $inc: { stock: qty } },
      { new: true, session, runValidators: true }
    );

    if (!batch) {
        throw new Error(`Batch not found to restore stock: ${batchId}`);
    }

    // Sync parent product stock
    const Product = require('../models/Product');
    await Product.findByIdAndUpdate(
      batch.productId,
      { $inc: { currentStockQty: qty } },
      { session }
    );

    return batch;
  }

  /**
   * Adjust stock manually for damages/corrections.
   *
   * @param {string} batchId - Batch ID
   * @param {string} adjustmentType - 'IN' or 'OUT'
   * @param {number} quantity - Quantity to adjust
   * @param {string} reason - Reason for adjustment
   * @param {Object} session - Optional session
   */
  async adjustStock(batchId, adjustmentType, quantity, reason, session = null) {
    if (quantity <= 0) {
        throw new Error("Quantity must be greater than zero for adjustment.");
    }
    const amount = adjustmentType === 'IN' ? quantity : -quantity;
    
    // Validate IN/OUT
    if (adjustmentType !== 'IN' && adjustmentType !== 'OUT') {
        throw new Error("Adjustment type must be IN or OUT.");
    }

    const query = { _id: batchId };
    if (adjustmentType === 'OUT') {
      // Prevent negative stock on OUT adjustment
      query.stock = { $gte: quantity };
    }

    const batch = await Batch.findOneAndUpdate(
      query,
      { $inc: { stock: amount } },
      { new: true, session, runValidators: true }
    );

    if (!batch && adjustmentType === 'OUT') {
       throw new Error(`Insufficient stock for OUT adjustment. Batch ID: ${batchId}`);
    } else if (!batch) {
       throw new Error(`Batch not found: ${batchId}`);
    }

    // Sync parent product stock
    const Product = require('../models/Product');
    await Product.findByIdAndUpdate(
      batch.productId,
      { $inc: { currentStockQty: amount } },
      { session }
    );

    // Ideally, log the adjustment with the reason (e.g. into an InventoryLog or StockAdjustment collection)
    // For now, returning the updated batch
    return batch;
  }
}

module.exports = new StockService();
