import express from 'express';
import { getPlans, getPlan } from '../controllers/planController';

const router = express.Router();

// Public routes — pricing page
router.get('/', getPlans);
router.get('/:id', getPlan);

// Mutating plan administration routes permanently retired to /api/platform/plans
router.post('/', (_req, res) =>
  res.status(410).json({
    success: false,
    message: 'Plan administration permanently moved to /api/platform/plans',
  }),
);
router.put('/:id', (_req, res) =>
  res.status(410).json({
    success: false,
    message: 'Plan administration permanently moved to /api/platform/plans',
  }),
);

export default router;
