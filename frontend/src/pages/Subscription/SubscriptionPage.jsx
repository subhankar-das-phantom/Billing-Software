import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Shield, Zap, AlertCircle, CreditCard, Repeat } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscriptionService } from '../../services/saas/subscriptionService';
import { FEATURE_LABELS } from '../../saas/features';

export default function SubscriptionPage() {
  const { subscription, activeDbSub, isExpired, isGrace, isTrial, planName, daysRemaining, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const toast = useToast();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(1); // 1, 3, 6, 12 months
  const [renewalMode, setRenewalMode] = useState('manual'); // manual, auto

  useEffect(() => {
    loadPlans();
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const loadPlans = async () => {
    try {
      const res = await subscriptionService.getPlans();
      if (res.success) {
        setPlans(res.plans);
      }
    } catch (err) {
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan) => {
    if (!window.Razorpay) {
      toast.error('Payment gateway is still loading. Please try again in a moment.');
      return;
    }

    try {
      setProcessing(true);

      // Initiate checkout
      const res = await subscriptionService.checkout(
        plan._id,
        selectedDuration,
        renewalMode === 'auto',
      );

      if (!res.success || (!res.order && !res.subscription)) {
        throw new Error(res.message || 'Failed to initiate checkout');
      }

      // Configure Razorpay checkout
      const isAutoRenewCheckout = res.checkoutType === 'subscription';
      const options = {
        key: res.key, // Test or Live key from backend
        ...(isAutoRenewCheckout
          ? { subscription_id: res.subscription.id }
          : {
              amount: res.order.amount,
              currency: res.order.currency,
              order_id: res.order.id,
            }),
        name: 'Bharat Enterprise',
        description: isAutoRenewCheckout
          ? `Auto-renewing subscription: ${plan.name}`
          : `Subscription: ${plan.name} (${selectedDuration} months)`,
        handler: async function (response) {
          // Verify payment
          try {
            const verifyRes = await subscriptionService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentId: res.paymentId
            });

            if (verifyRes.success) {
              toast.success(isAutoRenewCheckout
                ? 'Auto-renewal activated successfully!'
                : 'Subscription activated successfully!');
              refreshSubscription();
            } else {
              toast.error(verifyRes.message || 'Payment verification failed');
            }
          } catch (err) {
            toast.error('Failed to verify payment');
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#3B82F6' // tailwind blue-500
        }
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (response) {
        toast.error(`Payment failed: ${response.error.description}`);
      });

      rzp.open();
    } catch (err) {
      toast.error(err.message || 'Error during checkout');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-4">Subscription & Billing</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Manage your subscription, upgrade your plan, and access premium features.
        </p>
      </div>

      {/* Current Status Card */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-200 mb-1">Current Plan: <span className="text-blue-400">{planName}</span></h2>
            <p className="text-sm text-slate-400">
              {isExpired ? (
                <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Subscription Expired</span>
              ) : isGrace ? (
                <span className="text-amber-400">Grace Period - {daysRemaining} days remaining</span>
              ) : isTrial ? (
                <span className="text-blue-400">Free Trial - {daysRemaining} days remaining</span>
              ) : (
                <span className="text-emerald-400">Active - {daysRemaining} days remaining</span>
              )}
            </p>
            {activeDbSub && (
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                {activeDbSub.autoRenew ? (
                  <>
                    <Repeat className="w-3.5 h-3.5 text-emerald-400" />
                    Auto-renewal enabled
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    Manual renewal
                  </>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
            <Shield className="w-5 h-5 text-accent-500" />
            <div className="text-sm">
              <p className="text-slate-300">Secure payments by</p>
              <p className="font-semibold text-white">Razorpay</p>
            </div>
          </div>
        </div>
      </div>

      {/* Renewal Mode Selector */}
      <div className="flex justify-center mb-6">
        <div className="bg-slate-800/50 p-1 rounded-xl flex items-center border border-slate-700/50">
          {[
            { value: 'manual', label: 'Manual renewal', icon: CreditCard },
            { value: 'auto', label: 'Auto-renew', icon: Repeat }
          ].map(option => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => setRenewalMode(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${renewalMode === option.value
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration Selector */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-800/50 p-1 rounded-xl flex items-center border border-slate-700/50">
          {[
            { value: 1, label: '1 Month' },
            { value: 3, label: '3 Months (5% off)' },
            { value: 6, label: '6 Months (10% off)' },
            { value: 12, label: '1 Year (20% off)' }
          ].map(duration => (
            <button
              key={duration.value}
              onClick={() => setSelectedDuration(duration.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedDuration === duration.value
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
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
          // Calculate price based on duration
          const isPro = plan.code === 'PROFESSIONAL';

          // These calculations mimic the backend discounts
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-slate-800/30 backdrop-blur-sm rounded-2xl border ${isPro ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' : 'border-slate-700/50'
                } p-6 flex flex-col`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                  RECOMMENDED
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-400 min-h-[40px]">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-white">₹{monthlyEquivalent}</span>
                  <span className="text-slate-400 mb-1">/mo</span>
                </div>
                <p className="text-xs text-emerald-400 mt-1">
                  {renewalMode === 'auto'
                    ? `Auto-renews at ₹${finalPrice} every ${selectedDuration} month${selectedDuration > 1 ? 's' : ''}`
                    : `Pay ₹${finalPrice} once for ${selectedDuration} month${selectedDuration > 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Pro-ration notice — only for switching to a DIFFERENT plan */}
              {!isExpired && daysRemaining > 0 && activeDbSub && String(activeDbSub.planId) !== String(plan._id) && (() => {
                // Find the user's CURRENT plan from the plans list to get accurate pricing
                const currentPlan = plans.find(p => String(p._id) === String(activeDbSub.planId));
                const currentPrice = currentPlan?.baseMonthlyPrice || activeDbSub?.currentPricingSnapshot?.baseMonthlyPrice || 0;
                const targetPrice = plan.baseMonthlyPrice || 1;
                const convertedDays = Math.round(daysRemaining * (currentPrice / targetPrice));
                
                return (
                  <div className="mb-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <p>
                        Your remaining <strong>{daysRemaining} days</strong> of {planName} will be converted to{' '}
                        <strong>{convertedDays} days</strong>{' '}
                        of {plan.name} and added to your new purchase.
                      </p>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={processing}
                className={`w-full py-3 rounded-xl font-semibold transition-all mb-8 flex justify-center items-center gap-2 ${isPro
                    ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
              >
                {processing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    {renewalMode === 'auto' ? (
                      <Repeat className="w-4 h-4" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {renewalMode === 'auto' ? 'Start Auto-renewal' : 'Pay Once'}
                  </>
                )}
              </button>

              <div className="space-y-3 flex-1 mt-4">
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
                      <p className={`text-sm mb-4 ${previousPlan ? 'font-semibold' : 'font-medium'} ${titleColor}`}>
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
                            <span className="text-sm text-slate-400">{label}</span>
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
