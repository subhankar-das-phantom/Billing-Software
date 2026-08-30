import api, { clearCache } from '../api';

export const supplierService = {
  getSuppliers: async (params = {}, options = {}) => {
    try {
      const response = await api.get('/suppliers', { params, ...options });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getSupplier: async (id) => {
    try {
      const response = await api.get(`/suppliers/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  createSupplier: async (data) => {
    try {
      const response = await api.post('/suppliers', data);
      clearCache();
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateSupplier: async (id, data) => {
    try {
      const response = await api.put(`/suppliers/${id}`, data);
      clearCache();
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteSupplier: async (id) => {
    try {
      const response = await api.delete(`/suppliers/${id}`);
      clearCache();
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
