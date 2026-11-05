/**
 * Bharat Enterprise Billing System — Platform Dashboard Queries
 * Parallel indexed aggregations for platform metrics, MRR calculations, and 30s TTL caching.
 */

import Admin from '../../../backend/models/Admin';
import Subscription from '../../../backend/saas/models/Subscription';
import SubscriptionPayment from '../../../backend/saas/models/SubscriptionPayment';
import { DashboardOverviewDTO } from '../types';

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const CACHE_TTL_MS = 30 * 1000; // 30 seconds

interface CacheEntry {
  data: DashboardOverviewDTO;
  expiresAt: number;
}

let cachedOverview: CacheEntry | null = null;

/**
 * Invalidates the in-memory platform dashboard cache.
 * Called when subscription, payment, or tenant status mutations occur.
 */
export function invalidatePlatformDashboardCache(): void {
  cachedOverview = null;
}

/**
 * Calculates IST-aligned calendar boundaries for accurate Indian timezone revenue aggregation.
 */
export function getISTDateBoundaries(referenceDate: Date = new Date()): {
  todayStart: Date;
  tomorrowStart: Date;
  monthStart: Date;
  nextMonthStart: Date;
} {
  const shiftedNowMs = referenceDate.getTime() + IST_OFFSET_MS;
  const shiftedNow = new Date(shiftedNowMs);
  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth();
  const day = shiftedNow.getUTCDate();

  const todayStartMs = Date.UTC(year, month, day) - IST_OFFSET_MS;
  const tomorrowStartMs = todayStartMs + DAY_MS;
  const monthStartMs = Date.UTC(year, month, 1) - IST_OFFSET_MS;
  const nextMonthStartMs = Date.UTC(year, month + 1, 1) - IST_OFFSET_MS;

  return {
    todayStart: new Date(todayStartMs),
    tomorrowStart: new Date(tomorrowStartMs),
    monthStart: new Date(monthStartMs),
    nextMonthStart: new Date(nextMonthStartMs),
  };
}

/**
 * 1. Aggregates total and active tenant counts from the Admin collection.
 */
export async function getTenantCountsQuery(): Promise<{ total: number; active: number }> {
  const [total, active] = await Promise.all([
    Admin.countDocuments({}),
    Admin.countDocuments({ isActive: true }),
  ]);

  return {
    total,
    active,
  };
}

/**
 * 2. Aggregates subscription counts grouped by status from the Subscription collection.
 */
export async function getSubscriptionBreakdownQuery(): Promise<{
  trial: number;
  active: number;
  grace: number;
  expired: number;
  suspended: number;
}> {
  const results = await Subscription.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const counts = {
    trial: 0,
    active: 0,
    grace: 0,
    expired: 0,
    suspended: 0,
  };

  for (const item of results) {
    const statusKey = typeof item._id === 'string' ? item._id.toLowerCase() : '';
    if (statusKey in counts) {
      counts[statusKey as keyof typeof counts] = item.count;
    }
  }

  return counts;
}

/**
 * 3. Aggregates Contracted Monthly Recurring Revenue (MRR) and ARR from active Subscriptions.
 * Formula: monthlyRate = currentPricingSnapshot.finalAmount / currentPricingSnapshot.durationMonths
 */
