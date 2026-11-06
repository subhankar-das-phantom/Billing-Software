/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * Tenant Keyset Queries
 *
 * Cryptographically signed keyset pagination, bounded indexes, and single-query lookups.
 */

import mongoose from 'mongoose';
import Admin from '../../../backend/models/Admin';
import Subscription from '../../../backend/saas/models/Subscription';
import { encodeKeysetCursor, decodeAndVerifyKeysetCursor, computeFilterSignature } from '../utils/cursorCrypto';
import type { IKeysetCursor, TenantListItemDTO } from '../types';

export interface ListTenantsParams {
  cursor?: string;
  limit?: number;
  sortField?: 'createdAt' | 'normalizedFirmName';
  sortDirection?: 'asc' | 'desc';
  search?: string;
  status?: string;
  isActive?: boolean;
}

export interface ListTenantsResult {
  data: TenantListItemDTO[];
  pagination: {
    hasNextPage: boolean;
    nextCursor: string | null;
    limit: number;
    totalCount?: number;
  };
}

/**
 * Lists tenants using bounded keyset pagination and HMAC-signed cursor verification.
 */
export async function listTenantsQuery(
  params: ListTenantsParams = {}
): Promise<ListTenantsResult> {
  const limit = Math.min(Math.max(params.limit || 25, 1), 100);
  const sortField = params.sortField === 'normalizedFirmName' ? 'normalizedFirmName' : 'createdAt';
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';

  // 1. Compute filter signature context
  const filterSig = computeFilterSignature({
    search: params.search || '',
    status: params.status || '',
    isActive: params.isActive,
  });

  // 2. Decode and verify keyset cursor if provided
  let decodedCursor: IKeysetCursor | null = null;
  if (params.cursor) {
    decodedCursor = decodeAndVerifyKeysetCursor(params.cursor, {
      expectedSortField: sortField,
      expectedSortDirection: sortDirection,
      expectedTenantScope: null, // Global scope
      currentFilterSig: filterSig,
    });
  }

  // 3. Build indexed base query filters
  const baseMatch: Record<string, any> = {};

  if (typeof params.isActive === 'boolean') {
    baseMatch.isActive = params.isActive;
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = { $regex: term, $options: 'i' };
    baseMatch.$or = [
      { firmName: searchRegex },
      { email: searchRegex },
      { firmPhone: searchRegex },
      { firmGSTIN: searchRegex },
    ];
  }

  if (params.status && params.status.trim()) {
    const activeTenantIds = await Subscription.distinct('tenantId', {
      status: params.status.trim().toLowerCase(),
    });
    baseMatch._id = { $in: activeTenantIds };
  }

  // 4. Attach keyset cursor condition
  if (decodedCursor) {
    const cursorId = new mongoose.Types.ObjectId(decodedCursor.id);
    const isDesc = sortDirection === 'desc';

    if (sortField === 'createdAt') {
      const cursorDate = new Date(Number(decodedCursor.val));
      const keysetCondition = isDesc
        ? [
            { createdAt: { $lt: cursorDate } },
            { createdAt: cursorDate, _id: { $lt: cursorId } },
          ]
        : [
            { createdAt: { $gt: cursorDate } },
            { createdAt: cursorDate, _id: { $gt: cursorId } },
          ];

      if (baseMatch.$or) {
        baseMatch.$and = [
          { $or: baseMatch.$or },
          { $or: keysetCondition },
        ];
        delete baseMatch.$or;
      } else {
        baseMatch.$or = keysetCondition;
      }
    } else if (sortField === 'normalizedFirmName') {
      const cursorVal = String(decodedCursor.val);
      const keysetCondition = isDesc
        ? [
            { normalizedFirmName: { $lt: cursorVal } },
            { normalizedFirmName: cursorVal, _id: { $lt: cursorId } },
          ]
        : [
            { normalizedFirmName: { $gt: cursorVal } },
            { normalizedFirmName: cursorVal, _id: { $gt: cursorId } },
          ];

      if (baseMatch.$or) {
        baseMatch.$and = [
          { $or: baseMatch.$or },
          { $or: keysetCondition },
        ];
        delete baseMatch.$or;
      } else {
        baseMatch.$or = keysetCondition;
      }
    }
  }

  // 5. Construct aggregation pipeline with single minimal $lookup
  const sortDir = sortDirection === 'asc' ? 1 : -1;
  const pipeline: any[] = [
    { $match: baseMatch },
    {
      $sort: {
        [sortField]: sortDir,
        _id: sortDir,
      },
    },
    { $limit: limit + 1 },
    {
      $lookup: {
        from: 'subscriptions',
        let: { tId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$tenantId', '$$tId'] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          {
            $project: {
              status: 1,
              expiresAt: 1,
              currentPricingSnapshot: 1,
            },
          },
        ],
        as: 'activeSub',
      },
    },
    {
      $addFields: {
        subscriptionDoc: { $arrayElemAt: ['$activeSub', 0] },
      },
    },
  ];

  const [rawResults, totalCount] = await Promise.all([
    Admin.aggregate(pipeline).exec(),
    Admin.countDocuments(baseMatch).exec(),
  ]);

  const hasNextPage = rawResults.length > limit;
  const items = hasNextPage ? rawResults.slice(0, limit) : rawResults;

  // 6. Generate nextCursor from tail record
  let nextCursor: string | null = null;
  if (hasNextPage && items.length > 0) {
    const lastItem = items[items.length - 1];
    const val =
      sortField === 'createdAt'
        ? new Date(lastItem.createdAt).getTime()
        : (lastItem.normalizedFirmName || (lastItem.firmName || '').toLowerCase().trim());

    nextCursor = encodeKeysetCursor({
      sortField,
      sortDirection,
      val,
      id: lastItem._id.toString(),
      tenantScope: null,
      filterSig,
    });
  }

  // 7. Format DTO records
  const data: TenantListItemDTO[] = items.map((doc: any) => ({
    tenantId: doc._id.toString(),
    firmName: doc.firmName || '',
    normalizedFirmName: doc.normalizedFirmName || (doc.firmName || '').toLowerCase().trim(),
    email: doc.email || '',
    phone: doc.firmPhone || '',
    firmGSTIN: doc.firmGSTIN || '',
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt && !isNaN(new Date(doc.createdAt).getTime()) ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    subscription: doc.subscriptionDoc
      ? {
          status: doc.subscriptionDoc.status || 'unknown',
          planName: doc.subscriptionDoc.currentPricingSnapshot?.planName || 'N/A',
          planCode: doc.subscriptionDoc.currentPricingSnapshot?.planCode || '',
          expiresAt: doc.subscriptionDoc.expiresAt && !isNaN(new Date(doc.subscriptionDoc.expiresAt).getTime())
            ? new Date(doc.subscriptionDoc.expiresAt).toISOString()
            : '',
          isGrace: doc.subscriptionDoc.status === 'grace',
        }
      : null,
  }));

  return {
    data,
    pagination: {
      hasNextPage,
      nextCursor,
      limit,
      totalCount,
    },
  };
}

export default listTenantsQuery;
