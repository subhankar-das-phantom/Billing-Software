import { useQuery } from '@tanstack/react-query';
import { salesAnalyticsApi } from '../api/salesAnalyticsApi';

export const useTopCustomersQuery = (params) => {
  return useQuery({
    queryKey: ['sales-analytics', 'top-customers', params],
    queryFn: () => salesAnalyticsApi.getTopCustomers(params),
  });
};
