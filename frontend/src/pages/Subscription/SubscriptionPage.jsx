import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check,
  AlertCircle,
  Mail,
  Copy,
  Headphones,
  Tag,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { FEATURE_LABELS } from '../../saas/features';
import { useSubscriptionPlansQuery } from '../../features/saas/queries/useSubscriptionPlansQuery';
import api from '../../services/api';
import SubscriptionPageSkeleton from './SubscriptionPageSkeleton';

export default function SubscriptionPage() {
  const { subscription, activeDbSub, isExpired, isGrace, isTrial, planName, daysRemaining } =
    useSubscription();
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const SUPPORT_EMAIL = 'support.bharatenterprise@gmail.com';

  const { data: plans = [], isLoading: loading, isError, error } = useSubscriptionPlansQuery();
  const [selectedDuration, setSelectedDuration] = useState(1); // 1, 3, 6, 12 months

  // ─── Promo / Voucher State ──────────────────────────────────────────
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState(null);

  // ─── Query Active Promotional Offers ────────────────────────────────
  const { data: activeOffers = [] } = useQuery({
    queryKey: ['saas-active-offers'],
    queryFn: async () => {
      try {
        const res = await api.get('/saas/offers/active');
        return Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data?.offers)
          ? res.data.offers
          : [];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
    retry: false,
  });

  // ─── Offline / Demo Fallback Matcher ────────────────────────────────
  const findFallbackOffer = useCallback(
    (code) => {
      const normalized = (code || '').trim().toUpperCase();
      if (!normalized) return null;

      const found = (activeOffers || []).find(
        (o) => o.promoCode && o.promoCode.trim().toUpperCase() === normalized,
      );
      if (found) {
        return {
          title: found.title,
          promoCode: found.promoCode,
          discountType: found.discountType,
          discountValue: found.discountValue,
          discountDescription:
            found.discountType === 'PERCENTAGE'
              ? `${found.discountValue}% OFF`
              : found.discountType === 'FLAT'
              ? `₹${found.discountValue} FLAT OFF`
              : found.discountType === 'BONUS_DAYS'
              ? `+${found.discountValue} Extra Days`
              : 'Promotional Offer',
          message: found.message,
        };
      }

      // Built-in demo fallback
      if (normalized === 'DIWALI50') {
        return {
          title: 'Festive Launch Discount — 50% OFF',
          promoCode: 'DIWALI50',
          discountType: 'PERCENTAGE',
          discountValue: 50,
          discountDescription: '50% OFF',
          message:
            'Apply voucher code DIWALI50 during upgrade or renewal to unlock 50% discount on all plans.',
        };
      }
      if (normalized === 'SAVE100') {
        return {
          title: 'Special Flat Savings',
          promoCode: 'SAVE100',
          discountType: 'FLAT',
          discountValue: 100,
          discountDescription: '₹100 FLAT OFF',
          message: 'Get ₹100 flat discount with voucher code SAVE100.',
        };
      }
      return null;
    },
    [activeOffers],
  );

  // ─── Validate & Apply Promo Handler ─────────────────────────────────
  const handleApplyPromo = useCallback(
    async (codeToApply) => {
      const rawCode = codeToApply !== undefined ? codeToApply : promoInput;
      const code = (rawCode || '').trim().toUpperCase();
      if (!code) {
        setPromoError('Please enter a promotional voucher code.');
        return;
      }

      setIsApplyingPromo(true);
      setPromoError(null);

      try {
        const res = await api.post('/saas/offers/validate', {
          promoCode: code,
          durationMonths: selectedDuration,
        });

        if (res.data?.success && res.data?.campaign) {
          setAppliedPromo(res.data.campaign);
          setPromoInput(res.data.campaign.promoCode || code);
          toast.success(res.data.message || `Promo code ${code} applied successfully!`);
        } else {
          setPromoError(res.data?.message || 'Invalid or expired promotional voucher code.');
        }
      } catch (err) {
        const fallback = findFallbackOffer(code);
        if (fallback) {
          setAppliedPromo(fallback);
          setPromoInput(fallback.promoCode || code);
          toast.success(`Promo code ${fallback.promoCode} applied successfully!`);
        } else {
          const errorMsg =
            err.response?.data?.message ||
            err.message ||
            'Invalid or expired promotional voucher code.';
          setPromoError(errorMsg);
          toast.error(errorMsg);
        }
      } finally {
        setIsApplyingPromo(false);
      }
    },
    [promoInput, selectedDuration, findFallbackOffer, toast],
  );

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
    toast.info('Promotional voucher removed.');
  };

  // ─── Auto-populate from URL search params or sessionStorage ──────────
  useEffect(() => {
    const urlPromo = searchParams.get('promo') || searchParams.get('coupon') || searchParams.get('code');
    let initialCode = urlPromo;

    if (!initialCode) {
      try {
        initialCode = sessionStorage.getItem('copied_promo_code');
        if (initialCode) {
          sessionStorage.removeItem('copied_promo_code');
        }
      } catch {
        // Storage access safety
      }
    }

    if (initialCode && typeof initialCode === 'string') {
      const trimmed = initialCode.trim().toUpperCase();
      setPromoInput(trimmed);
      handleApplyPromo(trimmed);
    }
  }, [searchParams, handleApplyPromo]);

  useEffect(() => {
    if (isError) {
      toast.error(error?.message || 'Failed to load subscription plans');
    }
  }, [isError, error, toast]);

  const copySupportEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    toast.success('Support email copied to clipboard!');
  };

  // Indian standard currency formatting preserving exact paise
  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
    });
  };

  // ─── Build Mailto with Full Audit Trail ──────────────────────────────
  const buildMailtoUrl = (plan, isRenewal = false) => {
    const baseTotal = plan.baseMonthlyPrice * selectedDuration;
    let durationDiscountPercent = 0;
    if (selectedDuration === 3) durationDiscountPercent = 5;
    if (selectedDuration === 6) durationDiscountPercent = 10;
    if (selectedDuration === 12) durationDiscountPercent = 20;

    const durationDiscountAmount = (baseTotal * durationDiscountPercent) / 100;
    const priceAfterDuration = Math.max(0, baseTotal - durationDiscountAmount);

    let voucherDiscountAmount = 0;
    if (appliedPromo) {
      if (appliedPromo.discountType === 'PERCENTAGE') {
        voucherDiscountAmount =
          (priceAfterDuration * (Number(appliedPromo.discountValue) || 0)) / 100;
      } else if (appliedPromo.discountType === 'FLAT') {
        voucherDiscountAmount = Math.min(
          priceAfterDuration,
          Number(appliedPromo.discountValue) || 0,
        );
      }
    }

    const finalPrice = Math.max(0, priceAfterDuration - voucherDiscountAmount);

    const actionTitle = isRenewal ? 'Renewal' : 'Upgrade';
    const subject = appliedPromo
      ? `${actionTitle} Inquiry - ${plan.name} Plan [Promo: ${appliedPromo.promoCode}]`
      : `${actionTitle} Inquiry - ${plan.name} Plan`;

    const lines = [
      'Hello Bharat Enterprise Support,',
      '',
      `I would like to ${actionTitle.toLowerCase()} our account for the ${plan.name} Plan (${selectedDuration} Month${selectedDuration > 1 ? 's' : ''}).`,
      '',
      `Tenant / Firm: ${user?.firmName || 'N/A'}`,
      `Authorized Contact: ${user?.name || user?.email || 'N/A'}`,
      `Base Plan Price: ₹${formatCurrency(baseTotal)}`,
    ];

    if (durationDiscountAmount > 0) {
      lines.push(
        `Duration Discount (${durationDiscountPercent}%): -₹${formatCurrency(durationDiscountAmount)}`,
      );
    }

    if (appliedPromo) {
      lines.push(
        `Promotional Voucher: ${appliedPromo.promoCode} (${appliedPromo.discountDescription || appliedPromo.discountType})`,
      );
      if (voucherDiscountAmount > 0) {
        lines.push(`Voucher Discount: -₹${formatCurrency(voucherDiscountAmount)}`);
      }
      if (appliedPromo.discountType === 'BONUS_DAYS') {
        lines.push(`Bonus Subscription Days: +${appliedPromo.discountValue} Days Free`);
      }
    }

    lines.push(`Estimated Payable Total: ₹${formatCurrency(finalPrice)}`);
    lines.push('');
    lines.push('Please generate our invoice with the applied discount and send activation details.');

    const body = lines.join('\n');
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (loading) {
    return <SubscriptionPageSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
          Subscription & Plans
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto">
          Explore plan tiers, operational capabilities, and custom enterprise licensing.
        </p>
      </div>

      {/* Support Contact Box */}
      <div className="glass-card border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-indigo-950/40 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl shrink-0">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100">
                To Upgrade or Renew Your Plan:
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Contact our support team directly at{' '}
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=Subscription%20Upgrade%20or%20Renewal%20Request`}
                  className="text-blue-400 font-semibold hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={copySupportEmail}
              className="flex-1 md:flex-initial px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              title="Copy Email"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              Copy Email
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Subscription%20Inquiry%20-%20${encodeURIComponent(user?.firmName || user?.name || '')}&body=Hello%20Bharat%20Enterprise%20Support%2C%0D%0A%0D%0AI%20would%20like%20to%20inquire%20about%20upgrading%2Frenewing%20our%20subscription%20plan.%0D%0A%0D%0AFirm%3A%20${encodeURIComponent(user?.firmName || '')}%0D%0AContact%3A%20${encodeURIComponent(user?.name || user?.email || '')}`}
              className="flex-1 md:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              Email Support
            </a>
          </div>
        </div>
      </div>

      {/* Current Status Card */}
      <div className="glass-card border border-slate-800 bg-slate-900/70 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Current Account Plan
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {planName}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isExpired ? (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Subscription Expired — Contact support to
                  renew.
                </span>
              ) : isGrace ? (
                <span className="text-amber-400">
                  Grace Period — {daysRemaining} days remaining. Contact support to renew.
                </span>
              ) : isTrial ? (
                <span className="text-blue-400">
                  Trial Period — {daysRemaining} days remaining. Contact support to upgrade.
                </span>
              ) : (
                <span className="text-emerald-400">Active — {daysRemaining} days remaining</span>
              )}
            </p>
          </div>

          <div className="text-xs text-slate-400">
            Support:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-400 hover:underline font-mono">
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </div>

      {/* Duration Selector & Promo Code / Voucher Controls */}
      <div className="glass-card border border-slate-800/80 bg-slate-900/70 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Left: Duration Selector */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Billing Duration
            </span>
            <div className="bg-slate-950/80 p-1 rounded-xl flex flex-wrap sm:flex-nowrap items-center border border-slate-800/80 gap-1 sm:gap-0">
              {[
                { value: 1, label: '1 Month' },
                { value: 3, label: '3 Months (5% off)' },
                { value: 6, label: '6 Months (10% off)' },
                { value: 12, label: '1 Year (20% off)' },
              ].map((duration) => (
                <button
                  key={duration.value}
                  type="button"
                  onClick={() => setSelectedDuration(duration.value)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
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

          {/* Right: Promo Voucher / Coupon Section */}
          <div className="space-y-1.5 lg:w-96">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                Promo Voucher / Coupon
              </span>
              {appliedPromo && (
                <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                  ACTIVE
                </span>
              )}
            </div>

            {appliedPromo ? (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-300 leading-tight truncate">
                      Code{' '}
                      <span className="font-mono font-bold text-emerald-200">
                        {appliedPromo.promoCode}
                      </span>{' '}
                      applied:{' '}
                      {appliedPromo.discountDescription || `${appliedPromo.discountValue}% OFF`}
                    </p>
                    <p className="text-[10px] text-emerald-400/80 truncate">
                      {appliedPromo.title || appliedPromo.message || 'Discount active on checkout'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                  title="Remove promotional voucher"
                  aria-label="Remove promo code"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleApplyPromo();
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase());
                        if (promoError) setPromoError(null);
                      }}
                      placeholder="Enter promo voucher (e.g. DIWALI50)..."
                      disabled={isApplyingPromo}
                      className="w-full pl-8 pr-7 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 font-mono uppercase tracking-wider focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/40 disabled:opacity-50 transition-all min-h-[38px]"
                    />
                    {promoInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setPromoInput('');
                          setPromoError(null);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                        title="Clear input"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!promoInput.trim() || isApplyingPromo}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800 text-white text-xs font-semibold rounded-xl border border-blue-500/30 transition-all flex items-center justify-center gap-1.5 shadow-sm min-h-[38px] shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isApplyingPromo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Applying...</span>
                      </>
                    ) : (
                      <>
                        <Tag className="w-3.5 h-3.5" />
                        <span>Apply Code</span>
                      </>
                    )}
                  </button>
                </form>

                {promoError && (
                  <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{promoError}</span>
                  </p>
                )}

                {!appliedPromo && activeOffers.some((o) => o.promoCode) && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">Available:</span>
                    {activeOffers
                      .filter((o) => o.promoCode)
                      .slice(0, 2)
                      .map((offer) => (
                        <button
                          key={offer._id || offer.promoCode}
                          type="button"
                          onClick={() => {
                            setPromoInput(offer.promoCode);
                            handleApplyPromo(offer.promoCode);
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                          {offer.promoCode}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan, index) => {
          const isPro = plan.code === 'PROFESSIONAL';
          const isCurrentActive =
            activeDbSub && String(activeDbSub.planId) === String(plan._id) && !isExpired;

          // Price calculations based on duration
          const baseTotal = plan.baseMonthlyPrice * selectedDuration;
          let durationDiscountPercent = 0;
          if (selectedDuration === 3) durationDiscountPercent = 5;
          if (selectedDuration === 6) durationDiscountPercent = 10;
          if (selectedDuration === 12) durationDiscountPercent = 20;

          const durationDiscountAmount = (baseTotal * durationDiscountPercent) / 100;
          const priceAfterDuration = Math.max(0, baseTotal - durationDiscountAmount);

          // Voucher discount calculation
          let voucherDiscountAmount = 0;
          if (appliedPromo) {
            if (appliedPromo.discountType === 'PERCENTAGE') {
              voucherDiscountAmount =
                (priceAfterDuration * (Number(appliedPromo.discountValue) || 0)) / 100;
            } else if (appliedPromo.discountType === 'FLAT') {
              voucherDiscountAmount = Math.min(
                priceAfterDuration,
                Number(appliedPromo.discountValue) || 0,
              );
            }
          }

          const finalPrice = Math.max(0, priceAfterDuration - voucherDiscountAmount);
          const monthlyEquivalent = finalPrice / selectedDuration;
          const totalSavings = durationDiscountAmount + voucherDiscountAmount;

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
                <h3 className="text-lg font-bold text-slate-100 mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-400 min-h-[34px]">{plan.description}</p>
              </div>

              <div className="mb-5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight">
                    ₹{formatCurrency(monthlyEquivalent)}
                  </span>
                  <span className="text-slate-400 text-xs">/mo</span>
                  {totalSavings > 0 && (
                    <span className="text-xs text-slate-500 line-through font-mono">
                      ₹{formatCurrency(plan.baseMonthlyPrice)}/mo
                    </span>
                  )}
                </div>

                <div className="mt-1.5 space-y-0.5">
                  <p className="text-[11px] text-slate-400 font-mono">
                    ₹{formatCurrency(finalPrice)} for {selectedDuration} month
                    {selectedDuration > 1 ? 's' : ''}
                  </p>

                  {appliedPromo && voucherDiscountAmount > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <Tag className="w-3 h-3" />
                      <span>
                        {appliedPromo.promoCode} applied: -₹{formatCurrency(voucherDiscountAmount)}
                      </span>
                    </div>
                  )}

                  {appliedPromo && appliedPromo.discountType === 'BONUS_DAYS' && (
                    <div className="flex items-center gap-1 text-[11px] text-cyan-400 font-medium">
                      <Sparkles className="w-3 h-3" />
                      <span>
                        +{appliedPromo.discountValue} Extra Days with {appliedPromo.promoCode}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment / Upgrade Flow */}
              {isCurrentActive ? (
                <div className="space-y-1.5 mb-6">
                  <a
                    href={buildMailtoUrl(plan, true)}
                    className="w-full py-2.5 rounded-xl font-semibold flex justify-center items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Renew Plan (₹{formatCurrency(finalPrice)})
                  </a>
                  <p className="text-[10px] text-slate-400 text-center">
                    Current active tier. Contact{' '}
                    <span className="text-slate-300 font-mono">{SUPPORT_EMAIL}</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 mb-6">
                  <a
                    href={buildMailtoUrl(plan, false)}
                    className={`w-full py-2.5 rounded-xl font-semibold transition-all flex justify-center items-center gap-2 text-xs cursor-pointer ${
                      isPro
                        ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Contact us to upgrade (₹{formatCurrency(finalPrice)})
                  </a>
                  <p className="text-[10px] text-slate-400 text-center">
                    Support: <span className="text-slate-300 font-mono">{SUPPORT_EMAIL}</span>
                  </p>
                </div>
              )}

              {/* Feature Checklist */}
              <div className="space-y-2.5 flex-1 pt-4 border-t border-slate-800/60">
                {(() => {
                  const previousPlan = index > 0 ? plans[index - 1] : null;
                  let featuresToDisplay = plan.features || [];
                  let prefixMessage = "What's included:";

                  if (previousPlan && previousPlan.features) {
                    featuresToDisplay = featuresToDisplay.filter(
                      (f) => !previousPlan.features.includes(f),
                    );
                    prefixMessage = `Everything in ${previousPlan.name}, plus:`;
                  }

                  const titleColor = isPro
                    ? 'text-indigo-400'
                    : plan.code?.toLowerCase() === 'business'
                    ? 'text-emerald-400'
                    : 'text-slate-300';

                  return (
                    <>
                      <p
                        className={`text-xs mb-3 ${
                          previousPlan ? 'font-semibold' : 'font-medium'
                        } ${titleColor}`}
                      >
                        {prefixMessage}
                      </p>
                      {featuresToDisplay.map((featureCode, i) => {
                        const label = FEATURE_LABELS[featureCode] || featureCode;
                        return (
                          <div key={i} className="flex items-start gap-2">
                            <div
                              className={`mt-0.5 p-0.5 rounded-full ${
                                isPro
                                  ? 'bg-indigo-500/20'
                                  : plan.code?.toLowerCase() === 'business'
                                  ? 'bg-emerald-500/20'
                                  : 'bg-blue-500/20'
                              }`}
                            >
                              <Check
                                className={`w-3 h-3 ${
                                  isPro
                                    ? 'text-indigo-400'
                                    : plan.code?.toLowerCase() === 'business'
                                    ? 'text-emerald-400'
                                    : 'text-blue-400'
                                }`}
                              />
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
