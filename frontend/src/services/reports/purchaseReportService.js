import api from '../api';

const API_URL = '/reports/purchases';

const getPurchaseSummary = async (params = {}) => {
  const response = await api.get(`${API_URL}/summary`, { params });
  return response.data;
};

const getSupplierWisePurchases = async (params = {}) => {
  const response = await api.get(`${API_URL}/supplier-wise`, { params });
  return response.data;
};

const getProductWisePurchases = async (params = {}) => {
  const response = await api.get(`${API_URL}/product-wise`, { params });
  return response.data;
};

const getPurchaseStatusSummary = async (params = {}) => {
  const response = await api.get(`${API_URL}/status`, { params });
  return response.data;
};

const getInventoryFlowSummary = async (params = {}) => {
  const response = await api.get(`${API_URL}/inventory-flow`, { params });
  return response.data;
};

export const purchaseReportService = {
  getPurchaseSummary,
  getPurchaseStatusSummary,
  getSupplierWisePurchases,
  getProductWisePurchases,
  getInventoryFlowSummary
};
