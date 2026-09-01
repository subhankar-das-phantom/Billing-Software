import mongoose, { PipelineStage } from 'mongoose';
import Batch from '../models/Batch';
import Product from '../models/Product';
import Purchase from '../models/Purchase';
import Invoice from '../models/Invoice';

export interface AnalyticsFilter {
  dateFrom?: string;
  dateTo?: string;
}

const toObjectId = (id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId => {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
};

export const inventoryAnalyticsService = {
  /**
   * 1. Batch Expiry Intelligence (Read-Only)
   * Segments active batches into 6 explicit buckets:
   * Expired, 0-30d, 31-60d, 61-90d, 90+d, and No Expiry.
   */
  async getBatchExpiryIntelligence(tenantId: string | mongoose.Types.ObjectId) {
    const tId = toObjectId(tenantId);
    const now = new Date();
    const d30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          tenantId: tId,
          isActive: true,
          remainingQty: { $gt: 0 }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: 1,
          productName: { $ifNull: ['$product.productName', 'Unknown Product'] },
          sku: { $ifNull: ['$product.sku', ''] },
          batchNo: 1,
          expiryDate: 1,
          remainingQty: 1,
          rate: 1,
          mrp: 1,
          bucket: {
            $switch: {
              branches: [
                { case: { $eq: ['$expiryDate', null] }, then: 'NO_EXPIRY' },
                { case: { $lt: ['$expiryDate', now] }, then: 'EXPIRED' },
                { case: { $lte: ['$expiryDate', d30] }, then: 'DAYS_0_30' },
                { case: { $lte: ['$expiryDate', d60] }, then: 'DAYS_31_60' },
                { case: { $lte: ['$expiryDate', d90] }, then: 'DAYS_61_90' }
              ],
              default: 'DAYS_90_PLUS'
            }
          }
        }
      }
    ];

    const batches = await Batch.aggregate(pipeline);

    const buckets: Record<string, { label: string; key: string; batchCount: number; totalRemainingQty: number; productIds: Set<string> }> = {
      EXPIRED: { label: 'Expired', key: 'EXPIRED', batchCount: 0, totalRemainingQty: 0, productIds: new Set() },
      DAYS_0_30: { label: '0 – 30 Days', key: 'DAYS_0_30', batchCount: 0, totalRemainingQty: 0, productIds: new Set() },
      DAYS_31_60: { label: '31 – 60 Days', key: 'DAYS_31_60', batchCount: 0, totalRemainingQty: 0, productIds: new Set() },
      DAYS_61_90: { label: '61 – 90 Days', key: 'DAYS_61_90', batchCount: 0, totalRemainingQty: 0, productIds: new Set() },
      DAYS_90_PLUS: { label: '90+ Days', key: 'DAYS_90_PLUS', batchCount: 0, totalRemainingQty: 0, productIds: new Set() },
      NO_EXPIRY: { label: 'No Expiry', key: 'NO_EXPIRY', batchCount: 0, totalRemainingQty: 0, productIds: new Set() }
    };

    const criticalBatches: any[] = [];

    batches.forEach(b => {
      const bucket = buckets[b.bucket];
      if (bucket) {
        bucket.batchCount += 1;
        bucket.totalRemainingQty += (b.remainingQty || 0);
        if (b.productId) bucket.productIds.add(b.productId.toString());
      }
      if (b.bucket === 'EXPIRED' || b.bucket === 'DAYS_0_30') {
        criticalBatches.push({
          productId: b.productId,
          productName: b.productName,
          sku: b.sku,
          batchNo: b.batchNo,
          expiryDate: b.expiryDate,
          remainingQty: b.remainingQty,
          status: b.bucket === 'EXPIRED' ? 'EXPIRED' : 'EXPIRING_SOON'
        });
      }
    });

    const summary = Object.values(buckets).map(b => ({
      key: b.key,
      label: b.label,
      batchCount: b.batchCount,
      totalRemainingQty: b.totalRemainingQty,
      uniqueProductCount: b.productIds.size
    }));

    return {
      summary,
      totalActiveBatches: batches.length,
      criticalBatches: criticalBatches.slice(0, 50)
    };
  },

  /**
   * 2. Product Sales Velocity (Deterministic Quartile Segmentation)
   * Derived from completed invoice sales in date range.
   */
  async getProductVelocity(tenantId: string | mongoose.Types.ObjectId, filter: AnalyticsFilter) {
    const tId = toObjectId(tenantId);
    
    // Match invoices for this tenant within date range
    const invoiceMatch: any = {
      tenantId: tId,
      status: { $ne: 'CANCELLED' }
    };

    if (filter.dateFrom || filter.dateTo) {
      invoiceMatch.invoiceDate = {};
      if (filter.dateFrom) {
        invoiceMatch.invoiceDate.$gte = new Date(filter.dateFrom);
      }
      if (filter.dateTo) {
        const toDate = new Date(filter.dateTo);
        toDate.setHours(23, 59, 59, 999);
        invoiceMatch.invoiceDate.$lte = toDate;
      }
    }

    // 1. Aggregate units sold per product from invoices
    const salesPipeline: PipelineStage[] = [
      { $match: invoiceMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          unitsSold: { $sum: '$items.quantity' },
          orderCount: { $sum: 1 },
          salesValue: { $sum: '$items.total' }
        }
      }
    ];

    const salesResults = await Invoice.aggregate(salesPipeline);
    const salesMap = new Map<string, { unitsSold: number; orderCount: number; salesValue: number }>();
    salesResults.forEach(s => {
      if (s._id) {
        salesMap.set(s._id.toString(), {
          unitsSold: s.unitsSold || 0,
          orderCount: s.orderCount || 0,
          salesValue: s.salesValue || 0
        });
      }
    });

    // 2. Fetch active products
    const products = await Product.find({ tenantId: tId, isActive: true })
      .select('_id productName sku category currentStockQty rate')
      .lean();

    const productList = products.map((p: any) => {
      const pid = p._id.toString();
      const sale = salesMap.get(pid) || { unitsSold: 0, orderCount: 0, salesValue: 0 };
      const currentStock = p.currentStockQty || 0;
      const totalUnits = sale.unitsSold + currentStock;
      const velocityRate = totalUnits > 0 ? Math.round((sale.unitsSold / totalUnits) * 100) : 0;

      return {
        productId: p._id,
        productName: p.productName,
        sku: p.sku || '',
        currentStockQty: currentStock,
        unitsSold: sale.unitsSold,
        orderCount: sale.orderCount,
        salesValue: sale.salesValue,
        velocityRate, // Percentage of available stock sold
        segment: 'NO_SALES'
      };
    });

    // 3. Segment products with sales
    const sellingProducts = productList.filter(p => p.unitsSold > 0);
    sellingProducts.sort((a, b) => b.unitsSold - a.unitsSold);

    const totalSelling = sellingProducts.length;
    if (totalSelling > 0) {
      const q1Index = Math.ceil(totalSelling * 0.25);
      const q3Index = Math.ceil(totalSelling * 0.75);

      sellingProducts.forEach((p, idx) => {
        if (idx < q1Index) {
          p.segment = 'FAST_MOVING';
        } else if (idx < q3Index) {
          p.segment = 'NORMAL';
        } else {
          p.segment = 'SLOW_MOVING';
        }
      });
    }

    const segments = {
      FAST_MOVING: productList.filter(p => p.segment === 'FAST_MOVING'),
      NORMAL: productList.filter(p => p.segment === 'NORMAL'),
      SLOW_MOVING: productList.filter(p => p.segment === 'SLOW_MOVING'),
      NO_SALES: productList.filter(p => p.segment === 'NO_SALES')
    };

    return {
      summary: {
        totalProducts: productList.length,
        fastMovingCount: segments.FAST_MOVING.length,
        normalCount: segments.NORMAL.length,
        slowMovingCount: segments.SLOW_MOVING.length,
        noSalesCount: segments.NO_SALES.length,
        totalUnitsSold: salesResults.reduce((acc, s) => acc + (s.unitsSold || 0), 0)
      },
      fastMovingTop: segments.FAST_MOVING.slice(0, 15),
      slowMovingTop: segments.SLOW_MOVING.slice(0, 15),
      noSalesTop: segments.NO_SALES.slice(0, 15)
    };
  },

  /**
   * 3. Stock Risk Indicators (Objective product thresholds)
   * Out of Stock (<=0), Low Stock (1-10 units), Healthy (>10 units)
   */
  async getStockRiskIndicators(tenantId: string | mongoose.Types.ObjectId) {
    const tId = toObjectId(tenantId);

    const products = await Product.find({ tenantId: tId, isActive: true })
      .select('_id productName sku category currentStockQty rate')
      .lean();

    let outOfStockCount = 0;
    let lowStockCount = 0;
    let healthyCount = 0;
    let totalStockUnits = 0;

    const outOfStockItems: any[] = [];
    const lowStockItems: any[] = [];

    products.forEach((p: any) => {
      const qty = p.currentStockQty || 0;
      totalStockUnits += qty;

      if (qty <= 0) {
        outOfStockCount++;
        outOfStockItems.push({
          productId: p._id,
          productName: p.productName,
          sku: p.sku || '',
          currentStockQty: qty,
          rate: p.rate,
          risk: 'OUT_OF_STOCK'
        });
      } else if (qty <= 10) {
        lowStockCount++;
        lowStockItems.push({
          productId: p._id,
          productName: p.productName,
          sku: p.sku || '',
          currentStockQty: qty,
          rate: p.rate,
          risk: 'LOW_STOCK'
        });
      } else {
        healthyCount++;
      }
    });

    return {
      summary: {
        totalProducts: products.length,
        totalStockUnits,
        outOfStockCount,
        lowStockCount,
        healthyCount
      },
      outOfStockItems: outOfStockItems.slice(0, 30),
      lowStockItems: lowStockItems.slice(0, 30)
    };
  },

  /**
   * 4. Supplier Procurement Activity (Volume & Frequency Intelligence)
   * Aggregates purchase orders by vendor without fabricating delivery times.
   */
  async getSupplierProcurementActivity(tenantId: string | mongoose.Types.ObjectId, filter: AnalyticsFilter) {
    const tId = toObjectId(tenantId);
    
    const purchaseMatch: any = {
      tenantId: tId,
      status: 'COMPLETED'
    };

    if (filter.dateFrom || filter.dateTo) {
      purchaseMatch.purchaseDate = {};
      if (filter.dateFrom) {
        purchaseMatch.purchaseDate.$gte = new Date(filter.dateFrom);
      }
      if (filter.dateTo) {
        const toDate = new Date(filter.dateTo);
        toDate.setHours(23, 59, 59, 999);
        purchaseMatch.purchaseDate.$lte = toDate;
      }
    }

    const pipeline: PipelineStage[] = [
      { $match: purchaseMatch },
      {
        $group: {
          _id: '$supplierId',
          orderCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalTax: { $sum: '$taxAmount' },
          itemsArray: { $push: '$items' },
          lastPurchaseDate: { $max: '$purchaseDate' }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          supplierId: '$_id',
          supplierName: { $ifNull: ['$supplier.name', 'Unknown Supplier'] },
          supplierPhone: { $ifNull: ['$supplier.phone', ''] },
          supplierGstin: { $ifNull: ['$supplier.gstin', ''] },
          orderCount: 1,
          totalAmount: 1,
          totalTax: 1,
          itemsArray: 1,
          lastPurchaseDate: 1,
          _id: 0
        }
      },
      { $sort: { totalAmount: -1 } }
    ];

    const results = await Purchase.aggregate(pipeline);

    // Unpack base and free quantities
    const suppliers = results.map(s => {
      let baseQty = 0;
      let freeQty = 0;
      if (Array.isArray(s.itemsArray)) {
        s.itemsArray.forEach((items: any[]) => {
          if (Array.isArray(items)) {
            items.forEach(it => {
              baseQty += (it.quantity || 0);
              freeQty += (it.freeQuantity || 0);
            });
          }
        });
      }

      return {
        supplierId: s.supplierId,
        supplierName: s.supplierName,
        supplierPhone: s.supplierPhone,
        supplierGstin: s.supplierGstin,
        orderCount: s.orderCount,
        totalAmount: s.totalAmount,
        totalTax: s.totalTax,
        baseQuantity: baseQty,
        freeQuantity: freeQty,
        receivedQuantity: baseQty + freeQty,
        lastPurchaseDate: s.lastPurchaseDate
      };
    });

    const totalOrders = suppliers.reduce((acc, s) => acc + s.orderCount, 0);
    const totalPurchasedValue = suppliers.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalPhysicalQuantity = suppliers.reduce((acc, s) => acc + s.receivedQuantity, 0);

    return {
      summary: {
        activeSuppliersCount: suppliers.length,
        totalOrders,
        totalPurchasedValue,
        totalPhysicalQuantity
      },
      suppliers
    };
  }
};
