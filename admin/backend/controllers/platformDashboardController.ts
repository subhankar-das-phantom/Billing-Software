/**
 * Bharat Enterprise Billing System — Platform Dashboard Controller
 * HTTP endpoints for high-level platform KPI counters, MRR metrics, and revenue breakdown.
 */

import { Response } from 'express';
import { PlatformRequest } from '../types';
import { getPlatformDashboardOverview } from '../queries/dashboardQueries';

/**
 * Retrieves the aggregated platform dashboard overview.
 * GET /api/platform/dashboard/overview
 */
export async function getOverview(req: PlatformRequest, res: Response): Promise<void> {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const overview = await getPlatformDashboardOverview(forceRefresh);

    res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve platform dashboard overview metrics',
    });
  }
}
