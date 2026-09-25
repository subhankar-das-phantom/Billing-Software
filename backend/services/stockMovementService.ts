import mongoose, { PipelineStage } from 'mongoose';
import StockMovement, { IStockMovement } from '../models/StockMovement';
import Batch from '../models/Batch';

export interface GetStockMovementsFilter {
  productId?: string;
  batchId?: string;
  batchNo?: string;
  type?: string;
  referenceType?: string;
  referenceId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export const parseISTDateBoundary = (dateInput?: any, endOfDay = false): Date | null => {
  if (!dateInput) return null;
  const raw = String(dateInput).trim();
  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const timePart = endOfDay ? '23:59:59.999' : '00:00:00.000';
    const parsed = new Date(`${year}-${month}-${day}T${timePart}+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const stockMovementService = {
  async getStockMovements(
    tenantId: string,
    filters: GetStockMovementsFilter,
    page: number = 1,
    limit: number = 20
  ) {
    const matchStage: any = { tenantId };

    if (filters.productId) {
      if (mongoose.Types.ObjectId.isValid(filters.productId)) {
        matchStage.productId = new mongoose.Types.ObjectId(filters.productId);
      } else {
        // Force no match if invalid ID is provided
        matchStage.productId = null;
      }
    }

    const rawBatchQuery = (filters.batchId || filters.batchNo || '').trim();
    if (rawBatchQuery) {
      const isObjectId = mongoose.Types.ObjectId.isValid(rawBatchQuery) && rawBatchQuery.length === 24;

      // Find all batches for this tenant where batchNo matches regex OR _id equals the valid ObjectId
      const matchingBatches = await Batch.find({
        tenantId,
        $or: [
          ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(rawBatchQuery) }] : []),
          { batchNo: { $regex: escapeRegex(rawBatchQuery), $options: 'i' } }
        ]
      }).select('_id').lean();

      if (matchingBatches.length > 0) {
        matchStage.batchId = { $in: matchingBatches.map(b => b._id) };
      } else {
        // No batches matched the search query -> force 0 movement results
        matchStage.batchId = new mongoose.Types.ObjectId();
      }
    }

    if (filters.type) {
      matchStage.type = filters.type;
    }
    if (filters.referenceType) {
      matchStage.referenceType = filters.referenceType;
    }
    if (filters.referenceId) {
      matchStage.referenceId = filters.referenceId;
    }
    
    if (filters.dateFrom || filters.dateTo) {
      matchStage.createdAt = {};
      if (filters.dateFrom) {
        const fromDate = parseISTDateBoundary(filters.dateFrom, false);
        if (fromDate) matchStage.createdAt.$gte = fromDate;
      }
      if (filters.dateTo) {
        const toDate = parseISTDateBoundary(filters.dateTo, true);
        if (toDate) matchStage.createdAt.$lte = toDate;
      }
    }

    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
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
        $lookup: {
          from: 'batches',
          localField: 'batchId',
          foreignField: '_id',
          as: 'batch'
        }
      },
      { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'employees',
          localField: 'createdBy.user',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'admins',
          localField: 'createdBy.user',
          foreignField: '_id',
          as: 'admin'
        }
      },
      { $unwind: { path: '$admin', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          type: 1,
          quantity: 1,
          direction: {
            $cond: {
              if: {
                $in: [
                  '$type',
                  ['PURCHASE', 'OPENING_STOCK', 'MANUAL_ADJUSTMENT_IN', 'SALE_RETURN', 'SALE_REVERSAL']
                ]
              },
              then: 'IN',
              else: 'OUT'
            }
          },
          signedQuantity: {
            $cond: {
              if: {
                $in: [
                  '$type',
                  ['PURCHASE', 'OPENING_STOCK', 'MANUAL_ADJUSTMENT_IN', 'SALE_RETURN', 'SALE_REVERSAL']
                ]
              },
              then: '$quantity',
              else: { $multiply: ['$quantity', -1] }
            }
          },
          rate: 1,
          totalValue: 1,
          referenceType: 1,
          referenceId: 1,
          createdAt: 1,
          'product._id': 1,
          'product.productName': 1,
          'product.sku': 1,
          'batch._id': 1,
          'batch.batchNo': 1,
          'batch.batchNumber': '$batch.batchNo',
          'batch.expiryDate': 1,
          'createdBy': {
            $cond: {
              if: { $eq: ['$createdBy.userModel', 'Admin'] },
              then: {
                _id: '$admin._id',
                name: { $ifNull: ['$admin.name', { $ifNull: ['$admin.firmName', 'Admin'] }] },
                model: 'Admin'
              },
              else: {
                _id: '$employee._id',
                name: { $ifNull: ['$employee.name', 'Employee'] },
                model: 'Employee'
              }
            }
          }
        }
      }
    ];

    const [data, totalCount] = await Promise.all([
      StockMovement.aggregate(pipeline),
      StockMovement.countDocuments(matchStage)
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: totalCount
      }
    };
  }
};
