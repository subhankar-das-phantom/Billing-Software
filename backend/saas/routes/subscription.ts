import express from 'express';
import {
  getSubscription,
  checkout,
  verifyPayment,
  getHistory,
} from '../controllers/subscriptionController';

const { protect, adminOnly } = require('../../middleware/auth');

const router = express.Router();

// All subscription routes require auth
router.use(protect);

router.get('/', getSubscription);
router.post('/checkout', adminOnly, checkout);
router.post('/verify', adminOnly, verifyPayment);
router.get('/history', adminOnly, getHistory);

export default router;
