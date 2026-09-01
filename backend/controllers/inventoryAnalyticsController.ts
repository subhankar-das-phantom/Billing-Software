import { Request, Response } from 'express';
import { inventoryAnalyticsService } from '../services/inventoryAnalyticsService';

interface AuthRequest extends Request {
  user?: any;
  admin?: any;
}

export const getBatchExpiryIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id || req.admin?._id;
    const data = await inventoryAnalyticsService.getBatchExpiryIntelligence(tenantId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching batch expiry intelligence' });
  }
};

export const getProductVelocity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id || req.admin?._id;
    const { dateFrom, dateTo } = req.query;
    const data = await inventoryAnalyticsService.getProductVelocity(tenantId, {
      dateFrom: dateFrom as string,
      dateTo: dateTo as string
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching product velocity' });
  }
};

export const getStockRiskIndicators = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id || req.admin?._id;
    const data = await inventoryAnalyticsService.getStockRiskIndicators(tenantId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching stock risk indicators' });
  }
};

export const getSupplierProcurementActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id || req.admin?._id;
    const { dateFrom, dateTo } = req.query;
    const data = await inventoryAnalyticsService.getSupplierProcurementActivity(tenantId, {
      dateFrom: dateFrom as string,
      dateTo: dateTo as string
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching supplier procurement activity' });
  }
};
