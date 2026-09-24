import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, AlertCircle } from 'lucide-react';
import { useSubscriptionPlansQuery } from '../../../features/saas/queries/useSubscriptionPlansQuery';
import { FEATURE_LABELS } from '../../../saas/features';
import { CANONICAL_PLANS, DURATION_DISCOUNTS } from '../data/features';

export default function PricingSection() {
  const [selectedDuration, setSelectedDuration] = useState(1);
  const { data: apiPlans, isError } = useSubscriptionPlansQuery();
  const hasValidPlans = Array.isArray(apiPlans) && apiPlans.length > 0;
  const isProduction = !import.meta.env.DEV;

  const trialDays = apiPlans?.trialDays ?? 14;
  const minStartingPrice = apiPlans?.minStartingPrice ?? 299;

  // Build dynamic duration options directly from API plan pricing rules
  const durationOptions = useMemo(() => {
    if (apiPlans?.[0]?.pricing?.length > 0) {
      return apiPlans[0].pricing.map((tier) => {
        const m = tier.durationMonths;
        let label = `${m} Months`;
        if (m === 1) label = 'Monthly';
        else if (m === 3) label = 'Quarterly (3 Mo)';
        else if (m === 6) label = 'Half-Yearly (6 Mo)';
        else if (m === 12) label = 'Annual (12 Mo)';

        return {
          durationMonths: m,
          label,
          discountPercent: tier.savingsPercent || 0,
        };
      });
    }
    return DURATION_DISCOUNTS;
  }, [apiPlans]);

  // Find active duration rule
  const currentDurationRule = useMemo(() => {
    return (
      durationOptions.find((d) => d.durationMonths === selectedDuration) ||
      durationOptions[0]
    );
  }, [durationOptions, selectedDuration]);

  // Merge API data with dynamic feature mapping & calculations
  const displayPlans = useMemo(() => {
    if (apiPlans && Array.isArray(apiPlans) && apiPlans.length > 0) {
      return apiPlans.map((apiPlan, pIdx) => {
        const pricingTier = apiPlan.pricing?.find(
          (p) => p.durationMonths === selectedDuration
        );

        const effectiveMonthly = pricingTier
          ? pricingTier.effectiveMonthlyPrice
          : Math.round(
              apiPlan.baseMonthlyPrice *
                (1 - currentDurationRule.discountPercent / 100)
            );

        const totalPrice = pricingTier
          ? pricingTier.finalPrice
          : effectiveMonthly * selectedDuration;

        const isBusiness =
          apiPlan.code?.toLowerCase() === 'business' ||
          apiPlan.name?.toLowerCase().includes('business');

        // Dynamically compute feature list from DB using FEATURE_LABELS
        let features = [];
        if (Array.isArray(apiPlan.features) && apiPlan.features.length > 0) {
          if (pIdx > 0 && apiPlans[pIdx - 1]?.features) {
            const prevPlan = apiPlans[pIdx - 1];
            const prevFeatureSet = new Set(prevPlan.features || []);
            const incrementalFeatures = apiPlan.features.filter(
              (f) => !prevFeatureSet.has(f)
            );
            features = [
              `All ${prevPlan.name} capabilities`,
              ...incrementalFeatures.map(
                (f) => FEATURE_LABELS[f] || f.replace(/_/g, ' ')
              ),
            ];
          } else {
            features = apiPlan.features.map(
              (f) => FEATURE_LABELS[f] || f.replace(/_/g, ' ')
            );
          }
        } else {
          const fallback = CANONICAL_PLANS[pIdx] || CANONICAL_PLANS[0];
          features = fallback.features;
        }

        return {
          id: apiPlan._id || apiPlan.code?.toLowerCase(),
          code: apiPlan.code,
          name: apiPlan.name,
          description:
            apiPlan.description ||
            (apiPlan.code?.toLowerCase() === 'starter'
              ? 'Essential billing and customer management.'
              : apiPlan.code?.toLowerCase() === 'business'
              ? 'Comprehensive workflow suite with khata and inventory.'
              : 'Full enterprise suite with team access and analytics.'),
          baseMonthlyPrice: apiPlan.baseMonthlyPrice,
          effectiveMonthly,
          totalPrice,
          features,
          popular: isBusiness,
          ctaText: isBusiness ? 'Choose Business' : `Select ${apiPlan.name}`,
        };
      });
    }

    // Deterministic fallback to verified canonical plans
    return CANONICAL_PLANS.map((plan) => {
      const discount = currentDurationRule.discountPercent;
      const effectiveMonthly = Math.round(
        plan.baseMonthlyPrice * (1 - discount / 100)
      );
      const totalPrice = effectiveMonthly * selectedDuration;

      return {
        ...plan,
        effectiveMonthly,
        totalPrice,
      };
    });
  }, [apiPlans, selectedDuration, currentDurationRule]);

  // Production error guard: only display when there is no usable plan data (cache is empty)
  if (!hasValidPlans && isError && isProduction) {
    return (
      <section id="pricing" className="py-20 lg:py-28 border-t border-slate-800/80 bg-slate-950 transition-colors">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 sm:p-12 shadow-xl transition-colors">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              Commercial Pricing Synchronizing
            </h2>
            <p className="mt-3 text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Commercial plan pricing is currently synchronizing with our billing system. You may start your trial now or contact support directly for onboarding.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/30 transition-all duration-150"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="mailto:support.bharatenterprise@gmail.com"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-200 hover:text-slate-50 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors"
              >
                Contact Support (support.bharatenterprise@gmail.com)
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Active subscriptions and existing tenant accounts remain unaffected.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-20 lg:py-28 border-t border-slate-800/80 bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header (No eyebrow kicker) */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight">
            Predictable Pricing for Growing Distribution Businesses
          </h2>

          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            All plans include core GST tax calculation and invoice printing. Tiered plans start from ₹{minStartingPrice.toLocaleString('en-IN')}/month — scale seamlessly as your operations expand.
          </p>

          {/* Billing Duration Segmented Switcher */}
          <div className="mt-8 w-full max-w-md sm:max-w-none mx-auto sm:w-auto p-1.5 rounded-2xl sm:rounded-xl bg-slate-850 border border-slate-800 shadow-inner inline-block sm:inline-flex">
            <div className="grid grid-cols-2 sm:flex sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-1">
              {durationOptions.map((discount) => {
                const isSelected = selectedDuration === discount.durationMonths;
                return (
                  <button
                    key={discount.durationMonths}
                    type="button"
                    onClick={() => setSelectedDuration(discount.durationMonths)}
                    className={`relative flex items-center justify-center space-x-1.5 px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-xs font-semibold transition-all duration-150 select-none ${
                      isSelected
                        ? 'bg-blue-600 text-white border border-blue-500 shadow-md shadow-blue-600/25 z-10'
                        : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-slate-50 shadow-2xs'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className="tracking-tight">{discount.label}</span>
                    {discount.discountPercent > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight transition-colors ${
                          isSelected
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        Save {discount.discountPercent}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {displayPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-all duration-200 ${
                plan.popular
                  ? 'bg-slate-900 border-2 border-blue-500 shadow-xl shadow-blue-500/10'
                  : 'bg-slate-900 border border-slate-800 hover:border-slate-700 shadow-sm'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-[11px] font-bold tracking-wide uppercase text-white shadow-md">
                  Most Popular for Wholesalers
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-100 tracking-tight">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 min-h-[32px] leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                {/* Price Display */}
                <div className="pb-6 border-b border-slate-800">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-sm font-semibold text-slate-400">₹</span>
                    <span className="text-4xl font-extrabold text-slate-50 font-mono tracking-tight">
                      {plan.effectiveMonthly.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">/ month</span>
                  </div>

                  {selectedDuration > 1 && (
                    <p className="text-xs text-slate-400 mt-2 font-mono">
                      Billed as ₹{plan.totalPrice.toLocaleString('en-IN')} for {selectedDuration} months
                    </p>
                  )}
                </div>

                {/* Feature List */}
                <div className="py-6 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    What's Included:
                  </span>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start space-x-3 text-xs sm:text-sm text-slate-300">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Plan Action CTA */}
              <div className="pt-6 border-t border-slate-800">
                <Link
                  to={`/register?plan=${plan.code?.toLowerCase() || plan.id}`}
                  className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-slate-50 border border-slate-800'
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-center text-[11px] text-slate-400 mt-2">
                  {!isError && trialDays ? `Includes ${trialDays}-day initial trial access` : 'Full access trial included'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
