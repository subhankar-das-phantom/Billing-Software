import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { subscriptionService } from '../services/saas/subscriptionService';
import { ROUTE_FEATURE_MAP, SubscriptionStatus, getFeatureForRoute } from '../saas/features';

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const { user, userRole } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [activeDbSub, setActiveDbSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch subscription info when user is authenticated
  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const data = await subscriptionService.getSubscription();
        if (!cancelled && data.success) {
          setSubscription(data.info);
          setActiveDbSub(data.subscription);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch subscription:', err);
          setError(err.message);
          // On error, allow full access (graceful degradation)
          setSubscription(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSubscription();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /**
   * Check if the current plan includes a specific feature.
   */
  const canAccess = useCallback(
    (feature) => {
      // While loading or no subscription data, allow access (don't block UI)
      if (!subscription || loading) return true;
      // If plan features include the feature, allow
      return subscription.plan?.features?.includes(feature) ?? true;
    },
    [subscription, loading],
  );

  /**
   * Check if a route is accessible based on the current plan.
   */
  const canAccessRoute = useCallback(
    (routePath) => {
      const feature = getFeatureForRoute(routePath) || ROUTE_FEATURE_MAP[routePath];
      if (!feature) return true; // Route not mapped = always accessible
      return canAccess(feature);
    },
    [canAccess],
  );

  /**
   * Check if write operations are allowed.
   */
  const canWrite = subscription?.canWrite ?? true;

  /**
   * Is the subscription in grace period?
   */
  const isGrace = subscription?.isGrace ?? false;

  /**
   * Is the subscription expired (beyond grace)?
   */
  const isExpired =
    subscription?.status === SubscriptionStatus.EXPIRED ||
    subscription?.status === SubscriptionStatus.SUSPENDED;

  /**
   * Is the user on a trial?
   */
  const isTrial = subscription?.status === SubscriptionStatus.TRIAL;

  /**
   * Current plan code and name.
   */
  const planCode = subscription?.plan?.code ?? null;
  const planName = subscription?.plan?.name ?? 'No Plan';

  /**
   * Days remaining on subscription.
   */
  const daysRemaining = subscription?.daysRemaining ?? 0;

  /**
   * Force refresh subscription data.
   */
  const refreshSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const data = await subscriptionService.getSubscription();
      if (data.success) {
        setSubscription(data.info);
        setActiveDbSub(data.subscription);
      }
    } catch (err) {
      console.error('Failed to refresh subscription:', err);
    }
  }, [user]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        activeDbSub,
        loading,
        error,

        // Feature gating
        canAccess,
        canAccessRoute,
        canWrite,

        // Status helpers
        isGrace,
        isExpired,
        isTrial,
        planCode,
        planName,
        daysRemaining,

        // Actions
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export default SubscriptionContext;
