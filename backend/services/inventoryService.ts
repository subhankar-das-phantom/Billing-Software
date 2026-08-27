import mongoose, { ClientSession } from 'mongoose';
import Batch from '../models/Batch';
import Product from '../models/Product';
import Admin from '../models/Admin';
import ProductInventoryMigration from '../models/ProductInventoryMigration';

export const NO_BATCH_BATCH_NO = 'UNNAMED';
const MIGRATION_IN_PROGRESS_MESSAGE = 'Migration in progress';

export const normalizeBatchNo = (batchNo: unknown): string => {
  if (typeof batchNo === 'string') {
    const trimmed = batchNo.trim();
    return trimmed || NO_BATCH_BATCH_NO;
  }

  return batchNo ? String(batchNo) : NO_BATCH_BATCH_NO;
};

const createMigrationInProgressError = () => {
  const error = new Error(MIGRATION_IN_PROGRESS_MESSAGE) as Error & { statusCode?: number };
  error.statusCode = 409;
  return error;
};

interface ManualAllocation {
  batchId: string;
  quantity: number;
}

interface AllocationRecord {
  batchId: mongoose.Types.ObjectId;
  batchNo: string | null;
  quantity: number;
  expiryDate: Date | null;
}

export const allocateFifoStock = async (
  tenantId: mongoose.Types.ObjectId | string,
  productId: mongoose.Types.ObjectId | string,
  quantity: number,
  invoiceId: mongoose.Types.ObjectId | string,
  invoiceNumber: string,
  session: ClientSession
): Promise<AllocationRecord[]> => {
  await ensureProductMigratedToBatch(tenantId, productId, session);

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
      quantity: take,
      expiryDate: batch.expiryDate || null
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
        $inc: { stockVersion: 1 },
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
  await ensureProductMigratedToBatch(tenantId, productId, session);

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
      quantity: alloc.quantity,
      expiryDate: batch.expiryDate || null
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
        $inc: { stockVersion: 1 },
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
        $inc: { stockVersion: 1 },
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
  const stockInfo = await getProductEffectiveStock(tenantId, product);
  return stockInfo.effectiveStockQty >= quantity;
};

export const createBatch = async (
  tenantId: mongoose.Types.ObjectId | string,
  data: Partial<any>,
  session?: ClientSession
) => {
  const batch = new Batch({
    tenantId,
    ...data,
    batchNo: normalizeBatchNo(data.batchNo),
    remainingQty: data.initialQty || data.stock || 0
  });
  if (session) {
    return batch.save({ session });
  }
  return batch.save();
};

export const ensureProductMigratedToBatch = async (
  tenantId: mongoose.Types.ObjectId | string,
  productId: mongoose.Types.ObjectId | string,
  providedSession?: mongoose.ClientSession
): Promise<void> => {
  const tenant = await Admin.findById(tenantId).select('preferences').lean();
  if (!tenant?.preferences?.enableBatchTracking) return;

  // Optimistic pre-check outside transaction to avoid unnecessary contention
  let preCheck = await ProductInventoryMigration.findOne({
    tenantId,
    productId
  }).sort({ generation: -1 }).lean();
  if (preCheck && !(preCheck.direction === 'FREE_TO_BATCH' && preCheck.status === 'COMPLETED')) {
    if (preCheck.direction === 'FREE_TO_BATCH' && preCheck.status === 'MIGRATING') {
      throw createMigrationInProgressError();
    }
    preCheck = null;
  }
  if (preCheck) return; // Already migrated — skip transaction entirely

  const runMigration = async (session: mongoose.ClientSession) => {
    const latestMigration = await ProductInventoryMigration.findOne({
      tenantId,
      productId,
    }).sort({ generation: -1 }).session(session);

    let generation = 1;
    if (latestMigration) {
      if (latestMigration.direction === 'FREE_TO_BATCH' && latestMigration.status === 'COMPLETED') {
        return; // Already migrated (confirmed inside txn)
      }
      if (latestMigration.direction === 'FREE_TO_BATCH' && latestMigration.status === 'MIGRATING') {
        throw createMigrationInProgressError();
      }
      generation = latestMigration.generation + 1;
    }

    const migration = new ProductInventoryMigration({
      tenantId,
      productId,
      generation,
      direction: 'FREE_TO_BATCH',
      status: 'MIGRATING',
      startedAt: new Date()
    });
    try {
      await migration.save({ session });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw createMigrationInProgressError();
      }
      throw err;
    }

    try {
      const product = await Product.findOne({ _id: productId, tenantId }).session(session);
      if (!product) throw new Error('Product not found');

      const qty = product.currentStockQty || 0;
      
      if (qty > 0) {
        const batch = new Batch({
          tenantId,
          productId,
          batchNo: normalizeBatchNo(product.batchNo),
          expiryDate: product.expiryDate || null,
          rate: product.rate || 0,
          mrp: product.newMRP || 0,
          gstPercent: product.gstPercentage || 0,
          initialQty: qty,
          remainingQty: qty,
          isActive: true,
          createdBy: {
            user: tenantId, 
            userModel: 'Admin'
          }
        });
        await batch.save({ session });
        
        await Product.updateOne(
          { _id: productId, tenantId },
          { 
            $set: { currentStockQty: 0 },
            $inc: { stockVersion: 1 },
            $push: {
              stockHistory: {
                type: 'adjustment',
                changeQty: -qty,
                previousQty: qty,
                newQty: 0,
                reference: 'Legacy stock migrated to Batch',
                timestamp: new Date()
              }
            }
          },
          { session }
        );
      } else {
        // Just clear it to be safe
        if (product.currentStockQty !== 0) {
          await Product.updateOne(
            { _id: productId, tenantId },
            { $set: { currentStockQty: 0 } },
            { session }
          );
        }
      }

      migration.status = 'COMPLETED';
      migration.completedAt = new Date();
      await migration.save({ session });

    } catch (err: any) {
      migration.status = 'FAILED';
      migration.error = err.message;
      await migration.save({ session });
      throw err;
    }
  };

  if (providedSession) {
    await runMigration(providedSession);
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await runMigration(session);
      });
    } finally {
      session.endSession();
    }
  }
};

