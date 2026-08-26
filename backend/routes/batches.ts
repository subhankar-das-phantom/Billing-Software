import express from 'express';
import {
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  adjustBatchStock
} from '../controllers/batchController';
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getBatches)
  .post(protect, createBatch);

router.route('/:id')
  .put(protect, updateBatch)
  .delete(protect, deleteBatch);

router.route('/:id/adjust')
  .post(protect, adjustBatchStock);

export default router;
module.exports = router;
