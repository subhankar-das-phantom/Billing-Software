/**
 * Notification Controller
 */

import type { Response, NextFunction } from 'express';
import type { SaaSRequest } from '../types';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notificationService';

const getTenantId = require('../../utils/getTenantId');

/**
 * GET /api/saas/notifications
 * Get notifications for the current tenant.
 * Query: ?limit=20&skip=0&unreadOnly=false
 */
export async function listNotifications(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = parseInt(req.query.skip as string) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await getNotifications(tenantId.toString(), {
      limit,
      skip,
      unreadOnly,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/saas/notifications/unread-count
 * Get unread notification count for badge.
 */
export async function unreadCount(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const count = await getUnreadCount(tenantId.toString());

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/saas/notifications/:id/read
 * Mark a single notification as read.
 */
export async function markRead(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    await markAsRead(req.params.id as string, tenantId.toString());

    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/saas/notifications/read-all
 * Mark all notifications as read.
 */
export async function markAllRead(
  req: SaaSRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    await markAllAsRead(tenantId.toString());

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}
