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
const { protect, requirePermission } = require('../middleware/auth');
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

router.get('/stats', requirePermission('products', 'view'), getProductStats);
router.get('/stock/low', requirePermission('inventory', 'view'), getLowStock);
router.get('/export', requirePermission('reports', 'view'), exportProducts);

router.route('/')
  .get(requirePermission('products', 'view'), getProducts)
  .post(checkWriteAccess, requirePermission('products', 'create'), createProductValidator, createProduct);

router.get('/:id/stock-history', requirePermission('inventory', 'view'), mongoIdParam, getStockHistory);

router.route('/:id')
  .get(requirePermission('products', 'view'), mongoIdParam, getProduct)
  .put(checkWriteAccess, requirePermission('products', 'edit'), updateProductValidator, updateProduct)
  .delete(checkWriteAccess, requirePermission('products', 'delete'), mongoIdParam, deleteProduct);

router.put('/:id/stock', checkWriteAccess, requirePermission('inventory', 'create'), adjustStockValidator, adjustStock);

module.exports = router;
