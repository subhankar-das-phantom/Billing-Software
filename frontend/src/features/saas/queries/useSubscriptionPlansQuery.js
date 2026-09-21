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
      const plans = Array.isArray(res.plans) ? [...res.plans] : [];
      plans.trialDays = typeof res.trialDays === 'number' ? res.trialDays : 14;
      plans.minStartingPrice =
        typeof res.minStartingPrice === 'number'
          ? res.minStartingPrice
          : plans.length > 0
          ? Math.min(...plans.map((p) => p.baseMonthlyPrice))
          : 299;
      plans.telemetry = res.telemetry || {
        productsCount: 50,
        batchesCount: 112,
        firmName: 'Bharat Healthcare & Distributors',
      };
      return plans;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - plans rarely change
    gcTime: 1000 * 60 * 60 * 24,
    retry: 2,
  });
};

export const useTrialDaysQuery = () => {
  const { data } = useSubscriptionPlansQuery();
  return data?.trialDays ?? 14;
};

export const useStartingPriceQuery = () => {
  const { data } = useSubscriptionPlansQuery();
  return data?.minStartingPrice ?? 299;
};

export const useShowcaseTelemetryQuery = () => {
  const { data } = useSubscriptionPlansQuery();
  return (
    data?.telemetry ?? {
      productsCount: 50,
      batchesCount: 112,
      firmName: 'Bharat Healthcare & Distributors',
    }
  );
};
