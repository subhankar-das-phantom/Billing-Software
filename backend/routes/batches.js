const express = require('express');
const router = express.Router();
const {
  getBatchesByProduct,
  createBatch,
  updateBatch,
  adjustBatchStock,
  deleteBatch
} = require('../controllers/batchController');
const { protect } = require('../middleware/auth');
const { mongoIdParam } = require('../middleware/validators');

// Apply protection to all routes
router.use(protect);

// Get batches for a product
router.get('/product/:productId', getBatchesByProduct);

// CRUD
router.post('/', createBatch);

router.route('/:id')
  .put(mongoIdParam, updateBatch)
  .delete(mongoIdParam, deleteBatch);

// Stock adjustment
router.put('/:id/stock', mongoIdParam, adjustBatchStock);

module.exports = router;
