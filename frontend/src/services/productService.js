import api, { cachedRequest, clearCache } from './api';

/**
 * Product Service
 * Handles all product-related API calls
 */
export const productService = {
  /**
   * Get list of products with optional filters
   * @param {object} params - Query parameters (search, page, limit, category, inStock)
   * @returns {Promise<{products: array, total: number, pages: number}>}
   */
  getProducts: async (params = {}) => {
    try {
      const response = await api.get('/products', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get product by ID with caching
   * @param {string} id - Product ID
   * @param {boolean} useCache - Use cached data if available
   * @returns {Promise<{product: object}>}
   */
  getProduct: async (id, useCache = true) => {
    try {
      if (useCache) {
        const { data } = await cachedRequest({
          method: 'GET',
          url: `/products/${id}`
        }, 2 * 60 * 1000); // 2 minute cache
        return data;
      }
      
      const response = await api.get(`/products/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create new product
   * @param {object} data - Product data
   * @returns {Promise<{success: boolean, product: object, message: string}>}
   */
  createProduct: async (data) => {
    try {
      // Validate before sending
      // Client-side validation removed to allow flexible formats
      // const validationErrors = productUtils.validateProductData(data);
      // if (validationErrors.length > 0) {
      //   throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      // }

      // Sanitization bypassed - was stripping HSN code
      // const sanitizedData = productUtils.sanitizeProductData(data);
      
      const response = await api.post('/products', data);
      
      // Clear cache after creation
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update existing product
   * @param {string} id - Product ID
   * @param {object} data - Updated product data
   * @returns {Promise<{success: boolean, product: object, message: string}>}
   */
  updateProduct: async (id, data) => {
    try {
      // Validate before sending
      // Client-side validation removed
      // const validationErrors = productUtils.validateProductData(data, false);
      // if (validationErrors.length > 0) {
      //   throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      // }

      // Sanitization bypassed
      // const sanitizedData = productUtils.sanitizeProductData(data);
      
      const response = await api.put(`/products/${id}`, data);
      
      // Clear cache after update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete product
   * @param {string} id - Product ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  deleteProduct: async (id) => {
    try {
      const response = await api.delete(`/products/${id}`);
      
      // Clear cache after deletion
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get low stock products
   * @param {number} threshold - Stock threshold (default: 10)
   * @param {object} params - Additional parameters
   * @returns {Promise<{products: array, total: number}>}
   */
  getLowStock: async (threshold = 10, params = {}) => {
    try {
      const response = await api.get('/products/stock/low', {
        params: { threshold, ...params }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get out of stock products
   * @param {object} params - Query parameters
   * @returns {Promise<{products: array, total: number}>}
   */
  getOutOfStock: async (params = {}) => {
    try {
      const response = await api.get('/products/stock/out', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get expired products
   * @param {object} params - Query parameters
   * @returns {Promise<{products: array, total: number}>}
   */
  getExpiredProducts: async (params = {}) => {
    try {
      const response = await api.get('/products/expired', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get products expiring soon
   * @param {number} days - Days until expiry (default: 30)
   * @returns {Promise<{products: array, total: number}>}
   */
  getExpiringSoon: async (days = 30) => {
    try {
      const response = await api.get('/products/expiring-soon', {
        params: { days }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Search products by name, HSN, batch number
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise<{products: array, total: number}>}
   */
  searchProducts: async (query, options = {}) => {
    try {
      const response = await api.get('/products/search', {
        params: { q: query, ...options }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update product stock
   * @param {string} id - Product ID
   * @param {object} stockData - Stock update data (quantity, type: 'add'|'subtract'|'set', reason)
   * @returns {Promise<{success: boolean, product: object}>}
   */
  updateStock: async (id, stockData) => {
    try {
      const response = await api.put(`/products/${id}/stock`, stockData);
      
      // Clear cache after stock update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Adjust stock (add or remove)
   * @param {string} id - Product ID
   * @param {object} data - Adjustment data {quantity, type: 'in'|'out', reason}
   * @returns {Promise<{success: boolean, product: object}>}
   */
  adjustStock: async (id, data) => {
    try {
      const response = await api.put(`/products/${id}/stock`, data);
      
      // Clear cache after stock adjustment
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get stock history for a product
   * @param {string} id - Product ID
   * @param {object} params - Query parameters
   * @returns {Promise<{history: array, total: number}>}
   */
  getStockHistory: async (id, params = {}) => {
    try {
      const response = await api.get(`/products/${id}/stock-history`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Add new batch to product
   * @param {string} id - Product ID
   * @param {object} batchData - Batch data
   * @returns {Promise<{success: boolean, product: object}>}
   */
  addBatch: async (id, batchData) => {
    try {
      const response = await api.post(`/products/${id}/batches`, batchData);
      
      // Clear cache after batch addition
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get product batches
   * @param {string} id - Product ID
   * @returns {Promise<{batches: array}>}
   */
  getBatches: async (id) => {
    try {
      const response = await api.get(`/products/${id}/batches`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update product pricing
   * @param {string} id - Product ID
   * @param {object} pricingData - Pricing data (oldMRP, newMRP, effectiveDate)
   * @returns {Promise<{success: boolean, product: object}>}
   */
  updatePricing: async (id, pricingData) => {
    try {
      const response = await api.put(`/products/${id}/pricing`, pricingData);
      
      // Clear cache after pricing update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get pricing history
   * @param {string} id - Product ID
   * @returns {Promise<{history: array}>}
   */
  getPricingHistory: async (id) => {
    try {
      const response = await api.get(`/products/${id}/pricing-history`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get product categories
   * @returns {Promise<{categories: array}>}
   */
  getCategories: async () => {
    try {
      const { data } = await cachedRequest({
        method: 'GET',
        url: '/products/categories'
      }, 5 * 60 * 1000); // 5 minute cache
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get products by category
   * @param {string} category - Category name
   * @param {object} params - Query parameters
   * @returns {Promise<{products: array, total: number}>}
   */
  getProductsByCategory: async (category, params = {}) => {
    try {
      const response = await api.get(`/products/category/${category}`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get manufacturers
   * @returns {Promise<{manufacturers: array}>}
   */
  getManufacturers: async () => {
    try {
      const { data } = await cachedRequest({
        method: 'GET',
        url: '/products/manufacturers'
      }, 5 * 60 * 1000); // 5 minute cache
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get products by manufacturer
   * @param {string} manufacturer - Manufacturer name
   * @param {object} params - Query parameters
   * @returns {Promise<{products: array, total: number}>}
   */
  getProductsByManufacturer: async (manufacturer, params = {}) => {
    try {
      const response = await api.get(`/products/manufacturer/${manufacturer}`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Bulk create products
   * @param {array} products - Array of product data
   * @returns {Promise<{success: boolean, created: number, failed: number, errors: array}>}
   */
  bulkCreateProducts: async (products) => {
    try {
      // Validate all products
      const validProducts = [];
      const errors = [];

      products.forEach((product, index) => {
        const validationErrors = productUtils.validateProductData(product);
        if (validationErrors.length > 0) {
          errors.push({ index, errors: validationErrors });
        } else {
          validProducts.push(productUtils.sanitizeProductData(product));
        }
      });

      const response = await api.post('/products/bulk', { products: validProducts });
      
      // Clear cache after bulk creation
      clearCache();
      
      return {
        ...response.data,
        validationErrors: errors
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Bulk update products
   * @param {array} updates - Array of {id, data} objects
   * @returns {Promise<{success: boolean, updated: number, failed: number}>}
   */
  bulkUpdateProducts: async (updates) => {
    try {
      const response = await api.put('/products/bulk', { updates });
      
      // Clear cache after bulk update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Bulk delete products
   * @param {array} ids - Array of product IDs
   * @returns {Promise<{success: boolean, deleted: number, failed: number}>}
   */
  bulkDeleteProducts: async (ids) => {
    try {
      const response = await api.delete('/products/bulk', { data: { ids } });
      
      // Clear cache after bulk deletion
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Bulk stock adjustment
   * @param {array} adjustments - Array of {productId, quantity, type, reason}
   * @returns {Promise<{success: boolean, adjusted: number, failed: number}>}
   */
  bulkStockAdjustment: async (adjustments) => {
    try {
      const response = await api.post('/products/stock/bulk-adjust', { adjustments });
      
      // Clear cache after bulk adjustment
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Export products to CSV/Excel
   * @param {object} params - Export parameters (format, filters, fields)
   * @returns {Promise<Blob>} - File blob
   */
  exportProducts: async (params = {}) => {
    try {
      const response = await api.get('/products/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Import products from CSV/Excel
   * @param {File} file - CSV/Excel file
   * @returns {Promise<{success: boolean, imported: number, failed: number, errors: array}>}
   */
  importProducts: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/products/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Clear cache after import
      clearCache();

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get product statistics
   * @param {object} params - Date range and filters
   * @returns {Promise<object>} - Product statistics
   */
  getProductStats: async (params = {}) => {
    try {
      const response = await api.get('/products/stats', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get top selling products
   * @param {object} params - Query parameters (limit, startDate, endDate)
   * @returns {Promise<{products: array}>}
   */
  getTopSellingProducts: async (params = {}) => {
    try {
      const response = await api.get('/products/top-selling', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get slow moving products
   * @param {object} params - Query parameters (days, limit)
   * @returns {Promise<{products: array}>}
   */
  getSlowMovingProducts: async (params = {}) => {
    try {
      const response = await api.get('/products/slow-moving', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get product sales analytics
   * @param {string} id - Product ID
   * @param {object} params - Date range
   * @returns {Promise<object>} - Sales analytics
   */
  getProductAnalytics: async (id, params = {}) => {
    try {
      const response = await api.get(`/products/${id}/analytics`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Check for duplicate products
   * @param {object} data - Product data to check
   * @returns {Promise<{duplicates: array, hasDuplicates: boolean}>}
   */
  checkDuplicates: async (data) => {
    try {
      const response = await api.post('/products/check-duplicates', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get inventory valuation
   * @param {object} params - Valuation parameters
   * @returns {Promise<object>} - Inventory valuation data
   */
  getInventoryValuation: async (params = {}) => {
    try {
      const response = await api.get('/products/inventory-valuation', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get stock alerts
   * @returns {Promise<{alerts: array}>}
   */
  getStockAlerts: async () => {
    try {
      const response = await api.get('/products/stock-alerts');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Set reorder level for product
   * @param {string} id - Product ID
   * @param {number} level - Reorder level
   * @returns {Promise<{success: boolean, product: object}>}
   */
  setReorderLevel: async (id, level) => {
    try {
      const response = await api.put(`/products/${id}/reorder-level`, { level });
      
      // Clear cache after update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Generate barcode for product
   * @param {string} id - Product ID
   * @param {object} options - Barcode options (format, size)
   * @returns {Promise<Blob>} - Barcode image blob
   */
  generateBarcode: async (id, options = {}) => {
    try {
      const response = await api.get(`/products/${id}/barcode`, {
        params: options,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Generate product label
   * @param {string} id - Product ID
   * @param {object} options - Label options
   * @returns {Promise<Blob>} - Label PDF blob
   */
  generateLabel: async (id, options = {}) => {
    try {
      const response = await api.get(`/products/${id}/label`, {
        params: options,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

/**
 * Product Validation and Utility Functions
 */
export const productUtils = {
  /**
   * Validate product data
   * @param {object} data - Product data
   * @param {boolean} isNew - Is this a new product
   * @returns {array} - Array of validation errors
   */
  validateProductData: (data, isNew = true) => {
    const errors = [];

    // Required fields validation
    if (isNew || data.productName !== undefined) {
      if (!data.productName || data.productName.trim().length === 0) {
        errors.push('Product name is required');
      } else if (data.productName.length > 200) {
        errors.push('Product name must be less than 200 characters');
      }
    }

    if (isNew || data.hsnCode !== undefined) {
      if (!data.hsnCode) {
        errors.push('HSN code is required');
      } else if (!productUtils.isValidHSN(data.hsnCode)) {
        errors.push('Invalid HSN code format');
      }
    }

    if (isNew || data.batchNo !== undefined) {
      if (!data.batchNo) {
        errors.push('Batch number is required');
      }
    }

    if (isNew || data.newMRP !== undefined) {
      if (!data.newMRP || data.newMRP <= 0) {
        errors.push('Valid MRP is required');
      }
    }

    // Optional fields validation
    if (data.gstPercentage !== undefined) {
      const validGST = [0, 5, 12, 18, 28];
      if (!validGST.includes(Number(data.gstPercentage))) {
        errors.push('Invalid GST percentage (must be 0, 5, 12, 18, or 28)');
      }
    }

    if (data.expiryDate) {
      const expiryDate = new Date(data.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (expiryDate < today) {
        errors.push('Expiry date cannot be in the past');
      }
    }

    if (data.openingStockQty !== undefined) {
      if (data.openingStockQty < 0) {
        errors.push('Opening stock quantity cannot be negative');
      }
    }

    if (data.manufacturer && data.manufacturer.length > 100) {
      errors.push('Manufacturer name must be less than 100 characters');
    }

    return errors;
  },

  /**
   * Sanitize product data
   * @param {object} data - Product data
   * @returns {object} - Sanitized data
   */
  sanitizeProductData: (data) => {
    const sanitized = {};

    if (data.productName) {
      sanitized.productName = data.productName.trim();
    }

    if (data.hsnCode) {
      sanitized.hsnCode = data.hsnCode.trim().replace(/[^0-9]/g, '');
    }

    if (data.manufacturer) {
      sanitized.manufacturer = data.manufacturer.trim();
    }

    if (data.pack) {
      sanitized.pack = data.pack.trim();
    }

    if (data.batchNo) {
      sanitized.batchNo = data.batchNo.trim().toUpperCase();
    }

    if (data.expiryDate) {
      sanitized.expiryDate = data.expiryDate;
    }

    if (data.oldMRP !== undefined) {
      sanitized.oldMRP = parseFloat(data.oldMRP) || 0;
    }

    if (data.newMRP !== undefined) {
      sanitized.newMRP = parseFloat(data.newMRP);
    }

    if (data.gstPercentage !== undefined) {
      sanitized.gstPercentage = parseInt(data.gstPercentage);
    }

    if (data.openingStockQty !== undefined) {
      sanitized.openingStockQty = parseInt(data.openingStockQty) || 0;
    }

    if (data.unit) {
      sanitized.unit = data.unit;
    }

    return sanitized;
  },

  /**
   * Validate HSN code format
   * @param {string} hsn - HSN code
   * @returns {boolean}
   */
  isValidHSN: (hsn) => {
    // HSN can be 4, 6, or 8 digits
    const cleanHSN = hsn.replace(/[^0-9]/g, '');
    return /^[0-9]{4}([0-9]{2})?([0-9]{2})?$/.test(cleanHSN);
  },

  /**
   * Check if product is expired
   * @param {Date|string} expiryDate - Expiry date
   * @returns {boolean}
   */
  isExpired: (expiryDate) => {
    if (!expiryDate) return false;
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return expiry < today;
  },

  /**
   * Check if product is expiring soon
   * @param {Date|string} expiryDate - Expiry date
   * @param {number} days - Days threshold (default: 30)
   * @returns {boolean}
   */
  isExpiringSoon: (expiryDate, days = 30) => {
    if (!expiryDate || productUtils.isExpired(expiryDate)) return false;
    
    const expiry = new Date(expiryDate);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    
    return expiry <= threshold;
  },

  /**
   * Calculate days until expiry
   * @param {Date|string} expiryDate - Expiry date
   * @returns {number} - Days until expiry (negative if expired)
   */
  daysUntilExpiry: (expiryDate) => {
    if (!expiryDate) return null;
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Check if product is low stock
   * @param {number} currentStock - Current stock quantity
   * @param {number} threshold - Low stock threshold (default: 10)
   * @returns {boolean}
   */
  isLowStock: (currentStock, threshold = 10) => {
    return currentStock > 0 && currentStock <= threshold;
  },

  /**
   * Check if product is out of stock
   * @param {number} currentStock - Current stock quantity
   * @returns {boolean}
   */
  isOutOfStock: (currentStock) => {
    return currentStock === 0;
  },

  /**
   * Calculate stock status
   * @param {number} currentStock - Current stock quantity
   * @param {number} reorderLevel - Reorder level
   * @returns {object} - Stock status
   */
  getStockStatus: (currentStock, reorderLevel = 10) => {
    if (currentStock === 0) {
      return {
        status: 'out',
        label: 'Out of Stock',
        color: 'red',
        urgent: true
      };
    } else if (currentStock <= reorderLevel) {
      return {
        status: 'low',
        label: 'Low Stock',
        color: 'yellow',
        urgent: true
      };
    } else if (currentStock <= reorderLevel * 2) {
      return {
        status: 'medium',
        label: 'Medium Stock',
        color: 'blue',
        urgent: false
      };
    }
    return {
      status: 'good',
      label: 'Good Stock',
      color: 'green',
      urgent: false
    };
  },

  /**
   * Calculate selling price excluding GST
   * @param {number} mrp - MRP
   * @param {number} gstPercentage - GST percentage
   * @returns {number} - Price excluding GST
   */
  calculatePriceExcludingGST: (mrp, gstPercentage) => {
    return mrp / (1 + gstPercentage / 100);
  },

  /**
   * Calculate GST amount
   * @param {number} price - Price excluding GST
   * @param {number} gstPercentage - GST percentage
   * @returns {object} - GST breakdown
   */
  calculateGST: (price, gstPercentage) => {
    const gstAmount = (price * gstPercentage) / 100;
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;
    
    return {
      total: parseFloat(gstAmount.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      sgst: parseFloat(sgst.toFixed(2)),
      percentage: gstPercentage
    };
  },

  /**
   * Calculate profit margin
   * @param {number} sellingPrice - Selling price
   * @param {number} costPrice - Cost price
   * @returns {object} - Profit metrics
   */
  calculateProfit: (sellingPrice, costPrice) => {
    const profit = sellingPrice - costPrice;
    const profitPercentage = costPrice > 0 ? (profit / costPrice) * 100 : 0;
    
    return {
      profit: parseFloat(profit.toFixed(2)),
      profitPercentage: parseFloat(profitPercentage.toFixed(2)),
      margin: costPrice > 0 ? (profit / sellingPrice) * 100 : 0
    };
  },

  /**
   * Format product code/SKU
   * @param {object} product - Product data
   * @returns {string} - Formatted SKU
   */
  generateSKU: (product) => {
    const parts = [];
    
    if (product.manufacturer) {
      parts.push(product.manufacturer.substring(0, 3).toUpperCase());
    }
    
    if (product.hsnCode) {
      parts.push(product.hsnCode.substring(0, 4));
    }
    
    if (product.batchNo) {
      parts.push(product.batchNo.substring(0, 4).toUpperCase());
    }
    
    return parts.join('-');
  },

  /**
   * Parse CSV file for import
   * @param {File} file - CSV file
   * @returns {Promise<array>} - Array of product objects
   */
  parseCSV: async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          const products = [];
          
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(',').map(v => v.trim());
            const product = {};
            
            headers.forEach((header, index) => {
              product[header] = values[index] || '';
            });
            
            products.push(product);
          }
          
          resolve(products);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  },

  /**
   * Generate CSV from products
   * @param {array} products - Array of products
   * @returns {string} - CSV content
   */
  generateCSV: (products) => {
    if (products.length === 0) return '';

    const headers = [
      'productName', 'hsnCode', 'manufacturer', 'pack', 
      'batchNo', 'expiryDate', 'oldMRP', 'newMRP', 
      'gstPercentage', 'currentStockQty', 'unit'
    ];
    const csvHeaders = headers.join(',');
    
    const csvRows = products.map(product => {
      return headers.map(header => {
        const value = product[header] || '';
        // Escape commas and quotes
        return `"${value.toString().replace(/"/g, '""')}"`;
      }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
  },

  /**
   * Download CSV file
   * @param {string} csvContent - CSV content
   * @param {string} filename - Filename
   */
  downloadCSV: (csvContent, filename = 'products.csv') => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  },

  /**
   * Group products by category/manufacturer
   * @param {array} products - Array of products
   * @param {string} criteria - Grouping criteria (category, manufacturer, gst)
   * @returns {object} - Grouped products
   */
  groupProducts: (products, criteria) => {
    const groups = {};
    
    products.forEach(product => {
      let key;
      
      switch (criteria) {
        case 'category':
          key = product.category || 'Uncategorized';
          break;
        case 'manufacturer':
          key = product.manufacturer || 'Unknown';
          break;
        case 'gst':
          key = `${product.gstPercentage || 0}%`;
          break;
        case 'stockStatus':
          const status = productUtils.getStockStatus(product.currentStockQty);
          key = status.label;
          break;
        case 'expiryStatus':
          if (productUtils.isExpired(product.expiryDate)) {
            key = 'Expired';
          } else if (productUtils.isExpiringSoon(product.expiryDate)) {
            key = 'Expiring Soon';
          } else {
            key = 'Valid';
          }
          break;
        default:
          key = 'Other';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(product);
    });
    
    return groups;
  },

  /**
   * Sort products by field
   * @param {array} products - Array of products
   * @param {string} field - Field to sort by
   * @param {string} order - Sort order (asc, desc)
   * @returns {array} - Sorted products
   */
  sortProducts: (products, field, order = 'asc') => {
    return [...products].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // Handle dates
      if (field === 'expiryDate') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal === bVal) return 0;
      const comparison = aVal > bVal ? 1 : -1;
      return order === 'asc' ? comparison : -comparison;
    });
  },

  /**
   * Filter products by criteria
   * @param {array} products - Array of products
   * @param {object} filters - Filter criteria
   * @returns {array} - Filtered products
   */
  filterProducts: (products, filters) => {
    return products.filter(product => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const searchable = [
          product.productName,
          product.hsnCode,
          product.manufacturer,
          product.batchNo
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchable.includes(search)) return false;
      }

      // Stock status filter
      if (filters.stockStatus) {
        const status = productUtils.getStockStatus(product.currentStockQty);
        if (status.status !== filters.stockStatus) return false;
      }

      // Expiry status filter
      if (filters.expiryStatus === 'expired') {
        if (!productUtils.isExpired(product.expiryDate)) return false;
      } else if (filters.expiryStatus === 'expiring') {
        if (!productUtils.isExpiringSoon(product.expiryDate)) return false;
      }

      // GST filter
      if (filters.gstPercentage !== undefined) {
        if (product.gstPercentage !== filters.gstPercentage) return false;
      }

      // Manufacturer filter
      if (filters.manufacturer) {
        if (product.manufacturer !== filters.manufacturer) return false;
      }

      // Price range filter
      if (filters.minPrice !== undefined) {
        if (product.newMRP < filters.minPrice) return false;
      }

      if (filters.maxPrice !== undefined) {
        if (product.newMRP > filters.maxPrice) return false;
      }

      return true;
    });
  },

  /**
   * Calculate inventory turnover ratio
   * @param {number} costOfGoodsSold - COGS for period
   * @param {number} averageInventory - Average inventory value
   * @returns {number} - Turnover ratio
   */
  calculateInventoryTurnover: (costOfGoodsSold, averageInventory) => {
    if (averageInventory === 0) return 0;
    return parseFloat((costOfGoodsSold / averageInventory).toFixed(2));
  },

  /**
   * Calculate days inventory outstanding
   * @param {number} averageInventory - Average inventory value
   * @param {number} costOfGoodsSold - COGS for period
   * @param {number} days - Number of days in period (default: 365)
   * @returns {number} - Days inventory outstanding
   */
  calculateDIO: (averageInventory, costOfGoodsSold, days = 365) => {
    if (costOfGoodsSold === 0) return 0;
    return parseFloat(((averageInventory / costOfGoodsSold) * days).toFixed(2));
  }
};

