import mongoose, { PipelineStage } from 'mongoose';
import Purchase from '../models/Purchase';
import StockMovement from '../models/StockMovement';

export interface ReportDateFilter {
  dateFrom?: string;
  dateTo?: string;
}

const toObjectId = (id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId => {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
};

const buildPurchaseDateFilter = (tenantId: string | mongoose.Types.ObjectId, filters: ReportDateFilter): any => {
  const matchStage: any = { tenantId: toObjectId(tenantId) };
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

const buildMovementDateFilter = (tenantId: string | mongoose.Types.ObjectId, filters: ReportDateFilter): any => {
  const matchStage: any = { tenantId: toObjectId(tenantId) };
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
  async getPurchaseSummary(tenantId: string | mongoose.Types.ObjectId, filters: ReportDateFilter) {
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
      totalPurchases: { count: 0, value: 0 }
    };

    results.forEach(r => {
      const status = r._id as string;
      const count = r.count || 0;
      const value = r.totalValue || 0;

      if (status === 'COMPLETED') {
        summary.completed = { count, value };
      } else if (status === 'CANCELLED') {
        summary.cancelled = { count, value };
      } else if (status === 'DRAFT') {
        summary.draft = { count, value };
      }
      summary.totalPurchases.count += count;
      summary.totalPurchases.value += value;
    });

    return summary;
  },

  async getPurchaseStatusSummary(tenantId: string | mongoose.Types.ObjectId, filters: ReportDateFilter) {
    const matchStage = buildPurchaseDateFilter(tenantId, filters);

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalTax: { $sum: '$taxAmount' },
          totalDiscount: { $sum: '$discountAmount' }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          totalAmount: 1,
          totalTax: 1,
          totalDiscount: 1,
          _id: 0
        }
      },
      { $sort: { status: 1 } }
    ];

    return await Purchase.aggregate(pipeline);
  },

  async getSupplierWisePurchases(tenantId: string | mongoose.Types.ObjectId, filters: ReportDateFilter) {
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
          totalValue: { $sum: '$totalAmount' },
          lastPurchaseDate: { $max: '$purchaseDate' }
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
          supplierName: { $ifNull: ['$supplier.name', 'Unknown Supplier'] },
          supplierPhone: { $ifNull: ['$supplier.phone', ''] },
          supplierGstin: { $ifNull: ['$supplier.gstin', ''] },
          status: '$_id.status',
          count: 1,
          totalValue: 1,
          lastPurchaseDate: 1,
          _id: 0
        }
      },
      { $sort: { supplierName: 1, status: 1 } }
    ];

    return await Purchase.aggregate(pipeline);
  },

  async getProductWisePurchases(tenantId: string | mongoose.Types.ObjectId, filters: ReportDateFilter) {
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
          productName: { $ifNull: ['$product.productName', 'Unknown Product'] },
          sku: { $ifNull: ['$product.sku', ''] },
          hsnCode: { $ifNull: ['$product.hsnCode', ''] },
          status: '$_id.status',
          paidQuantity: '$quantity',
          freeQuantity: '$freeQuantity',
          receivedQuantity: { $add: ['$quantity', '$freeQuantity'] },
          totalValue: 1,
          count: 1,
          _id: 0
        }
      },
      { $sort: { productName: 1, status: 1 } }
    ];

    return await Purchase.aggregate(pipeline);
  },

  async getInventoryFlowSummary(tenantId: string | mongoose.Types.ObjectId, filters: ReportDateFilter) {
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
      summary: [] as any[],
      totalInflowQty: 0,
      totalOutflowQty: 0
    };

    const inTypes = ['PURCHASE', 'OPENING_STOCK', 'MANUAL_ADJUSTMENT_IN', 'SALE_RETURN'];
    const outTypes = ['SALE', 'MANUAL_ADJUSTMENT_OUT', 'PURCHASE_RETURN', 'SALE_REVERSAL'];

    results.forEach(r => {
      const item = { type: r._id, count: r.count, quantity: r.quantity };
      if (inTypes.includes(r._id)) {
        flow.inflow.push(item);
        flow.totalInflowQty += r.quantity;
      } else if (outTypes.includes(r._id)) {
        flow.outflow.push(item);
        flow.totalOutflowQty += r.quantity;
      }
      flow.summary.push(item);
    });

    return flow;
  }
};
