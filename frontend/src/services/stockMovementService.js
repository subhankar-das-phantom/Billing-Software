import api from './api';

const API_URL = '/stock-movements';

const getStockMovements = async (params = {}) => {
  const response = await api.get(API_URL, {
    params
  });
  return response.data;
};

const stockMovementService = {
  getStockMovements
};

export default stockMovementService;
