import axios from 'axios';

const API_URL = '/api/analytics/inventory';

export const inventoryAnalyticsService = {
  getBatchExpiryIntelligence: async () => {
    const response = await axios.get(`${API_URL}/expiry-horizon`, { withCredentials: true });
    return response.data;
  },

  getProductVelocity: async (params = {}) => {
    const response = await axios.get(`${API_URL}/velocity`, { params, withCredentials: true });
    return response.data;
  },

  getStockRiskIndicators: async () => {
    const response = await axios.get(`${API_URL}/stock-risk`, { withCredentials: true });
    return response.data;
  },

  getSupplierProcurementActivity: async (params = {}) => {
    const response = await axios.get(`${API_URL}/procurement`, { params, withCredentials: true });
    return response.data;
  }
};