export const ensureProductBatchMigrated = async (
  tenantId: mongoose.Types.ObjectId | string,
  productId: mongoose.Types.ObjectId | string,
  defaultBatchNoOrSession: string | mongoose.ClientSession = NO_BATCH_BATCH_NO,
  maybeSession?: mongoose.ClientSession
): Promise<void> => {
  const providedSession = typeof defaultBatchNoOrSession === 'string'
    ? maybeSession
    : defaultBatchNoOrSession;

  await ensureProductMigratedToBatch(tenantId, productId, providedSession);
};

export const toggleBatchTracking = async (
  tenantId: mongoose.Types.ObjectId | string,
  enable: boolean
): Promise<void> => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const tenant = await Admin.findById(tenantId).session(session);
    if (!tenant) throw new Error('Tenant not found');

    if (enable) {
      tenant.set('preferences.enableBatchTracking', true);
      await tenant.save({ session });
    } else {
      tenant.set('preferences.enableBatchTracking', false);
      await tenant.save({ session });

      const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());
      const latestMigrationRows = await ProductInventoryMigration.aggregate([
        { $match: { tenantId: tenantObjectId, status: 'COMPLETED' } },
        { $sort: { productId: 1, generation: -1 } },
        { $group: { _id: '$productId', latest: { $first: '$$ROOT' } } },
        { $match: { 'latest.direction': 'FREE_TO_BATCH' } }
      ]).session(session);

      const migrations = latestMigrationRows.map(row => row.latest);

      const productIds = migrations.map(m => m.productId);

      if (productIds.length > 0) {
        const batchAgg = await Batch.aggregate([
          { $match: { tenantId: tenantObjectId, productId: { $in: productIds }, isActive: true } },
          { $sort: { productId: 1, expiryDate: 1, createdAt: 1 } },
          {
            $group: {
              _id: '$productId',
              totalStock: { $sum: '$remainingQty' },
              batchNo: { $first: '$batchNo' }
            }
          }
        ]).session(session);

        const stockMap = new Map();
        batchAgg.forEach(b => stockMap.set(b._id.toString(), b.totalStock));
        const batchNoMap = new Map();
        batchAgg.forEach(b => batchNoMap.set(b._id.toString(), normalizeBatchNo(b.batchNo)));

        const timestamp = new Date();

        for (const migration of migrations) {
          const pid = migration.productId.toString();
          const effectiveStock = stockMap.get(pid) || 0;
          const batchNo = batchNoMap.get(pid) || NO_BATCH_BATCH_NO;

          await Product.updateOne(
            { _id: pid, tenantId },
            { 
              $set: { currentStockQty: effectiveStock, batchNo },
              $inc: { stockVersion: 1 }
            },
            { session }
          );

          await Batch.updateMany(
            { tenantId, productId: pid },
            { $set: { remainingQty: 0, isActive: false } },
            { session }
          );

          // Find the actual latest generation for this product to avoid duplicate key
          const latestForProduct = await ProductInventoryMigration.findOne({
            tenantId,
            productId: pid
          }).sort({ generation: -1 }).session(session);
          const nextGen = (latestForProduct?.generation ?? 0) + 1;

          const reverseMigration = new ProductInventoryMigration({
            tenantId,
            productId: pid,
            generation: nextGen,
            direction: 'BATCH_TO_FREE',
            status: 'COMPLETED',
            startedAt: timestamp,
            completedAt: timestamp
          });
          await reverseMigration.save({ session });
        }
      }
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export interface InventoryRepresentation {
  currentStockQty: number;
  effectiveStockQty: number;
  inventoryRepresentation: 'FREE' | 'BATCH';
}

