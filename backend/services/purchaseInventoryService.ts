import mongoose, { ClientSession } from 'mongoose';
import Purchase from '../models/Purchase';
import Product from '../models/Product';
import Batch from '../models/Batch';
import Admin from '../models/Admin';
import { ensureProductMigratedToBatch, normalizeBatchNo, NO_BATCH_BATCH_NO, recordStockMovement } from './inventoryService';
import { reversePurchaseInventory } from './purchaseLifecycleService';

export const processPurchaseCompletion = async (
  tenantId: string,
  purchaseId: string,
  session: ClientSession
): Promise<void> => {
  // 1. Validate Purchase
  const purchase = await Purchase.findOne({ _id: purchaseId, tenantId }).session(session);
  
  if (!purchase) {
    throw new Error('Purchase not found or does not belong to this tenant');
  }
  if (!purchase.items || purchase.items.length === 0) {
    throw new Error('Cannot complete purchase with no items');
  }

  // 2. Load Tenant Preferences (Batch Tracking)
  const tenant = await Admin.findById(tenantId).select('preferences').session(session).lean();
  const enableBatchTracking = tenant?.preferences?.enableBatchTracking === true;

  // 3. Process each item
  for (const item of purchase.items) {
    const receivedQuantity = item.quantity + (item.freeQuantity || 0);

    // Verify Product exists and belongs to tenant
    const product = await Product.findOne({ _id: item.productId, tenantId }).session(session);
    if (!product) {
      throw new Error(`Product ${item.productId} not found or invalid`);
    }

    if (enableBatchTracking) {
      // BATCH ON
      await ensureProductMigratedToBatch(tenantId, item.productId.toString(), session);

      const rawBatchNo = item.batchNumber ? String(item.batchNumber).trim() : '';
      const isUnnamed = !rawBatchNo || rawBatchNo === NO_BATCH_BATCH_NO;
      const batchNo = normalizeBatchNo(rawBatchNo);
      
      let batch = null;
      if (!isUnnamed) {
        // Match batch identically to migration logic (productId + batchNo) for named batches
        batch = await Batch.findOne({
          tenantId,
          productId: item.productId,
          batchNo
        }).session(session);
      }

      if (batch) {
        // Increment existing named batch
        batch.remainingQty += receivedQuantity;
        batch.initialQty += receivedQuantity;
        batch.isActive = true;
        if (item.expiryDate) batch.expiryDate = item.expiryDate;
        if (item.sellingRate) batch.rate = item.sellingRate;
        if (item.mrp) batch.mrp = item.mrp;
        if (item.gstPercent !== undefined) batch.gstPercent = item.gstPercent;
        await batch.save({ session });
      } else {
        // Create new batch (for UNNAMED or newly seen named batch)
        batch = new Batch({
          tenantId,
          productId: item.productId,
          batchNo,
          expiryDate: item.expiryDate || null,
          rate: item.sellingRate || item.purchaseRate || product.rate || 0,
          mrp: item.mrp || product.newMRP || 0,
          gstPercent: item.gstPercent ?? product.gstPercentage ?? 12,
          initialQty: receivedQuantity,
          remainingQty: receivedQuantity,
          isActive: true,
          createdBy: purchase.createdBy
        });
        await batch.save({ session });
      }

      item.batchId = batch._id as any;
      item.batchNumber = batch.batchNo ?? undefined;

      // Update parent product stock and history
      await Product.updateOne(
        { _id: item.productId, tenantId },
        { 
          $inc: { currentStockQty: receivedQuantity, stockVersion: 1 },
          $push: {
            stockHistory: {
              type: 'purchase',
              changeQty: receivedQuantity,
              previousQty: product.currentStockQty,
              newQty: product.currentStockQty + receivedQuantity,
              reference: `Purchase ${purchase.purchaseNumber}`,
              timestamp: new Date(),
              adjustedBy: purchase.createdBy
            }
          }
        },
        { session }
      );

      // Record StockMovement
      await recordStockMovement({
        tenantId,
        productId: item.productId,
        batchId: batch._id,
        type: 'PURCHASE',
        quantity: receivedQuantity,
        rate: item.purchaseRate || 0,
        totalValue: (item.purchaseRate || 0) * item.quantity, // financial value based on paid quantity
        referenceType: 'Purchase',
        referenceId: String(purchase._id),
        createdBy: purchase.createdBy
      }, session);

    } else {
      // BATCH OFF
      const updateDoc: any = { 
        $inc: { currentStockQty: receivedQuantity, stockVersion: 1 },
        $push: {
          stockHistory: {
            type: 'purchase',
            changeQty: receivedQuantity,
            previousQty: product.currentStockQty,
            newQty: product.currentStockQty + receivedQuantity,
            reference: `Purchase ${purchase.purchaseNumber}`,
            timestamp: new Date(),
            adjustedBy: purchase.createdBy
          }
        }
      };
      if (item.batchNumber) {
        updateDoc.$set = { batchNumber: item.batchNumber };
      }

      await Product.updateOne(
        { _id: item.productId, tenantId },
        updateDoc,
        { session }
      );

      // Record StockMovement
      await recordStockMovement({
        tenantId,
        productId: item.productId,
        batchId: null,
        type: 'PURCHASE',
        quantity: receivedQuantity,
        rate: item.purchaseRate || 0,
        totalValue: (item.purchaseRate || 0) * item.quantity,
        referenceType: 'Purchase',
        referenceId: String(purchase._id),
        createdBy: purchase.createdBy
      }, session);
    }
  }

  // 4. Mark Purchase as COMPLETED
  purchase.status = 'COMPLETED';
  await purchase.save({ session });
};

export const processPurchaseEdit = async (
  tenantId: string,
  purchaseId: string,
  updateData: any,
  updatedBy: { user: mongoose.Types.ObjectId; userModel: 'Admin' | 'Employee' },
  session: ClientSession
): Promise<mongoose.Document> => {
  // 1. Validate old purchase
  const purchase = await Purchase.findOne({ _id: purchaseId, tenantId }).session(session);
  if (!purchase) {
    throw new Error('Purchase not found or does not belong to this tenant');
  }

  if (purchase.status === 'CANCELLED') {
    throw new Error('Cannot edit a cancelled purchase');
  }

  // 2. Reverse Old Inventory (Full Restore)
  await reversePurchaseInventory(tenantId, purchase, updatedBy, 'Edit (Reversal)', session);

  // 3. Update Purchase Document with new items/data
  // Ensure we overwrite items fully
  Object.assign(purchase, updateData);
  purchase.updatedBy = updatedBy;
  // We must save it here so the items are persisted before we call completion
  await purchase.save({ session });

  // 4. Re-apply New Inventory (Full Apply)
  await processPurchaseCompletion(tenantId, purchaseId, session);

  // 5. Return updated purchase
  return purchase;
};
