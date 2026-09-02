import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '../../../services/saas/subscriptionService';

export const useSubscriptionPlansQuery = () => {
  return useQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: async () => {
      const res = await subscriptionService.getPlans();
      if (!res.success) {
        throw new Error(res.message || 'Failed to fetch subscription plans');
      }
      return res.plans;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - plans rarely change
    gcTime: 1000 * 60 * 60 * 24,
    retry: 2,
  });
};