export const getProductEffectiveStock = async (
  tenantId: mongoose.Types.ObjectId | string,
  product: any
): Promise<InventoryRepresentation> => {
  const tenant = await Admin.findById(tenantId).select('preferences').lean();
  const enableBatchTracking = tenant?.preferences?.enableBatchTracking === true;

  if (!enableBatchTracking) {
    return {
      currentStockQty: product.currentStockQty || 0,
      effectiveStockQty: product.currentStockQty || 0,
      inventoryRepresentation: 'FREE'
    };
  }

  const migration = await ProductInventoryMigration.findOne({
    tenantId,
    productId: product._id,
    status: 'COMPLETED'
  }).sort({ generation: -1 }).lean();

  if (migration?.direction === 'FREE_TO_BATCH' && migration.status === 'COMPLETED') {
    const batches = await Batch.find({
      tenantId,
      productId: product._id,
      isActive: true,
      remainingQty: { $gt: 0 }
    }).lean();

    const sumBatches = batches.reduce((sum, b) => sum + (b.remainingQty || 0), 0);

    return {
      currentStockQty: product.currentStockQty || 0,
      effectiveStockQty: sumBatches,
      inventoryRepresentation: 'BATCH'
    };
  }

  return {
    currentStockQty: product.currentStockQty || 0,
    effectiveStockQty: product.currentStockQty || 0,
    inventoryRepresentation: 'FREE'
  };
};

export const buildEffectiveStockAggregation = (
  tenantId: mongoose.Types.ObjectId | string,
  enableBatchTracking: boolean
) => {
  if (!enableBatchTracking) {
    return [
      {
        $addFields: {
          effectiveStockQty: '$currentStockQty',
          inventoryRepresentation: 'FREE'
        }
      }
    ];
  }

  return [
    {
      $lookup: {
        from: 'productinventorymigrations',
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ['$tenantId', new mongoose.Types.ObjectId(tenantId.toString())] },
            { $eq: ['$productId', '$$pid'] },
            { $eq: ['$status', 'COMPLETED'] }
          ]}}},
          { $sort: { generation: -1 } },
          { $limit: 1 }
        ],
        as: 'latestMigration'
      }
    },
    {
      $lookup: {
        from: 'batches',
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ['$tenantId', new mongoose.Types.ObjectId(tenantId.toString())] },
            { $eq: ['$productId', '$$pid'] },
            { $eq: ['$isActive', true] }
          ]}}}
        ],
        as: 'activeBatches'
      }
    },
    {
      $addFields: {
        isMigrated: {
          $and: [
            { $gt: [{ $size: '$latestMigration' }, 0] },
            { $eq: [{ $arrayElemAt: ['$latestMigration.direction', 0] }, 'FREE_TO_BATCH'] },
            { $eq: [{ $arrayElemAt: ['$latestMigration.status', 0] }, 'COMPLETED'] }
          ]
        }
      }
    },
    {
      $addFields: {
        inventoryRepresentation: {
          $cond: [{ $eq: ['$isMigrated', true] }, 'BATCH', 'FREE']
        },
        effectiveStockQty: {
          $cond: [
            { $eq: ['$isMigrated', true] },
            { $sum: '$activeBatches.remainingQty' },
            '$currentStockQty'
          ]
        }
      }
    },
    {
      $project: {
        latestMigration: 0,
        activeBatches: 0,
        isMigrated: 0
      }
    }
  ];
};

export const assertFreeStockMutationAllowed = async (
  tenantId: mongoose.Types.ObjectId | string
): Promise<void> => {
  const tenant = await Admin.findById(tenantId).select('preferences').lean();
  if (tenant?.preferences?.enableBatchTracking === true) {
    throw new Error('Direct free stock mutations are not allowed while batch tracking is enabled. Adjust stock through batches.');
  }
};
