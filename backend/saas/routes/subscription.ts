import express from 'express';
import {
  getSubscription,
  checkout,
  verifyPayment,
  getHistory,
} from '../controllers/subscriptionController';

const { protect } = require('../../middleware/auth');

const router = express.Router();

// All subscription routes require auth
router.use(protect);

router.get('/', getSubscription);
router.post('/checkout', checkout);
router.post('/verify', verifyPayment);
router.get('/history', getHistory);

export default router;
