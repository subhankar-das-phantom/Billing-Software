import express from 'express';
import { getPlans, getPlan, createPlan, updatePlan } from '../controllers/planController';

const { protect, adminOnly } = require('../../middleware/auth');

const router = express.Router();

// Public routes — pricing page
router.get('/', getPlans);
router.get('/:id', getPlan);

// Super-admin routes
router.post('/', protect, adminOnly, createPlan);
router.put('/:id', protect, adminOnly, updatePlan);

export default router;
