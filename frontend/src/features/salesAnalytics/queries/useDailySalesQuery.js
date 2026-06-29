import { useQuery } from '@tanstack/react-query';
import { salesAnalyticsApi } from '../api/salesAnalyticsApi';

export const useDailySalesQuery = (params) => {
  return useQuery({
    queryKey: ['sales-analytics', 'daily', params],
    queryFn: () => salesAnalyticsApi.getDailySales(params),
  });
};
