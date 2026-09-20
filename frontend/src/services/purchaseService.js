import api, { clearCache } from './api';
import { queryClient } from '../lib/queryClient';
import { invalidateCachePattern } from '../hooks/useSWR';

const API_URL = '/purchases';

const invalidatePurchaseCaches = () => {
  clearCache();
  invalidateCachePattern('purchases');
  invalidateCachePattern('inventory-ledger');
  invalidateCachePattern('dashboard');
  queryClient.invalidateQueries({ queryKey: ['reports', 'purchases'] });
  queryClient.invalidateQueries({ queryKey: ['inventory-analytics'] });
};

const getPurchases = async (params = {}) => {
  const response = await api.get(API_URL, { params });
  return response.data;
};

const getPurchaseStats = async (params = {}) => {
  const response = await api.get(`${API_URL}/stats`, { params });
  return response.data;
};

const exportPurchases = async (params = {}) => {
  const response = await api.get(`${API_URL}/export`, {
    params,
    responseType: 'blob'
  });
  return response.data;
};

const getPurchase = async (id) => {
  const response = await api.get(`${API_URL}/${id}`);
  return response.data;
};

const createPurchase = async (purchaseData) => {
  const response = await api.post(API_URL, purchaseData);
  invalidatePurchaseCaches();
  return response.data;
};

const updatePurchase = async (id, purchaseData) => {
  const response = await api.put(`${API_URL}/${id}`, purchaseData);
  invalidatePurchaseCaches();
  return response.data;
};

const deletePurchase = async (id) => {
  const response = await api.delete(`${API_URL}/${id}`);
  invalidatePurchaseCaches();
  return response.data;
};

const completePurchase = async (id) => {
  const response = await api.post(`${API_URL}/${id}/complete`);
  invalidatePurchaseCaches();
  return response.data;
};

const cancelPurchase = async (id) => {
  const response = await api.post(`${API_URL}/${id}/cancel`);
  invalidatePurchaseCaches();
  return response.data;
};

const purchaseService = {
  getPurchases,
  getPurchaseStats,
  exportPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  completePurchase,
  cancelPurchase
};

export default purchaseService;
