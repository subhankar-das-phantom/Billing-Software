import api from './api';

const API_URL = '/analytics/inventory';

export const inventoryAnalyticsService = {
  getBatchExpiryIntelligence: async () => {
    const response = await api.get(`${API_URL}/expiry-horizon`);
    return response.data;
  },

  getProductVelocity: async (params = {}) => {
    const response = await api.get(`${API_URL}/velocity`, { params });
    return response.data;
  },

  getStockRiskIndicators: async () => {
    const response = await api.get(`${API_URL}/stock-risk`);
    return response.data;
  },

  getSupplierProcurementActivity: async (params = {}) => {
    const response = await api.get(`${API_URL}/procurement`, { params });
    return response.data;
  }
};
