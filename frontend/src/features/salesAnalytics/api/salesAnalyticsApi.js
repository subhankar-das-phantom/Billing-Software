import api from '../../../services/api';

const BASE_URL = '/sales-analytics';

const cleanParams = (params) => {
  if (!params) return params;
  const cleaned = { ...params };
  if (!cleaned.startDate) delete cleaned.startDate;
  if (!cleaned.endDate) delete cleaned.endDate;
  return cleaned;
};

export const salesAnalyticsApi = {
  getOverview: async (params) => {
    const response = await api.get(`${BASE_URL}/overview`, { params: cleanParams(params) });
    return response.data;
  },

  getMonthlySales: async (params) => {
    const response = await api.get(`${BASE_URL}/monthly`, { params: cleanParams(params) });
    return response.data;
  },

  getDailySales: async (params) => {
    const response = await api.get(`${BASE_URL}/daily`, { params: cleanParams(params) });
    return response.data;
  },

  getYearlySales: async () => {
    const response = await api.get(`${BASE_URL}/yearly`);
    return response.data;
  },

  getTopProducts: async (params) => {
    const response = await api.get(`${BASE_URL}/top-products`, { params: cleanParams(params) });
    return response.data;
  },

  getTopCustomers: async (params) => {
    const response = await api.get(`${BASE_URL}/top-customers`, { params: cleanParams(params) });
    return response.data;
  },

  getPaymentTrends: async (params) => {
    const response = await api.get(`${BASE_URL}/payment-trends`, { params: cleanParams(params) });
    return response.data;
  }
};
