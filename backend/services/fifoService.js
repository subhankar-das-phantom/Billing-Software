const Batch = require('../models/Batch');

class FifoService {
  /**
   * Determine the exact batch allocations required to fulfill a sale quantity.
   * Does NOT modify the database. Returns an array of allocations.
   *
   * @param {string} productId - The product ID
   * @param {number} requiredQty - Total quantity to be sold
   * @param {string} allocationMode - 'AUTO' or 'MANUAL'
   * @param {Array} manualAllocations - [{ batchId, quantity }] when Mode is MANUAL
   * @returns {Promise<Array>} Array of { batchId, batchNo, allocatedQty, expiryDate }
   */
  async calculateAllocations(productId, requiredQty, allocationMode = 'AUTO', manualAllocations = []) {
    if (allocationMode === 'MANUAL') {
      return this._handleManualAllocation(productId, requiredQty, manualAllocations);
    } else {
      return this._handleAutoFifoAllocation(productId, requiredQty);
    }
  }

  async _handleManualAllocation(productId, requiredQty, manualAllocations) {
    if (!manualAllocations || manualAllocations.length === 0) {
      throw new Error("Manual allocations are required when using MANUAL mode.");
    }

    const totalManualQty = manualAllocations.reduce((sum, alloc) => sum + Number(alloc.quantity), 0);
    if (totalManualQty !== requiredQty) {
      throw new Error(`Total manual allocated quantity (${totalManualQty}) does not match required invoice item quantity (${requiredQty}).`);
    }

    const finalAllocations = [];

    // Verify each manual allocation against actual stock
    for (const alloc of manualAllocations) {
      if (alloc.quantity <= 0) continue;

      const batch = await Batch.findById(alloc.batchId);
      if (!batch) {
        throw new Error(`Batch ID ${alloc.batchId} not found.`);
      }

      if (batch.productId.toString() !== productId.toString()) {
        throw new Error(`Batch ID ${alloc.batchId} does not belong to the correct product.`);
      }

      if (batch.stock < alloc.quantity) {
        throw new Error(`Insufficient stock in Batch ${batch.batchNo || 'Unknown'}. Available: ${batch.stock}, Requested: ${alloc.quantity}.`);
      }

      finalAllocations.push({
        batchId: batch._id,
        batchNo: batch.batchNo,
        allocatedQty: Number(alloc.quantity),
        expiryDate: batch.expiryDate,
        rate: batch.rate,
        mrp: batch.mrp
      });
    }

    return finalAllocations;
  }

  async _handleAutoFifoAllocation(productId, requiredQty) {
    // Fetch all active batches with available stock for this product
    const batches = await Batch.find({
      productId,
      stock: { $gt: 0 },
      isActive: true
    }).exec();

    // Calculate total available stock to safely reject if insufficient
    const totalStock = batches.reduce((sum, b) => sum + b.stock, 0);
    if (totalStock < requiredQty) {
      throw new Error(`Insufficient total stock for product. Required: ${requiredQty}, Available: ${totalStock}.`);
    }

    // Sort FIFO based on Expiry Date
    // Priority: Earliest date first, null dates LAST.
    batches.sort((a, b) => {
      // If both are null, order doesn't strongly matter, perhaps by oldest created
      if (!a.expiryDate && !b.expiryDate) {
        return a.createdAt - b.createdAt;
      }
      // If a is null, put it after b
      if (!a.expiryDate) return 1;
      // If b is null, put it after a
      if (!b.expiryDate) return -1;
      // Normal date compare
      return a.expiryDate.getTime() - b.expiryDate.getTime();
    });

    const finalAllocations = [];
    let remainingQty = requiredQty;

    // Allocate stock greedily from sorted batches
    for (const batch of batches) {
      if (remainingQty <= 0) break;

      const takeQty = Math.min(batch.stock, remainingQty);

      finalAllocations.push({
        batchId: batch._id,
        batchNo: batch.batchNo,
        allocatedQty: takeQty,
        expiryDate: batch.expiryDate,
        rate: batch.rate,
        mrp: batch.mrp
      });

      remainingQty -= takeQty;
    }

    if (remainingQty > 0) {
      // Safety net: shouldn't hit this if totalStock >= requiredQty, but good to ensure
      throw new Error(`Failed to allocate full quantity via FIFO. Missing: ${remainingQty}`);
    }

    return finalAllocations;
  }
}

module.exports = new FifoService();
