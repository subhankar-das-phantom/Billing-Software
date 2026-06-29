import { useQuery } from '@tanstack/react-query';
import { salesAnalyticsApi } from '../api/salesAnalyticsApi';

export const useYearlySalesQuery = () => {
  return useQuery({
    queryKey: ['sales-analytics', 'yearly'],
    queryFn: () => salesAnalyticsApi.getYearlySales(),
  });
};
