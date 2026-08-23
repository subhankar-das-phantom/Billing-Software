import { Router } from 'express';
import { SalesAnalyticsController } from '../controllers/salesAnalyticsController';
import { validateDateRange, validateLimit, validateYear } from '../validators/salesAnalyticsValidators';
const { protect, adminOnly } = require('../../../../middleware/auth');
const { checkSubscription, checkFeatureAccess } = require('../../../../saas/middleware');
import { Feature } from '../../../../saas/shared/features';

const router = Router();

// Apply auth and subscription middleware to all routes
router.use(protect);
router.use(adminOnly);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.REPORTS));

router.get('/overview', validateDateRange, SalesAnalyticsController.getOverview as any);
router.get('/monthly', validateYear, SalesAnalyticsController.getMonthlySales as any);
router.get('/daily', validateDateRange, SalesAnalyticsController.getDailySales as any);
router.get('/yearly', SalesAnalyticsController.getYearlySales as any);
router.get('/top-products', validateDateRange, validateLimit, SalesAnalyticsController.getTopProducts as any);
router.get('/top-customers', validateDateRange, validateLimit, SalesAnalyticsController.getTopCustomers as any);
router.get('/payment-trends', validateDateRange, SalesAnalyticsController.getPaymentTrends as any);

// CommonJS export to work seamlessly with server.js requiring it
module.exports = router;
