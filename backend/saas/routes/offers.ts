/**
 * Bharat Enterprise Billing System — SaaS Tenant Offers Routes
 * Protected endpoints for tenant active promotional offers, coupons, and announcements.
 */

import express from 'express';
import { getActiveOffers, validatePromoCode } from '../controllers/offerController';

const { protect } = require('../../middleware/auth');

const router = express.Router();

// Require tenant authentication for all offer endpoints
router.use(protect);

router.get('/active', getActiveOffers);
router.get('/', getActiveOffers);
router.post('/validate', validatePromoCode);
router.post('/validate-promo', validatePromoCode);

export default router;
