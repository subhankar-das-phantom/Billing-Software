import { Request, Response } from 'express';
import { purchaseReportService } from '../services/purchaseReportService';

interface AuthRequest extends Request {
  user?: any;
  admin?: any;
}

export const getPurchaseSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id || req.admin?._id;
    const { dateFrom, dateTo } = req.query;

    const data = await purchaseReportService.getPurchaseSummary(tenantId, {
      dateFrom: dateFrom as string,
      dateTo: dateTo as string
    });

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching purchase summary' });
  }
};

export const getSupplierWisePurchases = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id || req.admin?._id;
    const { dateFrom, dateTo } = req.query;

    const data = await purchaseReportService.getSupplierWisePurchases(tenantId, {
      dateFrom: dateFrom as string,
      dateTo: dateTo as string
    });

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching supplier purchases' });
  }
};

export const getProductWisePurchases = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id || req.admin?._id;
    const { dateFrom, dateTo } = req.query;

    const data = await purchaseReportService.getProductWisePurchases(tenantId, {
      dateFrom: dateFrom as string,
      dateTo: dateTo as string
    });

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching product purchases' });
  }
};

export const getPurchaseStatusSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id || req.admin?._id;
    const { dateFrom, dateTo } = req.query;

    const data = await purchaseReportService.getPurchaseStatusSummary(tenantId, {
      dateFrom: dateFrom as string,
      dateTo: dateTo as string
    });

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching purchase status summary' });
  }
};

export const getInventoryFlowSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId || req.user?._id || req.admin?._id;
    const { dateFrom, dateTo } = req.query;

    const data = await purchaseReportService.getInventoryFlowSummary(tenantId, {
      dateFrom: dateFrom as string,
      dateTo: dateTo as string
    });

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching inventory flow' });
  }
};
