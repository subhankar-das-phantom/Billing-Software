import mongoose, { ClientSession } from 'mongoose';
import Batch from '../models/Batch';
import Product from '../models/Product'; // Assuming Product is imported or we use mongoose.model

interface ManualAllocation {
  batchId: string;
  quantity: number;
}

interface AllocationRecord {
  batchId: mongoose.Types.ObjectId;
  batchNo: string | null;
  quantity: number;
}

export const allocateFifoStock = async (
  tenantId: mongoose.Types.ObjectId | string,
  productId: mongoose.Types.ObjectId | string,
  quantity: number,
  invoiceId: mongoose.Types.ObjectId | string,
  invoiceNumber: string,
  session: ClientSession
): Promise<AllocationRecord[]> => {
  // Get all active batches sorted by earliest expiry first (FIFO)
  const batches = await Batch.find({
    tenantId,
    productId,
    remainingQty: { $gt: 0 },
    isActive: true
  })
    .sort({ expiryDate: 1, createdAt: 1 })
    .session(session);

  const totalAvailable = batches.reduce((sum, b) => sum + b.remainingQty, 0);

  if (totalAvailable < quantity) {
    throw new Error(`Insufficient stock. Available: ${totalAvailable}, Required: ${quantity}`);
  }

  const consumptionRecords: AllocationRecord[] = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const take = Math.min(batch.remainingQty, remaining);

    // Deduct stock from this batch
    await Batch.findByIdAndUpdate(
      batch._id,
      { $inc: { remainingQty: -take } },
      { session }
    );

    consumptionRecords.push({
      batchId: batch._id as mongoose.Types.ObjectId,
      batchNo: batch.batchNo,
      quantity: take
    });

    remaining -= take;
  }

  // Deduct from parent product and add history
  const ProductModel = mongoose.model('Product');
  const product = await ProductModel.findOne({ _id: productId, tenantId }).session(session);
  if (product) {
    const previousQty = product.currentStockQty;
    const newQty = previousQty - quantity;

    await ProductModel.updateOne(
      { _id: productId, tenantId },
      {
        $inc: { currentStockQty: -quantity, stockVersion: 1 },
        $push: {
          stockHistory: {
            type: 'invoice',
            invoiceId,
            changeQty: -quantity,
            previousQty,
            newQty,
            reference: invoiceNumber,
            timestamp: new Date()
          }
        }
      },
      { session }
    );
  }

  return consumptionRecords;
};

export const allocateManualStock = async (
  tenantId: mongoose.Types.ObjectId | string,
  productId: mongoose.Types.ObjectId | string,
  manualAllocations: ManualAllocation[],
  quantity: number,
  invoiceId: mongoose.Types.ObjectId | string,
  invoiceNumber: string,
  session: ClientSession
): Promise<AllocationRecord[]> => {
  let totalAllocated = 0;
  const consumptionRecords: AllocationRecord[] = [];

  for (const alloc of manualAllocations) {
    if (!alloc.batchId || alloc.quantity <= 0 || !Number.isInteger(alloc.quantity)) {
      throw new Error(`Invalid manual allocation quantity for batch ${alloc.batchId}`);
    }

    const batch = await Batch.findOne({
      _id: alloc.batchId,
      tenantId,
      productId,
      isActive: true
    }).session(session);

    if (!batch) {
      throw new Error(`Batch not found or does not belong to this product/tenant: ${alloc.batchId}`);
    }

    if (batch.remainingQty < alloc.quantity) {
      throw new Error(`Insufficient stock in batch ${batch.batchNo}. Available: ${batch.remainingQty}, Requested: ${alloc.quantity}`);
    }

    // Deduct stock from this batch
    await Batch.findByIdAndUpdate(
      batch._id,
      { $inc: { remainingQty: -alloc.quantity } },
      { session }
    );

    consumptionRecords.push({
      batchId: batch._id as mongoose.Types.ObjectId,
      batchNo: batch.batchNo,
      quantity: alloc.quantity
    });

    totalAllocated += alloc.quantity;
  }

  if (totalAllocated !== quantity) {
    throw new Error(`Total manual allocation (${totalAllocated}) does not match requested sale quantity (${quantity})`);
  }

  // Deduct from parent product and add history
  const ProductModel = mongoose.model('Product');
  const product = await ProductModel.findOne({ _id: productId, tenantId }).session(session);
  if (product) {
    const previousQty = product.currentStockQty;
    const newQty = previousQty - quantity;

    await ProductModel.updateOne(
      { _id: productId, tenantId },
      {
        $inc: { currentStockQty: -quantity, stockVersion: 1 },
        $push: {
          stockHistory: {
            type: 'invoice',
            invoiceId,
            changeQty: -quantity,
            previousQty,
            newQty,
            reference: invoiceNumber,
            timestamp: new Date()
          }
        }
      },
      { session }
    );
  }

  return consumptionRecords;
};

export const restoreBatchAllocations = async (
  tenantId: mongoose.Types.ObjectId | string,
  productId: mongoose.Types.ObjectId | string,
  allocations: AllocationRecord[],
  quantityToRestore: number,
  invoiceId: mongoose.Types.ObjectId | string,
  invoiceNumber: string,
  type: 'invoice_cancelled' | 'invoice_edit_reversal' = 'invoice_cancelled',
  session: ClientSession
): Promise<void> => {
  if (allocations && allocations.length > 0) {
    for (const alloc of allocations) {
      await Batch.updateOne(
        { _id: alloc.batchId, tenantId },
        { $inc: { remainingQty: alloc.quantity } },
        { session }
      );
    }
  }

  // Restore parent product stock
  const ProductModel = mongoose.model('Product');
  const product = await ProductModel.findOne({ _id: productId, tenantId }).session(session);
  if (product) {
    const previousQty = product.currentStockQty;
    const newQty = previousQty + quantityToRestore;

    await ProductModel.updateOne(
      { _id: productId, tenantId },
      {
        $inc: { currentStockQty: quantityToRestore, stockVersion: 1 },
        $push: {
          stockHistory: {
            type,
            invoiceId,
            changeQty: quantityToRestore,
            previousQty,
            newQty,
            reference: invoiceNumber,
            timestamp: new Date()
          }
        }
      },
      { session }
    );
  }
};

export const validateStockAvailability = async (
  tenantId: mongoose.Types.ObjectId | string,
  productId: mongoose.Types.ObjectId | string,
  quantity: number
): Promise<boolean> => {
  const ProductModel = mongoose.model('Product');
  const product = await ProductModel.findOne({ _id: productId, tenantId }).lean();
  if (!product) return false;
  return product.currentStockQty >= quantity;
};

export const createBatch = async (
  tenantId: mongoose.Types.ObjectId | string,
  data: Partial<any>,
  session?: ClientSession
) => {
  const batch = new Batch({
    tenantId,
    ...data,
    remainingQty: data.initialQty || data.stock || 0
  });
  if (session) {
    return batch.save({ session });
  }
  return batch.save();
};
