import mongoose, { PipelineStage } from 'mongoose';
import StockMovement, { IStockMovement } from '../models/StockMovement';

export interface GetStockMovementsFilter {
  productId?: string;
  batchId?: string;
  type?: string;
  referenceType?: string;
  referenceId?: string;
  dateFrom?: string;
  dateTo?: string;
}

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
    if (filters.batchId) {
      if (mongoose.Types.ObjectId.isValid(filters.batchId)) {
        matchStage.batchId = new mongoose.Types.ObjectId(filters.batchId);
      } else {
        matchStage.batchId = null;
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
        matchStage.createdAt.$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = toDate;
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
              then: { _id: '$admin._id', name: '$admin.name', model: 'Admin' },
              else: { _id: '$employee._id', name: '$employee.name', model: 'Employee' }
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
