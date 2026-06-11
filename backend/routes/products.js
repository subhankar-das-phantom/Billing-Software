const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  getProductStats,
  createProduct,
  updateProduct,
  adjustStock,
  deleteProduct,
  getLowStock
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { 
  createProductValidator, 
  updateProductValidator, 
  adjustStockValidator,
  mongoIdParam 
} = require('../middleware/validators');
const { checkSubscription, checkFeatureAccess, checkWriteAccess } = require('../saas/middleware');
const { Feature } = require('../saas/shared/features');

// Apply protection and subscription check to all routes
router.use(protect);
router.use(checkSubscription);
router.use(checkFeatureAccess(Feature.PRODUCTS));

router.get('/stats', getProductStats);
router.get('/stock/low', getLowStock);

router.route('/')
  .get(getProducts)
  .post(checkWriteAccess, createProductValidator, createProduct);

router.route('/:id')
  .get(mongoIdParam, getProduct)
  .put(checkWriteAccess, updateProductValidator, updateProduct)
  .delete(checkWriteAccess, mongoIdParam, deleteProduct);

router.put('/:id/stock', checkWriteAccess, adjustStockValidator, adjustStock);

module.exports = router;
