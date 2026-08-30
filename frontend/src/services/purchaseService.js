import api from './api';

const API_URL = '/purchases';

const getPurchases = async (params = {}) => {
  const response = await api.get(API_URL, { params });
  return response.data;
};

const getPurchase = async (id) => {
  const response = await api.get(`${API_URL}/${id}`);
  return response.data;
};

const createPurchase = async (purchaseData) => {
  const response = await api.post(API_URL, purchaseData);
  return response.data;
};

const updatePurchase = async (id, purchaseData) => {
  const response = await api.put(`${API_URL}/${id}`, purchaseData);
  return response.data;
};

const deletePurchase = async (id) => {
  const response = await api.delete(`${API_URL}/${id}`);
  return response.data;
};

const cancelPurchase = async (id) => {
  const response = await api.post(`${API_URL}/${id}/cancel`);
  return response.data;
};

const purchaseService = {
  getPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  cancelPurchase
};

export default purchaseService;