export async function getMRRQuery(now: Date = new Date()): Promise<{
  contractedMRR: number;
  arr: number;
  activeSubscriptionsCount: number;
}> {
  const results = await Subscription.aggregate([
    {
      $match: {
        status: 'active',
        expiresAt: { $gte: now },
      },
    },
    {
      $project: {
        monthlyRate: {
          $cond: [
            {
              $and: [
                { $gt: ['$currentPricingSnapshot.durationMonths', 0] },
                { $ne: ['$currentPricingSnapshot.durationMonths', null] },
              ],
            },
            {
              $divide: [
                '$currentPricingSnapshot.finalAmount',
                '$currentPricingSnapshot.durationMonths',
              ],
            },
            { $ifNull: ['$currentPricingSnapshot.finalAmount', 0] },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        contractedMRR: { $sum: '$monthlyRate' },
        activeSubscriptionsCount: { $sum: 1 },
      },
    },
  ]);

  const row = results[0];
  const rawMRR = row?.contractedMRR ?? 0;
  const contractedMRR = Math.round((rawMRR + Number.EPSILON) * 100) / 100;
  const arr = Math.round((contractedMRR * 12 + Number.EPSILON) * 100) / 100;
  const activeSubscriptionsCount = row?.activeSubscriptionsCount ?? 0;

  return {
    contractedMRR,
    arr,
    activeSubscriptionsCount,
  };
}

/**
 * 4. Covered index scan on SubscriptionPayment to calculate month and today revenue & counts.
 */
export async function getPlatformPaymentStatsQuery(now: Date = new Date()): Promise<{
  today: number;
  thisMonth: number;
  todayPaymentsCount: number;
  thisMonthPaymentsCount: number;
}> {
  const boundaries = getISTDateBoundaries(now);

  const results = await SubscriptionPayment.aggregate([
    {
      $match: {
        paymentStatus: 'completed',
        paidAt: { $gte: boundaries.monthStart, $lt: boundaries.nextMonthStart },
      },
    },
    {
      $group: {
        _id: null,
        thisMonth: { $sum: '$finalAmount' },
        thisMonthPaymentsCount: { $sum: 1 },
        today: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$paidAt', boundaries.todayStart] },
                  { $lt: ['$paidAt', boundaries.tomorrowStart] },
                ],
              },
              '$finalAmount',
              0,
            ],
          },
        },
        todayPaymentsCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$paidAt', boundaries.todayStart] },
                  { $lt: ['$paidAt', boundaries.tomorrowStart] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const row = results[0];
  const rawMonthRev = row?.thisMonth ?? 0;
  const rawTodayRev = row?.today ?? 0;

  return {
    today: Math.round((rawTodayRev + Number.EPSILON) * 100) / 100,
    thisMonth: Math.round((rawMonthRev + Number.EPSILON) * 100) / 100,
    todayPaymentsCount: row?.todayPaymentsCount ?? 0,
    thisMonthPaymentsCount: row?.thisMonthPaymentsCount ?? 0,
  };
}

/**
 * Retrieves the platform dashboard overview DTO utilizing parallel indexed queries
 * and in-memory 30-second TTL caching.
 */
export async function getPlatformDashboardOverview(
  forceRefresh = false
): Promise<DashboardOverviewDTO> {
  const now = Date.now();

  // Return cached result if valid and refresh not requested
  if (!forceRefresh && cachedOverview && now < cachedOverview.expiresAt) {
    return {
      ...cachedOverview.data,
      systemHealth: {
        ...cachedOverview.data.systemHealth,
        isCached: true,
      },
    };
  }

  const currentDate = new Date(now);

  // Execute independent aggregation queries in parallel (Zero multi-collection $facet anti-pattern)
  const [tenantCounts, subBreakdown, mrrStats, paymentStats] = await Promise.all([
    getTenantCountsQuery(),
    getSubscriptionBreakdownQuery(),
    getMRRQuery(currentDate),
    getPlatformPaymentStatsQuery(currentDate),
  ]);

  const overview: DashboardOverviewDTO = {
    tenants: {
      total: tenantCounts.total,
      active: tenantCounts.active,
      trial: subBreakdown.trial,
      grace: subBreakdown.grace,
      expired: subBreakdown.expired,
      suspended: subBreakdown.suspended,
    },
    mrr: {
      contractedMRR: mrrStats.contractedMRR,
      arr: mrrStats.arr,
      activeSubscriptionsCount: mrrStats.activeSubscriptionsCount,
    },
    revenue: {
      today: paymentStats.today,
      thisMonth: paymentStats.thisMonth,
      todayPaymentsCount: paymentStats.todayPaymentsCount,
      thisMonthPaymentsCount: paymentStats.thisMonthPaymentsCount,
    },
    systemHealth: {
      status: 'HEALTHY',
      cacheTimestamp: currentDate.toISOString(),
      isCached: false,
    },
  };

  cachedOverview = {
    data: overview,
    expiresAt: now + CACHE_TTL_MS,
  };

  return overview;
}
