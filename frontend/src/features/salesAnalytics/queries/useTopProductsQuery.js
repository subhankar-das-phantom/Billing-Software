import { useQuery } from '@tanstack/react-query';
import { salesAnalyticsApi } from '../api/salesAnalyticsApi';

export const useTopProductsQuery = (params) => {
  return useQuery({
    queryKey: ['sales-analytics', 'top-products', params],
    queryFn: () => salesAnalyticsApi.getTopProducts(params),
  });
};
