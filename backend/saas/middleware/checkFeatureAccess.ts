/**
 * checkFeatureAccess Middleware Factory
 *
 * Returns a middleware that checks if the tenant's plan
 * includes the specified feature.
 *
 * Usage:
 *   router.use(protect, checkSubscription, checkFeatureAccess(Feature.PAYMENTS));
 */

import type { Response, NextFunction } from 'express';
import type { SaaSRequest } from '../types';
import { Feature, SubscriptionStatus } from '../shared/features';

export function checkFeatureAccess(feature: Feature) {
  return (req: SaaSRequest, res: Response, next: NextFunction): void => {
    // If subscription info wasn't attached (middleware didn't run or errored), allow
    if (!req.subscription) {
      next();
      return;
    }

    const { subscription } = req;

    // Check if feature is in the plan's feature list
    if (!subscription.plan.features.includes(feature)) {
      res.status(403).json({
        success: false,
        message: `This feature requires a higher plan. Your current plan (${subscription.plan.name}) does not include access to this feature.`,
        code: 'FEATURE_NOT_AVAILABLE',
        requiredFeature: feature,
        currentPlan: subscription.plan.code,
      });
      return;
    }

    // Feature is available — but check if subscription allows access
    if (
      subscription.status === SubscriptionStatus.EXPIRED ||
      subscription.status === SubscriptionStatus.SUSPENDED
    ) {
      // Expired: allow reads, block writes (handled by checkWriteAccess)
      // But still allow accessing the feature endpoint for reads
    }

    next();
  };
}
