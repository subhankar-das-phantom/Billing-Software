import { useQuery } from '@tanstack/react-query';
import { salesAnalyticsApi } from '../api/salesAnalyticsApi';

export const usePaymentTrendsQuery = (params) => {
  return useQuery({
    queryKey: ['sales-analytics', 'payment-trends', params],
    queryFn: () => salesAnalyticsApi.getPaymentTrends(params),
  });
};
