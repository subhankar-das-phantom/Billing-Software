import mongoose, { PipelineStage } from 'mongoose';
import Purchase from '../models/Purchase';
import StockMovement from '../models/StockMovement';

export interface ReportDateFilter {
  dateFrom?: string;
  dateTo?: string;
}

const buildPurchaseDateFilter = (tenantId: string, filters: ReportDateFilter): any => {
  const matchStage: any = { tenantId };
  if (filters.dateFrom || filters.dateTo) {
    matchStage.purchaseDate = {};
    if (filters.dateFrom) {
      matchStage.purchaseDate.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      matchStage.purchaseDate.$lte = toDate;
    }
  }
  return matchStage;
};

const buildMovementDateFilter = (tenantId: string, filters: ReportDateFilter): any => {
  const matchStage: any = { tenantId };
  if (filters.dateFrom || filters.dateTo) {
    matchStage.createdAt = {};
    if (filters.dateFrom) {
      matchStage.createdAt.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      matchStage.createdAt.$lte = toDate;
    }
  }
  return matchStage;
};

export const purchaseReportService = {
  async getPurchaseSummary(tenantId: string, filters: ReportDateFilter) {
    const matchStage = buildPurchaseDateFilter(tenantId, filters);

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalAmount' }
        }
      }
    ];

    const results = await Purchase.aggregate(pipeline);

    const summary = {
      completed: { count: 0, value: 0 },
      cancelled: { count: 0, value: 0 },
      draft: { count: 0, value: 0 },
      totalPurchases: 0
    };

    results.forEach(r => {
      const status = r._id as string;
      if (status === 'COMPLETED') {
        summary.completed = { count: r.count, value: r.totalValue };
      } else if (status === 'CANCELLED') {
        summary.cancelled = { count: r.count, value: r.totalValue };
      } else if (status === 'DRAFT') {
        summary.draft = { count: r.count, value: r.totalValue };
      }
      summary.totalPurchases += r.count;
    });

    return summary;
  },

  async getSupplierWisePurchases(tenantId: string, filters: ReportDateFilter) {
    const matchStage = buildPurchaseDateFilter(tenantId, filters);

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            supplierId: '$supplierId',
            status: '$status'
          },
          count: { $sum: 1 },
          totalValue: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id.supplierId',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          supplierId: '$_id.supplierId',
          supplierName: '$supplier.name',
          status: '$_id.status',
          count: 1,
          totalValue: 1,
          _id: 0
        }
      },
      { $sort: { supplierName: 1, status: 1 } }
    ];

    return await Purchase.aggregate(pipeline);
  },

  async getProductWisePurchases(tenantId: string, filters: ReportDateFilter) {
    const matchStage = buildPurchaseDateFilter(tenantId, filters);

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            productId: '$items.productId',
            status: '$status'
          },
          quantity: { $sum: '$items.quantity' },
          freeQuantity: { $sum: '$items.freeQuantity' },
          totalValue: { $sum: '$items.total' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: '$_id.productId',
          productName: '$product.productName',
          sku: '$product.sku',
          status: '$_id.status',
          quantity: 1,
          freeQuantity: 1,
          totalValue: 1,
          count: 1,
          _id: 0
        }
      },
      { $sort: { productName: 1, status: 1 } }
    ];

    return await Purchase.aggregate(pipeline);
  },

  async getInventoryFlowSummary(tenantId: string, filters: ReportDateFilter) {
    const matchStage = buildMovementDateFilter(tenantId, filters);

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          quantity: { $sum: '$quantity' }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await StockMovement.aggregate(pipeline);

    // Group logically as IN and OUT flows without implying valuation
    const flow = {
      inflow: [] as any[],
      outflow: [] as any[],
      summary: [] as any[]
    };

    const inTypes = ['PURCHASE', 'OPENING_STOCK', 'MANUAL_ADJUSTMENT_IN', 'SALE_RETURN'];
    const outTypes = ['SALE', 'MANUAL_ADJUSTMENT_OUT', 'PURCHASE_RETURN', 'SALE_REVERSAL'];

    results.forEach(r => {
      const item = { type: r._id, count: r.count, quantity: r.quantity };
      if (inTypes.includes(r._id)) {
        flow.inflow.push(item);
      } else if (outTypes.includes(r._id)) {
        flow.outflow.push(item);
      }
      flow.summary.push(item);
    });

    return flow;
  }
};
