const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
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

// Apply protection to all routes
router.use(protect);

router.get('/stock/low', getLowStock);

router.route('/')
  .get(getProducts)
  .post(createProductValidator, createProduct);

router.route('/:id')
  .get(mongoIdParam, getProduct)
  .put(updateProductValidator, updateProduct)
  .delete(mongoIdParam, deleteProduct);

router.put('/:id/stock', adjustStockValidator, adjustStock);

module.exports = router;
