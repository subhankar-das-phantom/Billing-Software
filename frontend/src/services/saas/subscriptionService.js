/**
 * SaaS Subscription API Service
 */
import api from '../api';

export const subscriptionService = {
  // ─── Plans ─────────────────────────────────────────────────────
  async getPlans() {
    const { data } = await api.get('/saas/plans');
    return data;
  },

  async getPlan(planId) {
    const { data } = await api.get(`/saas/plans/${planId}`);
    return data;
  },

  // ─── Subscription ─────────────────────────────────────────────
  async getSubscription() {
    const { data } = await api.get('/saas/subscription');
    return data;
  },

  async checkout(planId, durationMonths) {
    const { data } = await api.post('/saas/subscription/checkout', {
      planId,
      durationMonths,
    });
    return data;
  },

  async verifyPayment(paymentData) {
    const { data } = await api.post('/saas/subscription/verify', paymentData);
    return data;
  },

  async getPaymentHistory() {
    const { data } = await api.get('/saas/subscription/history');
    return data;
  },

  // ─── Referral ──────────────────────────────────────────────────
  async getReferralCode() {
    const { data } = await api.get('/saas/referral/code');
    return data;
  },

  async applyReferralCode(referralCode) {
    const { data } = await api.post('/saas/referral/apply', { referralCode });
    return data;
  },

  async getReferralStats() {
    const { data } = await api.get('/saas/referral/stats');
    return data;
  },

  // ─── Notifications ─────────────────────────────────────────────
  async getNotifications(params = {}) {
    const { data } = await api.get('/saas/notifications', { params });
    return data;
  },

  async getUnreadCount() {
    const { data } = await api.get('/saas/notifications/unread-count');
    return data;
  },

  async markNotificationRead(notificationId) {
    const { data } = await api.put(`/saas/notifications/${notificationId}/read`);
    return data;
  },

  async markAllNotificationsRead() {
    const { data } = await api.put('/saas/notifications/read-all');
    return data;
  },
};
