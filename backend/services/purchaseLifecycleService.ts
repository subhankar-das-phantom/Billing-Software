import mongoose, { ClientSession } from 'mongoose';
import Purchase from '../models/Purchase';
import Product from '../models/Product';
import Batch from '../models/Batch';
import Admin from '../models/Admin';
import { recordStockMovement } from './inventoryService';

export const reversePurchaseInventory = async (
  tenantId: string,
  purchase: mongoose.Document & any,
  actionBy: { user: mongoose.Types.ObjectId; userModel: 'Admin' | 'Employee' },
  referenceTypeSuffix: string = 'Cancellation',
  session: ClientSession
): Promise<void> => {
  if (!purchase.items || purchase.items.length === 0) {
    throw new Error('Cannot reverse purchase with no items');
  }

  // 1. Load Tenant Preferences (Batch Tracking)
  const tenant = await Admin.findById(tenantId).select('preferences').session(session).lean();
  const enableBatchTracking = tenant?.preferences?.enableBatchTracking === true;

  // 2. Process each item for reversal
  for (const item of purchase.items) {
    const receivedQuantity = item.quantity + (item.freeQuantity || 0);

    // Verify Product exists
    const product = await Product.findOne({ _id: item.productId, tenantId }).session(session);
    if (!product) {
      throw new Error(`Product ${item.productId} not found or invalid`);
    }

    if (enableBatchTracking) {
      // BATCH ON
      if (!item.batchId) {
        throw new Error(`Cannot reverse purchase: Item ${product.productName} is missing batch reference.`);
      }

      const batch = await Batch.findOne({
        _id: item.batchId,
        tenantId,
        productId: item.productId
      }).session(session);

      if (!batch) {
        throw new Error(`The Batch associated with this purchase is no longer available.`);
      }

      if (batch.remainingQty < receivedQuantity) {
        throw new Error(`Cannot edit or cancel purchase because some of the received stock for ${product.productName} has already been consumed.`);
      }

      // Reverse batch stock
      batch.remainingQty -= receivedQuantity;
      
      await batch.save({ session });

      // Reverse parent product stock and history
      await Product.updateOne(
        { _id: item.productId, tenantId },
        { 
          $inc: { stockVersion: 1, currentStockQty: -receivedQuantity },
          $push: {
            stockHistory: {
              type: 'adjustment',
              changeQty: -receivedQuantity,
              previousQty: product.currentStockQty,
              newQty: product.currentStockQty - receivedQuantity,
              reference: `Purchase ${referenceTypeSuffix} ${purchase.purchaseNumber}`,
              timestamp: new Date(),
              adjustedBy: actionBy
            }
          }
        },
        { session }
      );

      // Record reversal StockMovement
      await recordStockMovement({
        tenantId,
        productId: item.productId,
        batchId: batch._id,
        type: 'PURCHASE_RETURN', // compensating movement
        quantity: receivedQuantity,
        rate: item.purchaseRate || 0,
        totalValue: (item.purchaseRate || 0) * item.quantity,
        referenceType: `Purchase ${referenceTypeSuffix}`,
        referenceId: String(purchase._id),
        createdBy: actionBy
      }, session);

    } else {
      // BATCH OFF
      if (product.currentStockQty < receivedQuantity) {
        throw new Error(`Cannot edit or cancel purchase because some of the received stock for ${product.productName} has already been consumed.`);
      }

      // Reverse product stock
      const previousQty = product.currentStockQty;
      const newQty = previousQty - receivedQuantity;

      await Product.updateOne(
        { _id: item.productId, tenantId },
        { 
          $inc: { stockVersion: 1, currentStockQty: -receivedQuantity },
          $push: {
            stockHistory: {
              type: 'adjustment',
              changeQty: -receivedQuantity,
              previousQty,
              newQty,
              reference: `Purchase ${referenceTypeSuffix} ${purchase.purchaseNumber}`,
              timestamp: new Date(),
              adjustedBy: actionBy
            }
          }
        },
        { session }
      );

      // Record reversal StockMovement
      await recordStockMovement({
        tenantId,
        productId: item.productId,
        batchId: null,
        type: 'PURCHASE_RETURN',
        quantity: receivedQuantity,
        rate: item.purchaseRate || 0,
        totalValue: (item.purchaseRate || 0) * item.quantity,
        referenceType: `Purchase ${referenceTypeSuffix}`,
        referenceId: String(purchase._id),
        createdBy: actionBy
      }, session);
    }
  }
};

export const cancelPurchase = async (
  tenantId: string,
  purchaseId: string,
  cancelledBy: { user: mongoose.Types.ObjectId; userModel: 'Admin' | 'Employee' },
  session: ClientSession
): Promise<void> => {
  // 1. Validate Purchase
  const purchase = await Purchase.findOne({ _id: purchaseId, tenantId }).session(session);
  
  if (!purchase) {
    throw new Error('Purchase not found or does not belong to this tenant');
  }

  if (purchase.status !== 'COMPLETED') {
    throw new Error(`Cannot cancel purchase in ${purchase.status} status. Only COMPLETED purchases can be cancelled.`);
  }

  await reversePurchaseInventory(tenantId, purchase, cancelledBy, 'Cancellation', session);

  // 4. Update Purchase Status
  purchase.status = 'CANCELLED';
  purchase.cancelledBy = cancelledBy;
  purchase.cancelledAt = new Date();
  await purchase.save({ session });
};
