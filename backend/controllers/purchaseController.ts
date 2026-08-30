import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { purchaseService } from '../services/purchaseService';
import Supplier from '../models/Supplier';
import Product from '../models/Product';
import Purchase from '../models/Purchase';
import { processPurchaseCompletion, processPurchaseEdit } from '../services/purchaseInventoryService';

export const createPurchase = async (req: Request | any, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tenantId = req.user.tenantId || req.user._id; // Accommodate Admin vs Employee
    const { supplierId, items, ...purchaseData } = req.body;

    // 1. Validate Supplier
    if (!supplierId) {
      return res.status(400).json({ success: false, message: 'Supplier is required' });
    }
    const supplier = await Supplier.findOne({ _id: supplierId, tenantId }).session(session);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found or does not belong to this tenant' });
    }

    // 2. Validate Items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Purchase must have at least one item' });
    }

    // 3. Validate Products (Tenant Isolation)
    const productIds = items.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds }, tenantId }).session(session);
    if (products.length !== new Set(productIds).size) {
      return res.status(400).json({ success: false, message: 'One or more products are invalid or do not belong to this tenant' });
    }

    // 4. Construct Attribution
    const createdBy = {
      user: req.user._id,
      userModel: req.userModel || (req.userRole === 'admin' ? 'Admin' : 'Employee')
    };

    // 5. Create Draft Purchase (Delegated to Service)
    const purchase = await purchaseService.createDraftPurchase(
      tenantId.toString(),
      {
        ...purchaseData,
        supplierId,
        items,
        createdBy
      },
      session
    );

    // 6. Immediately process inventory completion
    await processPurchaseCompletion(tenantId.toString(), String(purchase._id), session);

    await session.commitTransaction();
    session.endSession();

    // Fetch the updated purchase (now COMPLETED)
    const completedPurchase = await Purchase.findOne({ _id: purchase._id, tenantId });

    res.status(201).json({
      success: true,
      message: 'Purchase saved and inventory updated successfully',
      purchase: completedPurchase
    });

  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create Purchase Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating purchase'
    });
  }
};

export const getPurchases = async (req: Request | any, res: Response) => {
  try {
    const tenantId = req.user.tenantId || req.user._id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    
    // Construct filters based on query params (status, search, etc.)
    const filters: any = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.supplierId) {
      filters.supplierId = req.query.supplierId;
    }
    if (req.query.search) {
      filters.search = req.query.search;
    }
    if (req.query.startDate) {
      filters.startDate = req.query.startDate;
    }
    if (req.query.endDate) {
      filters.endDate = req.query.endDate;
    }

    const result = await purchaseService.getPurchases(tenantId.toString(), filters, page, limit);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Get Purchases Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchases'
    });
  }
};

export const getPurchaseStats = async (req: Request | any, res: Response) => {
  try {
    const tenantId = req.user.tenantId || req.user._id;
    const stats = await purchaseService.getPurchaseStats(tenantId.toString());

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Get Purchase Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase stats'
    });
  }
};

export const getPurchase = async (req: Request | any, res: Response) => {
  try {
    const tenantId = req.user.tenantId || req.user._id;
    const { id } = req.params;

    const purchase = await purchaseService.getPurchaseById(tenantId.toString(), id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    res.status(200).json({
      success: true,
      purchase
    });
  } catch (error: any) {
    console.error('Get Purchase Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase details'
    });
  }
};

export const updatePurchase = async (req: Request | any, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tenantId = req.user.tenantId || req.user._id;
    const { id } = req.params;
    const updateData = req.body;

    const updatedBy = {
      user: req.user._id,
      userModel: req.userModel || (req.userRole === 'admin' ? 'Admin' : 'Employee')
    };

    const purchase = await processPurchaseEdit(
      tenantId.toString(),
      id,
      updateData,
      updatedBy,
      session
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Purchase updated successfully',
      purchase
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update Purchase Error:', error);
    res.status(error.message.includes('not found') || error.message.includes('DRAFT') ? 400 : 500).json({
      success: false,
      message: error.message || 'Error updating purchase'
    });
  }
};

export const deletePurchase = async (req: Request | any, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tenantId = req.user.tenantId || req.user._id;
    const { id } = req.params;

    await purchaseService.deleteDraftPurchase(tenantId.toString(), id, session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Draft purchase deleted successfully'
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Delete Purchase Error:', error);
    res.status(error.message.includes('not found') || error.message.includes('DRAFT') ? 400 : 500).json({
      success: false,
      message: error.message || 'Error deleting purchase'
    });
  }
};
