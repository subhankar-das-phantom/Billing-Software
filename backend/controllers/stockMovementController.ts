import { Request, Response } from 'express';
import { stockMovementService } from '../services/stockMovementService';

import getTenantId from '../utils/getTenantId';

// Extend Express Request to include properties from auth middleware
interface AuthRequest extends Request {
  user?: any;
  admin?: any;
  userRole?: string;
  userModel?: string;
}

export const getStockMovements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      res.status(401).json({ success: false, message: 'Not authorized - no tenant context' });
      return;
    }

    const {
      productId,
      batchId,
      type,
      referenceType,
      referenceId,
      dateFrom,
      dateTo,
      page = '1',
      limit = '20'
    } = req.query;

    const parsedPage = parseInt(page as string, 10) || 1;
    const parsedLimit = parseInt(limit as string, 10) || 20;

    // Cap limit to prevent massive queries
    const safeLimit = Math.min(parsedLimit, 100);

    const result = await stockMovementService.getStockMovements(
      tenantId,
      {
        productId: productId as string,
        batchId: batchId as string,
        type: type as string,
        referenceType: referenceType as string,
        referenceId: referenceId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      },
      parsedPage,
      safeLimit
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error: any) {
    console.error('Get stock movements error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching stock movements'
    });
  }
};