/**
 * Product Analytics
 */
export const productAnalytics = {
  /**
   * Calculate total inventory value
   * @param {array} products - Array of products
   * @returns {number} - Total inventory value
   */
  calculateInventoryValue: (products) => {
    return products.reduce((total, product) => {
      const value = (product.newMRP || 0) * (product.currentStockQty || 0);
      return total + value;
    }, 0);
  },

  /**
   * Get stock distribution
   * @param {array} products - Array of products
   * @returns {object} - Stock distribution
   */
  getStockDistribution: (products) => {
    const distribution = {
      outOfStock: 0,
      lowStock: 0,
      mediumStock: 0,
      goodStock: 0
    };

    products.forEach(product => {
      const status = productUtils.getStockStatus(product.currentStockQty);
      
      switch (status.status) {
        case 'out':
          distribution.outOfStock++;
          break;
        case 'low':
          distribution.lowStock++;
          break;
        case 'medium':
          distribution.mediumStock++;
          break;
        case 'good':
          distribution.goodStock++;
          break;
      }
    });

    return distribution;
  },

  /**
   * Get expiry distribution
   * @param {array} products - Array of products
   * @returns {object} - Expiry distribution
   */
  getExpiryDistribution: (products) => {
    const distribution = {
      expired: 0,
      expiringSoon: 0,
      valid: 0,
      noExpiry: 0
    };

    products.forEach(product => {
      if (!product.expiryDate) {
        distribution.noExpiry++;
      } else if (productUtils.isExpired(product.expiryDate)) {
        distribution.expired++;
      } else if (productUtils.isExpiringSoon(product.expiryDate)) {
        distribution.expiringSoon++;
      } else {
        distribution.valid++;
      }
    });

    return distribution;
  },

  /**
   * Get GST distribution
   * @param {array} products - Array of products
   * @returns {object} - GST distribution
   */
  getGSTDistribution: (products) => {
    const distribution = {};

    products.forEach(product => {
      const gst = product.gstPercentage || 0;
      if (!distribution[gst]) {
        distribution[gst] = { count: 0, value: 0 };
      }
      distribution[gst].count++;
      distribution[gst].value += (product.newMRP || 0) * (product.currentStockQty || 0);
    });

    return distribution;
  },

  /**
   * Calculate ABC analysis
   * @param {array} products - Array of products with sales data
   * @returns {object} - ABC classification
   */
  performABCAnalysis: (products) => {
    // Sort by revenue (price * quantity sold)
    const sorted = [...products].sort((a, b) => {
      const aRev = (a.salesRevenue || 0);
      const bRev = (b.salesRevenue || 0);
      return bRev - aRev;
    });

    const totalRevenue = sorted.reduce((sum, p) => sum + (p.salesRevenue || 0), 0);
    
    let cumulativeRevenue = 0;
    const classification = { A: [], B: [], C: [] };

    sorted.forEach(product => {
      const revenue = product.salesRevenue || 0;
      cumulativeRevenue += revenue;
      const percentage = (cumulativeRevenue / totalRevenue) * 100;

      if (percentage <= 80) {
        classification.A.push(product);
      } else if (percentage <= 95) {
        classification.B.push(product);
      } else {
        classification.C.push(product);
      }
    });

    return classification;
  }
};

export default productService;
