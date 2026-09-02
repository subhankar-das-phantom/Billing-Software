import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { cancelPurchase } from '../services/purchaseLifecycleService';
import Purchase from '../models/Purchase';

export const cancelPurchaseController = async (req: Request | any, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tenantId = req.user.tenantId || req.user._id;
    const { id: purchaseId } = req.params;
    
    // In our auth setup, employee identity is in req.employee or admin in req.admin. 
    // We can use a standard attribution helper if available, or build it:
    let cancelledBy;
    if (req.admin) {
      cancelledBy = { user: req.admin._id, userModel: 'Admin' as const };
    } else if (req.user) {
      cancelledBy = { user: req.user._id, userModel: 'Employee' as const };
    } else {
      throw new Error('Authentication required for cancellation');
    }

    // Atomic transaction encapsulated in lifecycle service
    await cancelPurchase(tenantId.toString(), purchaseId, cancelledBy, session);

    await session.commitTransaction();
    session.endSession();

    // Fetch the updated purchase to return it to the client
    const updatedPurchase = await Purchase.findOne({ _id: purchaseId, tenantId });

    res.status(200).json({
      success: true,
      message: 'Purchase cancelled successfully. Inventory reversed.',
      purchase: updatedPurchase
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Cancel Purchase Error:', error);
    
    const statusCode = error.message.includes('not found') || 
                       error.message.includes('Cannot cancel') ||
                       error.message.includes('invalid') || 
                       error.message.includes('no longer available') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error cancelling purchase'
    });
  }
};
