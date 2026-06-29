import { useQuery } from '@tanstack/react-query';
import { salesAnalyticsApi } from '../api/salesAnalyticsApi';

export const useOverviewQuery = (params) => {
  return useQuery({
    queryKey: ['sales-analytics', 'overview', params],
    queryFn: () => salesAnalyticsApi.getOverview(params),
  });
};
