import api from './api';

/**
 * Report Service
 * Handles GST report API calls
 */
export const reportService = {
  /**
   * Get GST sales summary report
   * @param {object} params - { startDate, endDate, excludedProductIds }
   * @returns {Promise<object>}
   */
  getGstReport: async ({ startDate, endDate, excludedProductIds = [] }) => {
    try {
      const params = { startDate, endDate };
      if (excludedProductIds.length > 0) {
        params.excludedProductIds = excludedProductIds.join(',');
      }
      const response = await api.get('/reports/gst', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Search products for exclusion list (reuses existing product endpoint)
   * @param {string} query - Search string
   * @returns {Promise<{products: array}>}
   */
  searchProducts: async (query) => {
    try {
      const response = await api.get('/products', {
        params: { search: query, limit: 10 }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
