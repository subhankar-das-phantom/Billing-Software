import { Request, Response, NextFunction } from 'express';
import Batch from '../models/Batch';
import getTenantId from '../utils/getTenantId';

// @desc    Get active batches for a product
// @route   GET /api/batches
// @access  Private
export const getBatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { productId } = req.query;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    const batches = await Batch.find({ 
      tenantId, 
      productId: String(productId), 
      isActive: true 
    }).sort({ expiryDate: 1, createdAt: 1 });
    
    res.status(200).json({ success: true, count: batches.length, batches });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new batch
// @route   POST /api/batches
// @access  Private
export const createBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { productId, batchNo, expiryDate, mrp, rate, gstPercent, initialQty } = req.body;

    const user = (req as any).user;
    const admin = (req as any).admin;
    
    const createdBy = {
      user: admin ? admin._id : user._id,
      userModel: admin ? 'Admin' : 'Employee'
    };

    const batch = await Batch.create({
      tenantId,
      productId,
      batchNo: batchNo || null,
      expiryDate: expiryDate || null,
      mrp,
      rate: rate || 0,
      gstPercent,
      initialQty: initialQty || 0,
      remainingQty: initialQty || 0,
      isActive: true,
      createdBy
    });

    res.status(201).json({ success: true, batch });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a batch
// @route   PUT /api/batches/:id
// @access  Private
export const updateBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const batchId = req.params.id;

    let batch = await Batch.findOne({ _id: batchId, tenantId });

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    batch = await Batch.findByIdAndUpdate(batchId, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, batch });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a batch
// @route   DELETE /api/batches/:id
// @access  Private
export const deleteBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const batchId = req.params.id;

    const batch = await Batch.findOne({ _id: batchId, tenantId });

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    if (batch.remainingQty > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete batch with remaining stock' });
    }

    await batch.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

export const adjustBatchStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const batchId = req.params.id;
    const { quantity, type, reason } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Valid quantity is required' });
    }

    const session = await require('mongoose').startSession();
    session.startTransaction();

    try {
      const batch = await Batch.findOne({ _id: batchId, tenantId }).session(session);
      if (!batch) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: 'Batch not found' });
      }

      const qtyChange = type === 'out' ? -quantity : quantity;
      
      if (batch.remainingQty + qtyChange < 0) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Insufficient stock in batch' });
      }

      // 1. Update Batch
      batch.remainingQty += qtyChange;
      await batch.save({ session });

      // 2. Sync Product
      const Product = require('../models/Product');
      const user = (req as any).user;
      const admin = (req as any).admin;
      const adjustedBy = {
        user: admin ? admin._id : user._id,
        userModel: admin ? 'Admin' : 'Employee'
      };

      await Product.findByIdAndUpdate(
        batch.productId,
        {
          $inc: { currentStockQty: qtyChange, stockVersion: 1 },
          $push: {
            stockHistory: {
              type: 'adjustment',
              changeQty: qtyChange,
              reference: `Batch ${batch.batchNo} - ${reason || 'Manual Adjustment'}`,
              adjustedBy,
              timestamp: new Date()
            }
          }
        },
        { session }
      );

      await session.commitTransaction();
      res.status(200).json({ success: true, batch });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};
