import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../types';
import { parseDateFilter } from '../utils/dateUtils';
import { SalesAnalyticsService } from '../services/salesAnalyticsService';
const getTenantId = require('../../../../utils/getTenantId');

export class SalesAnalyticsController {
  
  static async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const tenantId = getTenantId(req);
      const { period, startDate, endDate } = req.query;
      const { start, end } = parseDateFilter(period as string, startDate as string, endDate as string);

      const data = await SalesAnalyticsService.getOverview(tenantId, start, end);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getMonthlySales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const tenantId = getTenantId(req);
      const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();

      const data = await SalesAnalyticsService.getMonthlySales(tenantId, year);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getDailySales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const tenantId = getTenantId(req);
      const { period, startDate, endDate } = req.query;
      const { start, end } = parseDateFilter(period as string, startDate as string, endDate as string);

      const data = await SalesAnalyticsService.getDailySales(tenantId, start, end);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getYearlySales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = getTenantId(req);
      const data = await SalesAnalyticsService.getYearlySales(tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getTopProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const tenantId = getTenantId(req);
      const { period, startDate, endDate, limit } = req.query;
      const { start, end } = parseDateFilter(period as string, startDate as string, endDate as string);
      const limitNum = limit ? parseInt(limit as string, 10) : 10;

      const data = await SalesAnalyticsService.getTopProducts(tenantId, start, end, limitNum);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getTopCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const tenantId = getTenantId(req);
      const { period, startDate, endDate, limit } = req.query;
      const { start, end } = parseDateFilter(period as string, startDate as string, endDate as string);
      const limitNum = limit ? parseInt(limit as string, 10) : 10;

      const data = await SalesAnalyticsService.getTopCustomers(tenantId, start, end, limitNum);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentTrends(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const tenantId = getTenantId(req);
      const { period, startDate, endDate } = req.query;
      const { start, end } = parseDateFilter(period as string, startDate as string, endDate as string);

      const data = await SalesAnalyticsService.getPaymentTrends(tenantId, start, end);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
