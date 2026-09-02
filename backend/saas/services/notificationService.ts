/**
 * Notification Service — simple, cron-friendly design.
 *
 * NO overengineered scheduler. Just:
 * 1. scheduleExpiryNotifications() — pre-creates future notifications
 * 2. Daily cron checks scheduledFor <= now && unread
 * 3. Controller serves them to frontend
 */

import Notification from '../models/Notification';
import { NotificationType, NotificationChannel } from '../shared/features';

// ─── Schedule Expiry Notifications ───────────────────────────────

/**
 * Pre-create notification records for subscription expiry.
 * These have a `scheduledFor` date and only appear to the user
 * when that date has passed.
 *
 * Offsets: -7d, -3d, -1d, 0d (expiry), +3d, +7d
 */
export async function scheduleExpiryNotifications(
  tenantId: string,
  subscriptionId: string,
  expiresAt: Date,
): Promise<void> {
  // Remove any existing scheduled expiry notifications for this tenant
  await Notification.deleteMany({
    tenantId,
    type: {
      $in: [
        NotificationType.SUBSCRIPTION_EXPIRY_WARNING,
        NotificationType.SUBSCRIPTION_EXPIRED,
      ],
    },
    read: false,
  });

  const notifications = [
    {
      offsetDays: -7,
      type: NotificationType.SUBSCRIPTION_EXPIRY_WARNING,
      title: 'Subscription expiring soon',
      message: 'Your subscription expires in 7 days. Renew now to avoid service interruption.',
    },
    {
      offsetDays: -3,
      type: NotificationType.SUBSCRIPTION_EXPIRY_WARNING,
      title: 'Subscription expiring in 3 days',
      message: 'Your subscription expires in 3 days. Renew now to keep full access.',
    },
    {
      offsetDays: -1,
      type: NotificationType.SUBSCRIPTION_EXPIRY_WARNING,
      title: 'Subscription expires tomorrow',
      message: 'Your subscription expires tomorrow! Renew now to avoid losing write access.',
    },
    {
      offsetDays: 0,
      type: NotificationType.SUBSCRIPTION_EXPIRED,
      title: 'Subscription expired',
      message: 'Your subscription has expired. You are now in the grace period with limited access.',
    },
    {
      offsetDays: 3,
      type: NotificationType.SUBSCRIPTION_EXPIRED,
      title: 'Grace period ending soon',
      message: 'Your grace period ends in 4 days. Renew to restore full write access.',
    },
    {
      offsetDays: 7,
      type: NotificationType.SUBSCRIPTION_EXPIRED,
      title: 'Grace period ended',
      message: 'Your grace period has ended. Your account is now in read-only mode. Renew to restore access.',
    },
  ];

  const now = new Date();
  const docs = [];

  for (const n of notifications) {
    const scheduledFor = new Date(
      expiresAt.getTime() + n.offsetDays * 24 * 60 * 60 * 1000,
    );

    // Only create future notifications
    if (scheduledFor > now) {
      docs.push({
        tenantId,
        type: n.type,
        channel: NotificationChannel.IN_APP,
        title: n.title,
        message: n.message,
        data: { subscriptionId },
        read: false,
        scheduledFor,
      });
    }
  }

  if (docs.length > 0) {
    await Notification.insertMany(docs);
  }
}

// ─── Query Notifications ─────────────────────────────────────────

/**
 * Get visible notifications for a tenant.
 * Only returns notifications where scheduledFor <= now.
 */
export async function getNotifications(
  tenantId: string,
  options: { limit?: number; skip?: number; unreadOnly?: boolean } = {},
): Promise<{
  notifications: typeof Notification.prototype[];
  total: number;
}> {
  const { limit = 20, skip = 0, unreadOnly = false } = options;
  const now = new Date();

  const filter: Record<string, unknown> = {
    tenantId,
    $or: [
      { scheduledFor: { $lte: now } },
      { scheduledFor: null },
    ],
  };

  if (unreadOnly) {
    filter.read = false;
  }

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return { notifications, total };
}

/**
 * Get unread count for badge display.
 */
export async function getUnreadCount(tenantId: string): Promise<number> {
  const now = new Date();
  return Notification.countDocuments({
    tenantId,
    read: false,
    $or: [
      { scheduledFor: { $lte: now } },
      { scheduledFor: null },
    ],
  });
}

// ─── Mark Read ───────────────────────────────────────────────────

export async function markAsRead(
  notificationId: string,
  tenantId: string,
): Promise<void> {
  await Notification.findOneAndUpdate(
    { _id: notificationId, tenantId },
    { $set: { read: true, readAt: new Date() } },
  );
}

export async function markAllAsRead(tenantId: string): Promise<void> {
  await Notification.updateMany(
    { tenantId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
}

// ─── Create Notification ─────────────────────────────────────────

/**
 * Create a one-off notification (e.g., referral reward, plan upgrade).
 */
export async function createNotification(
  tenantId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await Notification.create({
    tenantId,
    type,
    channel: NotificationChannel.IN_APP,
    title,
    message,
    data: data || {},
    read: false,
  });
}
