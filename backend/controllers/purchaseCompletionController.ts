import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { processPurchaseCompletion } from '../services/purchaseInventoryService';
import Purchase from '../models/Purchase';

export const completePurchase = async (req: Request | any, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tenantId = req.user.tenantId || req.user._id;
    const { id: purchaseId } = req.params;

    // The atomic transition is entirely encapsulated inside processPurchaseCompletion
    await processPurchaseCompletion(tenantId.toString(), purchaseId, session);

    await session.commitTransaction();
    session.endSession();

    // Fetch the updated purchase to return it to the client
    const updatedPurchase = await Purchase.findOne({ _id: purchaseId, tenantId });

    res.status(200).json({
      success: true,
      message: 'Purchase completed successfully. Inventory updated.',
      purchase: updatedPurchase
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Complete Purchase Error:', error);
    
    // Distinguish between validation errors and internal errors
    const statusCode = error.message.includes('not found') || 
                       error.message.includes('Cannot complete') ||
                       error.message.includes('invalid') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error completing purchase'
    });
  }
};
