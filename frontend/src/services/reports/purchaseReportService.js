import axios from 'axios';

const API_URL = '/api/reports/purchases';

const getPurchaseSummary = async (params = {}) => {
  const response = await axios.get(`${API_URL}/summary`, { params, withCredentials: true });
  return response.data;
};

const getSupplierWisePurchases = async (params = {}) => {
  const response = await axios.get(`${API_URL}/supplier-wise`, { params, withCredentials: true });
  return response.data;
};

const getProductWisePurchases = async (params = {}) => {
  const response = await axios.get(`${API_URL}/product-wise`, { params, withCredentials: true });
  return response.data;
};

const getInventoryFlowSummary = async (params = {}) => {
  const response = await axios.get(`${API_URL}/inventory-flow`, { params, withCredentials: true });
  return response.data;
};

export const purchaseReportService = {
  getPurchaseSummary,
  getSupplierWisePurchases,
  getProductWisePurchases,
  getInventoryFlowSummary
};
