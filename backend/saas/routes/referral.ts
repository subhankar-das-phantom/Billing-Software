import express from 'express';
import { getReferralCode, applyCode, getStats } from '../controllers/referralController';

const { protect } = require('../../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/code', getReferralCode);
router.post('/apply', applyCode);
router.get('/stats', getStats);

export default router;
