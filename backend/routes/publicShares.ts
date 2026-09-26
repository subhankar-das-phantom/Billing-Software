import express from 'express';
import { publicShareController } from '../controllers/publicShareController';

const router = express.Router();
const rateLimit = require('express-rate-limit');

// Configurable rate limit for public resource shares (protection against brute force/scraping)
const windowMs = Number(process.env.PUBLIC_SHARE_RATE_LIMIT_WINDOW_MS) || (15 * 60 * 1000);
const max = Number(process.env.PUBLIC_SHARE_RATE_LIMIT_MAX) || 100;

const publicShareLimiter = rateLimit({
  windowMs,
  max,
  message: {
    success: false,
    message: 'Too many requests for shared document, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(publicShareLimiter);

// Public JSON invoice representation
router.get('/:token', publicShareController.getPublicShare);

// Public PDF stream
router.get('/:token/pdf', publicShareController.getPublicSharePDF);

export default router;
module.exports = router;
