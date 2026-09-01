import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Shield, AlertCircle, Mail, MessageSquare } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { FEATURE_LABELS } from '../../saas/features';
import { useSubscriptionPlansQuery } from '../../features/saas/queries/useSubscriptionPlansQuery';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

export default function SubscriptionPage() {
  const { subscription, activeDbSub, isExpired, isGrace, isTrial, planName, daysRemaining } = useSubscription();
  const { user } = useAuth();
  const toast = useToast();

  const { data: plans = [], isLoading: loading, isError, error } = useSubscriptionPlansQuery();
  const [selectedDuration, setSelectedDuration] = useState(1); // 1, 3, 6, 12 months

  useEffect(() => {
    if (isError) {
      toast.error(error?.message || 'Failed to load subscription plans');
    }
  }, [isError, error, toast]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto pb-12 space-y-8">
        <div className="text-center space-y-2">
          <ShimmerBone className="h-8 w-64 mx-auto rounded-lg" />
          <ShimmerBone className="h-4 w-96 mx-auto rounded" />
        </div>
        <div className="glass-card p-6 border border-slate-800">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <ShimmerBone className="h-5 w-48 rounded" />
              <ShimmerBone className="h-4 w-60 rounded" />
            </div>
            <ShimmerBone className="h-10 w-32 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-6 space-y-4 border border-slate-800">
              <ShimmerBone className="h-6 w-32 rounded" />
              <ShimmerBone className="h-4 w-48 rounded" />
              <ShimmerBone className="h-10 w-28 rounded-lg" />
              <div className="space-y-2 pt-4 border-t border-slate-800/60">
                {[1, 2, 3, 4, 5].map(j => (
                  <div key={j} className="flex items-center gap-2">
                    <ShimmerBone className="w-4 h-4 rounded-full" />
                    <ShimmerBone className="h-3 w-40 rounded" />
                  </div>
                ))}
              </div>
              <ShimmerBone className="h-10 w-full rounded-xl mt-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">Subscription & Plans</h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto">
          Explore plan tiers, operational capabilities, and tailored feature sets for your enterprise.
        </p>
      </div>

      {/* Current Status Card */}
      <div className="glass-card border border-slate-800 bg-slate-900/70 rounded-2xl p-5 sm:p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Current Plan</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {planName}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isExpired ? (
                <span className="text-rose-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Subscription Expired</span>
              ) : isGrace ? (
                <span className="text-amber-400">Grace Period — {daysRemaining} days remaining</span>
              ) : isTrial ? (
                <span className="text-blue-400">Trial Period — {daysRemaining} days remaining</span>
              ) : (
                <span className="text-emerald-400">Active — {daysRemaining} days remaining</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="mailto:support@bharatenterprise.com?subject=Subscription%20Plan%20Inquiry"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-2 shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              Contact us to upgrade this plan.
            </a>
          </div>
        </div>
      </div>

      {/* Duration Selector */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-900/80 p-1 rounded-xl flex items-center border border-slate-800">
          {[
            { value: 1, label: '1 Month' },
            { value: 3, label: '3 Months (5% off)' },
            { value: 6, label: '6 Months (10% off)' },
            { value: 12, label: '1 Year (20% off)' }
          ].map(duration => (
            <button
              key={duration.value}
              onClick={() => setSelectedDuration(duration.value)}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDuration === duration.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {duration.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan, index) => {
          const isPro = plan.code === 'PROFESSIONAL';
          const isCurrentActive = activeDbSub && String(activeDbSub.planId) === String(plan._id) && !isExpired;

          // Price calculations based on duration
          const baseTotal = plan.baseMonthlyPrice * selectedDuration;
          let discount = 0;
          if (selectedDuration === 3) discount = 5;
          if (selectedDuration === 6) discount = 10;
          if (selectedDuration === 12) discount = 20;

          const finalPrice = Math.round(baseTotal * (1 - discount / 100));
          const monthlyEquivalent = Math.round(finalPrice / selectedDuration);

          return (
            <motion.div
              key={plan._id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`relative bg-slate-900/60 backdrop-blur-sm rounded-2xl border ${
                isCurrentActive
                  ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                  : isPro
                  ? 'border-blue-500/40 shadow-lg shadow-blue-500/5'
                  : 'border-slate-800'
              } p-6 flex flex-col`}
            >
              {isPro && !isCurrentActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-md">
                  RECOMMENDED
                </div>
              )}
              {isCurrentActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-md">
                  CURRENT ACTIVE
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-400 min-h-[34px]">{plan.description}</p>
              </div>

              <div className="mb-5">
                <div className="flex items-end gap-1">
                  <span className="text-2xl sm:text-3xl font-bold text-white">₹{monthlyEquivalent}</span>
                  <span className="text-slate-400 text-xs mb-1">/mo</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  ₹{finalPrice} for {selectedDuration} month{selectedDuration > 1 ? 's' : ''}
                </p>
              </div>

              {/* Temporary Payment Flow: Contact CTA */}
              {isCurrentActive ? (
                <div className="w-full py-2.5 rounded-xl font-semibold mb-6 flex justify-center items-center gap-2 bg-slate-800/80 border border-slate-700 text-slate-300 text-xs">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Current Active Plan
                </div>
              ) : (
                <a
                  href={`mailto:support@bharatenterprise.com?subject=Upgrade%20Inquiry%20-%20${encodeURIComponent(plan.name)}%20Plan&body=Hello%2C%0D%0A%0D%0AI%20would%20like%20to%20upgrade%20our%20account%20to%20the%20${encodeURIComponent(plan.name)}%20Plan%20(${selectedDuration}%20Months).%0D%0A%0D%0AUser%3A%20${encodeURIComponent(user?.name || user?.email || '')}%0D%0AFirm%3A%20${encodeURIComponent(user?.firmName || '')}`}
                  className={`w-full py-2.5 rounded-xl font-semibold transition-all mb-6 flex justify-center items-center gap-2 text-xs ${
                    isPro
                      ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Contact us to upgrade this plan.
                </a>
              )}

              {/* Feature Checklist */}
              <div className="space-y-2.5 flex-1 pt-4 border-t border-slate-800/60">
                {(() => {
                  const previousPlan = index > 0 ? plans[index - 1] : null;
                  let featuresToDisplay = plan.features || [];
                  let prefixMessage = "What's included:";
                  
                  if (previousPlan && previousPlan.features) {
                    featuresToDisplay = featuresToDisplay.filter(f => !previousPlan.features.includes(f));
                    prefixMessage = `Everything in ${previousPlan.name}, plus:`;
                  }

                  const titleColor = isPro ? 'text-indigo-400' : 
                                     plan.code?.toLowerCase() === 'business' ? 'text-emerald-400' : 
                                     'text-slate-300';

                  return (
                    <>
                      <p className={`text-xs mb-3 ${previousPlan ? 'font-semibold' : 'font-medium'} ${titleColor}`}>
                        {prefixMessage}
                      </p>
                      {featuresToDisplay.map((featureCode, i) => {
                        const label = FEATURE_LABELS[featureCode] || featureCode;
                        return (
                          <div key={i} className="flex items-start gap-2">
                            <div className={`mt-0.5 p-0.5 rounded-full ${
                              isPro ? 'bg-indigo-500/20' : 
                              plan.code?.toLowerCase() === 'business' ? 'bg-emerald-500/20' : 'bg-blue-500/20'
                            }`}>
                              <Check className={`w-3 h-3 ${
                                isPro ? 'text-indigo-400' :
                                plan.code?.toLowerCase() === 'business' ? 'text-emerald-400' : 'text-blue-400'
                              }`} />
                            </div>
                            <span className="text-xs text-slate-400">{label}</span>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
