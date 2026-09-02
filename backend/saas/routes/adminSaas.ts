import express from 'express';
import {
  listTenants,
  listSubscriptions,
  createAdjustment,
  listPayments,
  listCampaigns,
  createCampaign,
  updateCampaign,
  listPricingRules,
  upsertPricingRule,
  getSettings,
  updateSetting,
  triggerExpiryCron,
} from '../controllers/adminSaasController';

const { protect, adminOnly } = require('../../middleware/auth');

const router = express.Router();

// All admin SaaS routes require admin auth
// TODO: Add isSuperAdmin check when the flag is implemented
router.use(protect, adminOnly);

// Tenants
router.get('/tenants', listTenants);

// Subscriptions
router.get('/subscriptions', listSubscriptions);

// Adjustments
router.post('/adjustments', createAdjustment);

// Payments
router.get('/payments', listPayments);

// Referral Campaigns
router.get('/campaigns', listCampaigns);
router.post('/campaigns', createCampaign);
router.put('/campaigns/:id', updateCampaign);

// Pricing Rules
router.get('/pricing-rules', listPricingRules);
router.post('/pricing-rules', upsertPricingRule);

// System Settings
router.get('/settings', getSettings);
router.put('/settings', updateSetting);

// Cron trigger
router.post('/process-expired', triggerExpiryCron);

export default router;
