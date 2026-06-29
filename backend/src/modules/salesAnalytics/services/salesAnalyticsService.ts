import mongoose from 'mongoose';
import { getPreviousPeriod } from '../utils/dateUtils';
const Invoice = require('../../../../models/Invoice');
const Payment = require('../../../../models/Payment');
const CreditNote = require('../../../../models/CreditNote');

export class SalesAnalyticsService {
  /**
   * Retrieves high-level overview metrics with previous period comparisons.
   */
  static async getOverview(tenantId: mongoose.Types.ObjectId | string, start: Date, end: Date) {
    const prevRange = getPreviousPeriod(start, end);
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());

    // 1. Current Period Invoices (Revenue & Avg)
    const currentInvoiceAgg = await Invoice.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          invoiceDate: { $gte: start, $lte: end },
          status: { $ne: 'Cancelled' }
        } 
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totals.netTotal' },
          totalInvoices: { $sum: 1 },
          avgInvoiceValue: { $avg: '$totals.netTotal' }
        }
      }
    ]);

    // 2. Previous Period Invoices
    const prevInvoiceAgg = await Invoice.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          invoiceDate: { $gte: prevRange.start, $lte: prevRange.end },
          status: { $ne: 'Cancelled' }
        } 
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totals.netTotal' },
          totalInvoices: { $sum: 1 }
        }
      }
    ]);

    // 3. Current Period Collections (Payments)
    const currentCollectionsAgg = await Payment.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          paymentDate: { $gte: start, $lte: end }
        } 
      },
      {
        $group: {
          _id: null,
          totalCollections: { $sum: '$amount' }
        }
      }
    ]);

    // 4. Previous Period Collections
    const prevCollectionsAgg = await Payment.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          paymentDate: { $gte: prevRange.start, $lte: prevRange.end }
        } 
      },
      {
        $group: {
          _id: null,
          totalCollections: { $sum: '$amount' }
        }
      }
    ]);

    // 5. Total Outstanding (All time, Unpaid/Partially Paid)
    const outstandingAgg = await Invoice.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          status: { $ne: 'Cancelled' },
          paymentStatus: { $in: ['Unpaid', 'Partial'] }
        } 
      },
      {
        $group: {
          _id: null,
          totalOutstanding: { 
            $sum: { 
              $subtract: [
                { $ifNull: ['$totals.netTotal', 0] }, 
                { $ifNull: ['$paidAmount', 0] }
              ] 
            } 
          }
        }
      }
    ]);

    // 6. Current Period Credit Notes
    const creditNotesAgg = await CreditNote.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          createdAt: { $gte: start, $lte: end }
        } 
      },
      {
        $group: {
          _id: null,
          totalCreditNotes: { $sum: '$totals.netTotal' }
        }
      }
    ]);

    // Extract values safely
    const currentInvoiceData = currentInvoiceAgg[0] || { totalRevenue: 0, totalInvoices: 0, avgInvoiceValue: 0 };
    const prevInvoiceData = prevInvoiceAgg[0] || { totalRevenue: 0, totalInvoices: 0 };
    const currentColData = currentCollectionsAgg[0] || { totalCollections: 0 };
    const prevColData = prevCollectionsAgg[0] || { totalCollections: 0 };
    
    // Calculate Growths
    const calcGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    return {
      totalRevenue: currentInvoiceData.totalRevenue,
      totalInvoices: currentInvoiceData.totalInvoices,
      avgInvoiceValue: currentInvoiceData.avgInvoiceValue || 0,
      totalCollections: currentColData.totalCollections,
      totalOutstanding: outstandingAgg[0]?.totalOutstanding || 0,
      totalCreditNotes: creditNotesAgg[0]?.totalCreditNotes || 0,
      growth: {
        revenue: calcGrowth(currentInvoiceData.totalRevenue, prevInvoiceData.totalRevenue),
        invoices: calcGrowth(currentInvoiceData.totalInvoices, prevInvoiceData.totalInvoices),
        collections: calcGrowth(currentColData.totalCollections, prevColData.totalCollections)
      }
    };
  }

  /**
   * Get Monthly sales trend for a given year
   */
  static async getMonthlySales(tenantId: mongoose.Types.ObjectId | string, year: number) {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year}-12-31T23:59:59.999Z`);
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());

    const agg = await Invoice.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          invoiceDate: { $gte: start, $lte: end },
          status: { $ne: 'Cancelled' }
        } 
      },
      {
        $group: {
          _id: { month: { $month: '$invoiceDate' }, year: { $year: '$invoiceDate' } },
          revenue: { $sum: '$totals.netTotal' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    // Fill in missing months with 0
    const results = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      year,
      revenue: 0,
      invoiceCount: 0
    }));

    agg.forEach((item: any) => {
      const idx = item._id.month - 1;
      if (results[idx]) {
        results[idx].revenue = item.revenue;
        results[idx].invoiceCount = item.invoiceCount;
      }
    });

    return results;
  }

  /**
   * Get Daily sales for a given date range
   */
  static async getDailySales(tenantId: mongoose.Types.ObjectId | string, start: Date, end: Date) {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());
    const agg = await Invoice.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          invoiceDate: { $gte: start, $lte: end },
          status: { $ne: 'Cancelled' }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" } },
          revenue: { $sum: '$totals.netTotal' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    return agg.map((a: any) => ({
      date: a._id,
      revenue: a.revenue,
      invoiceCount: a.invoiceCount
    }));
  }

  /**
   * Get Yearly sales trend
   */
  static async getYearlySales(tenantId: mongoose.Types.ObjectId | string) {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());
    const agg = await Invoice.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId,
          status: { $ne: 'Cancelled' }
        } 
      },
      {
        $group: {
          _id: { year: { $year: '$invoiceDate' } },
          revenue: { $sum: '$totals.netTotal' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1 } }
    ]);

    return agg.map((a: any) => ({
      year: a._id.year,
      revenue: a.revenue,
      invoiceCount: a.invoiceCount
    }));
  }

  /**
   * Top Products by revenue
   */
  static async getTopProducts(tenantId: mongoose.Types.ObjectId | string, start: Date, end: Date, limit: number = 10) {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());
    const agg = await Invoice.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          invoiceDate: { $gte: start, $lte: end },
          status: { $ne: 'Cancelled' }
        } 
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product._id', // the product reference ObjectId
          productName: { $first: '$items.product.productName' },
          revenue: { $sum: '$items.totalAmount' },
          quantitySold: { $sum: '$items.quantitySold' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: limit }
    ]);

    return agg;
  }

  /**
   * Top Customers by revenue
   */
  static async getTopCustomers(tenantId: mongoose.Types.ObjectId | string, start: Date, end: Date, limit: number = 10) {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());
    const agg = await Invoice.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          invoiceDate: { $gte: start, $lte: end },
          status: { $ne: 'Cancelled' }
        } 
      },
      {
        $group: {
          _id: '$customer._id', // customer ObjectId
          customerName: { $first: '$customer.customerName' },
          revenue: { $sum: '$totals.netTotal' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: limit }
    ]);

    return agg;
  }

  /**
   * Payment trends by method
   */
  static async getPaymentTrends(tenantId: mongoose.Types.ObjectId | string, start: Date, end: Date) {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());
    const agg = await Payment.aggregate([
      { 
        $match: { 
          tenantId: tenantObjectId, 
          paymentDate: { $gte: start, $lte: end }
        } 
      },
      {
        $group: {
          _id: '$paymentMethod',
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { amount: -1 } }
    ]);

    return agg.map((a: any) => ({
      method: a._id,
      amount: a.amount
    }));
  }
}
