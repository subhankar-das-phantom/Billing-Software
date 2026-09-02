/**
 * checkSubscription Middleware
 *
 * Runs AFTER auth.protect middleware.
 * Fetches subscription info for the tenant and attaches it to req.subscription.
 *
 * Does NOT block requests — it enriches the request object.
 * Feature/write blocking is handled by checkFeatureAccess and checkWriteAccess.
 */

import type { Response, NextFunction } from 'express';
import type { SaaSRequest } from '../types';
import { getSubscriptionInfo } from '../services/featureService';

const getTenantId = require('../../utils/getTenantId');

export async function checkSubscription(
  req: SaaSRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Resolve tenant ID using existing utility (Admin._id or Employee.createdByAdmin)
    const tenantId = getTenantId(req);

    if (!tenantId) {
      // No tenant context (shouldn't happen after auth, but be safe)
      next();
      return;
    }

    // Fetch subscription info (cached for 60s)
    const subscriptionInfo = await getSubscriptionInfo(tenantId.toString());

    // Attach to request
    req.subscription = subscriptionInfo;

    next();
  } catch (error) {
    // Don't block on subscription check errors — log and continue
    console.error('checkSubscription middleware error:', error);
    next();
  }
}
