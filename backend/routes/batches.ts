import express from 'express';
import {
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  adjustBatchStock
} from '../controllers/batchController';
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(requirePermission('batches', 'view'), getBatches)
  .post(requirePermission('batches', 'create'), createBatch);

router.route('/:id')
  .put(requirePermission('batches', 'edit'), updateBatch)
  .delete(requirePermission('batches', 'delete'), deleteBatch);

router.route('/:id/adjust')
  .post(requirePermission('batches', 'edit'), adjustBatchStock);

export default router;
module.exports = router;
