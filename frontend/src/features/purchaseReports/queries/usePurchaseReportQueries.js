import { useQuery } from '@tanstack/react-query';
import { purchaseReportService } from '../../../services/reports/purchaseReportService';

const STALE_TIME = 60 * 1000; // 1 minute fresh window

export const usePurchaseSummaryQuery = (params = {}) => {
  return useQuery({
    queryKey: ['reports', 'purchases', 'summary', params],
    queryFn: () => purchaseReportService.getPurchaseSummary(params),
    staleTime: STALE_TIME,
  });
};

export const useSupplierWisePurchasesQuery = (params = {}) => {
  return useQuery({
    queryKey: ['reports', 'purchases', 'supplier-wise', params],
    queryFn: () => purchaseReportService.getSupplierWisePurchases(params),
    staleTime: STALE_TIME,
  });
};

export const useProductWisePurchasesQuery = (params = {}) => {
  return useQuery({
    queryKey: ['reports', 'purchases', 'product-wise', params],
    queryFn: () => purchaseReportService.getProductWisePurchases(params),
    staleTime: STALE_TIME,
  });
};
