/**
 * checkWriteAccess Middleware
 *
 * Blocks write operations when subscription is expired beyond grace.
 * Used on POST/PUT/DELETE routes for creating/modifying business data.
 *
 * Usage:
 *   router.post('/', protect, checkSubscription, checkWriteAccess, createInvoice);
 */

import type { Response, NextFunction } from 'express';
import type { SaaSRequest } from '../types';

export function checkWriteAccess(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): void {
  // If subscription info wasn't attached, allow (graceful degradation)
  if (!req.subscription) {
    next();
    return;
  }

  if (!req.subscription.canWrite) {
    res.status(403).json({
      success: false,
      message:
        'Your subscription has expired. Please renew to create or edit records. You can still view your existing data.',
      code: 'SUBSCRIPTION_EXPIRED',
      status: req.subscription.status,
    });
    return;
  }

  // If in grace period, allow but the response header signals the frontend
  if (req.subscription.isGrace) {
    res.setHeader('X-Subscription-Grace', 'true');
    res.setHeader(
      'X-Subscription-Grace-Days',
      String(req.subscription.daysRemaining),
    );
  }

  next();
}
