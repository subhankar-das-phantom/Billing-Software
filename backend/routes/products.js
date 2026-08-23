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
  getLowStock,
  getStockHistory
} = require('../controllers/productController');
const { exportProducts } = require('../controllers/product/productExportController');
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
router.get('/export', exportProducts);

router.route('/')
  .get(getProducts)
  .post(checkWriteAccess, createProductValidator, createProduct);

router.get('/:id/stock-history', mongoIdParam, getStockHistory);

router.route('/:id')
  .get(mongoIdParam, getProduct)
  .put(checkWriteAccess, updateProductValidator, updateProduct)
  .delete(checkWriteAccess, mongoIdParam, deleteProduct);

router.put('/:id/stock', checkWriteAccess, adjustStockValidator, adjustStock);

module.exports = router;
