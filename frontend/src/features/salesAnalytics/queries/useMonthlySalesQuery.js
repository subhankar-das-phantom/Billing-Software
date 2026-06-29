import { useQuery } from '@tanstack/react-query';
import { salesAnalyticsApi } from '../api/salesAnalyticsApi';

export const useMonthlySalesQuery = (year) => {
  return useQuery({
    queryKey: ['sales-analytics', 'monthly', year],
    queryFn: () => salesAnalyticsApi.getMonthlySales({ year }),
  });
};
