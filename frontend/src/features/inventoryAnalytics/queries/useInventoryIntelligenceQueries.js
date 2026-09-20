import { useQuery } from '@tanstack/react-query';
import { inventoryAnalyticsService } from '../../../services/inventoryAnalyticsService';

const STALE_TIME = 60 * 1000; // 1 minute fresh window

export const useBatchExpiryQuery = () => {
  return useQuery({
    queryKey: ['inventory-analytics', 'batch-expiry'],
    queryFn: () => inventoryAnalyticsService.getBatchExpiryIntelligence(),
    staleTime: STALE_TIME,
  });
};

export const useProductVelocityQuery = (params = {}) => {
  return useQuery({
    queryKey: ['inventory-analytics', 'product-velocity', params],
    queryFn: () => inventoryAnalyticsService.getProductVelocity(params),
    staleTime: STALE_TIME,
  });
};

export const useStockRiskQuery = () => {
  return useQuery({
    queryKey: ['inventory-analytics', 'stock-risk'],
    queryFn: () => inventoryAnalyticsService.getStockRiskIndicators(),
    staleTime: STALE_TIME,
  });
};

export const useSupplierProcurementQuery = (params = {}) => {
  return useQuery({
    queryKey: ['inventory-analytics', 'procurement', params],
    queryFn: () => inventoryAnalyticsService.getSupplierProcurementActivity(params),
    staleTime: STALE_TIME,
  });
};
