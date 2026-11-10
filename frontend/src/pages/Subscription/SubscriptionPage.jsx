import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  AlertCircle,
  Copy,
  Tag,
  Sparkles,
  X,
  Loader2,
  Layers,
  Receipt,
  Building2,
  QrCode,
  ShieldCheck,
  Search,
  Printer,
  Eye,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CreditCard,
  FileText,
  BadgePercent,
  CheckCircle2,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { FEATURE_LABELS } from '../../saas/features';
import { useSubscriptionPlansQuery } from '../../features/saas/queries/useSubscriptionPlansQuery';
import { subscriptionService } from '../../services/saas/subscriptionService';
import api from '../../services/api';
import SubscriptionPageSkeleton from './SubscriptionPageSkeleton';
import SubmitPaymentProofModal from './SubmitPaymentProofModal';
import TenantInvoiceModal from './TenantInvoiceModal';

export default function SubscriptionPage() {
  const { subscription, activeDbSub, isExpired, isGrace, isTrial, planName, daysRemaining } =
    useSubscription();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── Dual-Tab Architecture ──────────────────────────────────────────
  // Synchronized with URL query param: ?tab=plans | ?tab=invoices
  const activeTab = searchParams.get('tab') === 'invoices' ? 'invoices' : 'plans';

  const handleTabChange = (newTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', newTab);
    setSearchParams(nextParams, { replace: true });
  };

  const SUPPORT_EMAIL = 'support.bharatenterprise@gmail.com';
  const OFFICIAL_BANK = {
    bankName: 'HDFC Bank',
    accountName: 'Bharat Enterprise Technologies Pvt Ltd',
    accountNumber: '50200088921134',
    ifscCode: 'HDFC0000240',
    branch: 'Bandra Kurla Complex, Mumbai',
    accountType: 'Current Account',
    upiId: 'bharatenterprise@hdfcbank',
  };

  const { data: plans = [], isLoading: loadingPlans, isError, error } = useSubscriptionPlansQuery();
  const [selectedDuration, setSelectedDuration] = useState(1); // 1, 3, 6, 12 months

  // ─── Modal States ───────────────────────────────────────────────────
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [selectedPlanForProof, setSelectedPlanForProof] = useState(null);
  const [selectedDurationForProof, setSelectedDurationForProof] = useState(1);
  const [selectedAmountForProof, setSelectedAmountForProof] = useState(0);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState(null);

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

  // ─── Query Pending Offline Payment Request ──────────────────────────
  const { data: pendingRequestData, refetch: refetchPendingRequest } = useQuery({
    queryKey: ['saas-pending-payment-request'],
    queryFn: async () => {
      try {
        const res = await subscriptionService.getPendingPaymentRequest();
        return res?.pendingRequest || null;
      } catch {
        return null;
      }
    },
    staleTime: 15000,
    retry: false,
  });

  // ─── Query Tenant Statutory Tax Invoices ────────────────────────────
  const { data: invoicesData, isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ['saas-subscription-invoices'],
    queryFn: async () => {
      try {
        const res = await subscriptionService.getSubscriptionInvoices();
        return {
          invoices: res?.invoices || [],
          summary: res?.summary || { totalInvoices: 0, totalSpend: 0, totalITC: 0 },
        };
      } catch {
        return {
          invoices: [],
          summary: { totalInvoices: 0, totalSpend: 0, totalITC: 0 },
        };
      }
    },
    staleTime: 30000,
    retry: false,
  });

  const invoices = invoicesData?.invoices || [];
  const invoicesSummary = invoicesData?.summary || { totalInvoices: 0, totalSpend: 0, totalITC: 0 };

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
    const urlPromo =
      searchParams.get('promo') || searchParams.get('coupon') || searchParams.get('code');
    let initialCode = urlPromo;

    if (!initialCode) {
      try {
        initialCode = sessionStorage.getItem('copied_promo_code');
        if (initialCode) {
          sessionStorage.removeItem('copied_promo_code');
        }
      } catch {}
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

  // Indian standard currency formatting preserving exact paise
  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
    });
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // ─── Calculate Net Payable for a Plan ────────────────────────────────
  const calculatePlanNetPayable = useCallback(
    (plan) => {
      const baseMonthly = Number(plan?.baseMonthlyPrice || 0);
      const baseTotal = baseMonthly * selectedDuration;

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
      const monthlyEquivalent = finalPrice / selectedDuration;
      const totalSavings = durationDiscountAmount + voucherDiscountAmount;

      return {
        baseTotal,
        durationDiscountAmount,
        durationDiscountPercent,
        priceAfterDuration,
        voucherDiscountAmount,
        finalPrice,
        monthlyEquivalent,
        totalSavings,
      };
    },
    [selectedDuration, appliedPromo],
  );

  // ─── Open Payment Proof Modal ────────────────────────────────────────
  const handleOpenProofModal = (plan = null) => {
    const targetPlan = plan || plans.find((p) => p.code === 'PROFESSIONAL') || plans[0];
    const calc = calculatePlanNetPayable(targetPlan);

    setSelectedPlanForProof(targetPlan);
    setSelectedDurationForProof(selectedDuration);
    setSelectedAmountForProof(calc.finalPrice);
    setIsProofModalOpen(true);
  };

  // ─── Open Invoice Modal ──────────────────────────────────────────────
  const handleViewInvoice = (inv) => {
    setSelectedInvoiceForModal(inv);
    setIsInvoiceModalOpen(true);
  };

  // ─── Invoices Search & Filter State ──────────────────────────────────
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [selectedFY, setSelectedFY] = useState('ALL');

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = invoiceSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.planName?.toLowerCase().includes(q) ||
        inv.utrNumber?.toLowerCase().includes(q);

      const matchesFY =
        selectedFY === 'ALL' ||
        (selectedFY === '26-27' && inv.invoiceNumber?.includes('26-27')) ||
        (selectedFY === '25-26' && inv.invoiceNumber?.includes('25-26'));

      return matchesSearch && matchesFY;
    });
  }, [invoices, invoiceSearchQuery, selectedFY]);

  // Formatted date string for subscription expiration
  const formattedExpiryDate = useMemo(() => {
    const dateVal = subscription?.currentPeriodEnd || activeDbSub?.expiresAt;
    if (!dateVal) return '11 Nov 2026';
    try {
      return new Date(dateVal).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '11 Nov 2026';
    }
  }, [subscription, activeDbSub]);

  if (loadingPlans) {
    return <SubscriptionPageSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6 sm:space-y-8">
      {/* ─── Page Header & Description ───────────────────────────────── */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
          Billing & Subscription Center
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto">
          Manage enterprise subscription tiers, submit offline NEFT/UPI payment proofs, and access statutory B2B GST tax invoices.
        </p>
      </div>

      {/* ─── Top Dual-Tab Navigation Pills ───────────────────────────── */}
      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <button
            type="button"
            onClick={() => handleTabChange('plans')}
            className={`min-h-[44px] px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Plans & Subscription</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('invoices')}
            className={`min-h-[44px] px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'invoices'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>My Tax Invoices & Receipts</span>
            {invoices.length > 0 && (
              <span
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full font-mono ${
                  activeTab === 'invoices'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                {invoices.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── TAB 1: PLANS & SUBSCRIPTION ─────────────────────────────── */}
      {activeTab === 'plans' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 sm:space-y-8 will-change-[transform,opacity]"
        >
          {/* 1. Active Account Status Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    Current Account Plan
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {planName || 'Professional'}
                  </span>
                  {/* Status Badge */}
                  {isExpired ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      EXPIRED
                    </span>
                  ) : isGrace ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      GRACE PERIOD
                    </span>
                  ) : isTrial ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      TRIAL PERIOD
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  <span>
                    Valid Until:{' '}
                    <strong className="text-slate-200 font-medium">{formattedExpiryDate}</strong>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    Days Remaining:{' '}
                    <strong
                      className={`font-mono font-bold ${
                        isExpired
                          ? 'text-rose-400'
                          : daysRemaining <= 7
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {daysRemaining} Days
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleTabChange('invoices')}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  View Tax Invoices
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenProofModal()}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Renew / Upgrade
                </button>
              </div>
            </div>

            {/* Prominent "Payment Verification In Progress" Notice if pending request exists */}
            {pendingRequestData && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-950/20 to-slate-900 border border-amber-500/40 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-amber-200 text-sm">
                        Payment Verification In Progress
                      </h4>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      Your payment proof (UTR:{' '}
                      <span className="font-mono font-bold text-amber-300">
                        {pendingRequestData?.metadata?.utrNumber || pendingRequestData?.gatewayPaymentId || 'SUBMITTED'}
                      </span>
                      ) for ₹
                      <span className="font-mono font-bold text-amber-200">
                        {formatCurrency(pendingRequestData?.finalAmount)}
                      </span>{' '}
                      is being verified by admin. Your plan will activate within 15–30 mins.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenProofModal(pendingRequestData.planId)}
                  className="w-full md:w-auto px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all shrink-0 cursor-pointer min-h-[36px]"
                >
                  Update Proof Details
                </button>
              </div>
            )}
          </div>

          {/* 2. Duration Multiplier Pills & Promo Voucher Bar */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* Duration Multiplier Pills */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Billing Duration & Multiplier
                </span>
                <div className="bg-slate-950/80 p-1 rounded-xl flex flex-wrap sm:flex-nowrap items-center border border-slate-800/80 gap-1 sm:gap-0">
                  {[
                    { value: 1, label: '1 Month' },
                    { value: 3, label: '3 Months (5% OFF)' },
                    { value: 6, label: '6 Months (10% OFF)' },
                    { value: 12, label: '12 Months (20% OFF)' },
                  ].map((dur) => (
                    <button
                      key={dur.value}
                      type="button"
                      onClick={() => setSelectedDuration(dur.value)}
                      className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                        selectedDuration === dur.value
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Promo Voucher Bar */}
              <div className="space-y-1.5 lg:w-96">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-400" />
                    Promo Voucher / Coupon
                  </span>
                  {appliedPromo && (
                    <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                      ACTIVE DISCOUNT
                    </span>
                  )}
                </div>

                {appliedPromo ? (
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 min-h-[44px]">
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
                          {appliedPromo.title || appliedPromo.message || 'Discount active across all tiers'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Remove promo code"
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
                          placeholder="Promo code (e.g. DIWALI50)..."
                          disabled={isApplyingPromo}
                          className="w-full pl-8 pr-7 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 font-mono uppercase tracking-wider focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/40 disabled:opacity-50 transition-all min-h-[44px]"
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
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800 text-white text-xs font-semibold rounded-xl border border-blue-500/30 transition-all flex items-center justify-center gap-1.5 shadow-sm min-h-[44px] shrink-0 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isApplyingPromo ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Applying...</span>
                          </>
                        ) : (
                          <>
                            <Tag className="w-3.5 h-3.5" />
                            <span>Apply</span>
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
                        <span className="text-[10px] text-slate-400">Campaigns:</span>
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
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer min-h-[28px]"
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

          {/* 3. Plan Cards Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, index) => {
              const isPro = plan.code?.toUpperCase() === 'PROFESSIONAL';
              const isCurrentActive =
                activeDbSub && String(activeDbSub.planId) === String(plan._id) && !isExpired;

              const calc = calculatePlanNetPayable(plan);

              return (
                <div
                  key={plan._id}
                  className={`relative bg-slate-900/70 rounded-2xl border ${
                    isCurrentActive
                      ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                      : isPro
                      ? 'border-blue-500/50 shadow-lg shadow-blue-500/5'
                      : 'border-slate-800'
                  } p-6 flex flex-col justify-between`}
                >
                  {isPro && !isCurrentActive && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                      RECOMMENDED
                    </div>
                  )}
                  {isCurrentActive && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                      CURRENT ACTIVE
                    </div>
                  )}

                  <div>
                    {/* Plan Title & Subtitle */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-slate-100 mb-1">{plan.name}</h3>
                      <p className="text-xs text-slate-400 min-h-[34px]">{plan.description}</p>
                    </div>

                    {/* Price Block */}
                    <div className="mb-5 pb-5 border-b border-slate-800/80">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight">
                          ₹{formatCurrency(calc.monthlyEquivalent)}
                        </span>
                        <span className="text-slate-400 text-xs">/mo</span>
                        {calc.totalSavings > 0 && (
                          <span className="text-xs text-slate-500 line-through font-mono">
                            ₹{formatCurrency(plan.baseMonthlyPrice)}/mo
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 space-y-0.5">
                        <p className="text-[11px] text-slate-400 font-mono">
                          ₹{formatCurrency(calc.finalPrice)} total for {selectedDuration} month
                          {selectedDuration > 1 ? 's' : ''}
                        </p>

                        {appliedPromo && calc.voucherDiscountAmount > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <Tag className="w-3 h-3" />
                            <span>
                              {appliedPromo.promoCode} applied: -₹{formatCurrency(calc.voucherDiscountAmount)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button: Opens SubmitPaymentProofModal (NO mailto links) */}
                    <div className="mb-6">
                      <button
                        type="button"
                        onClick={() => handleOpenProofModal(plan)}
                        className={`w-full py-2.5 rounded-xl font-semibold transition-all flex justify-center items-center gap-2 text-xs cursor-pointer min-h-[44px] shadow-sm ${
                          isCurrentActive
                            ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-500/20'
                            : isPro
                            ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-500/20'
                            : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {isCurrentActive ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Renew Tier (via Bank / UPI)</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-4 h-4" />
                            <span>Upgrade to {plan.name} (via Bank / UPI)</span>
                          </>
                        )}
                      </button>
                      <p className="text-[10px] text-slate-400 text-center mt-1.5">
                        Transfer ₹{formatCurrency(calc.finalPrice)} via NEFT/UPI & submit UTR
                      </p>
                    </div>

                    {/* Feature Diff Checklist */}
                    <div className="space-y-2.5">
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
                                    className={`mt-0.5 p-0.5 rounded-full shrink-0 ${
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
                                  <span className="text-xs text-slate-300 leading-tight">{label}</span>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. Official Platform Bank & UPI Transfer Details Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-md space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Official Platform Bank & UPI Settlement Coordinates
                  </h3>
                  <p className="text-xs text-slate-400">
                    Direct transfer accounts managed by Bharat Enterprise Technologies Pvt Ltd
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  VERIFIED CURRENT A/C
                </span>
              </div>
            </div>

            {/* Bank vs Instant UPI 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Bank Transfer (NEFT / RTGS / IMPS) */}
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>Bank Transfer (NEFT / RTGS / IMPS)</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Bank Name:</span>
                    <span className="text-slate-200 font-semibold">{OFFICIAL_BANK.bankName}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Account Name:</span>
                    <span className="text-slate-200 font-semibold text-right max-w-[220px] truncate">
                      {OFFICIAL_BANK.accountName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Account Number:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-100 text-sm">
                        {OFFICIAL_BANK.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(OFFICIAL_BANK.accountNumber, 'Account number')}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                        title="Copy Account Number"
                        aria-label="Copy Account Number"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">IFSC Code:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-100 text-sm">
                        {OFFICIAL_BANK.ifscCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(OFFICIAL_BANK.ifscCode, 'IFSC code')}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                        title="Copy IFSC Code"
                        aria-label="Copy IFSC Code"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Account Type:</span>
                    <span className="text-slate-300 font-medium">{OFFICIAL_BANK.accountType}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400">Branch:</span>
                    <span className="text-slate-300 font-medium">{OFFICIAL_BANK.branch}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Instant UPI Transfer */}
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>Instant UPI Payment</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                        Official Corporate UPI ID
                      </span>
                      <span className="font-mono font-bold text-slate-100 text-xs sm:text-sm">
                        {OFFICIAL_BANK.upiId}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(OFFICIAL_BANK.upiId, 'UPI ID')}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy UPI ID"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  </div>

                  {/* High-Trust Step Instructions */}
                  <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 text-xs space-y-1.5">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                      Fast 3-Step Verification Flow:
                    </span>
                    <ol className="text-slate-300 text-[11px] space-y-1 list-decimal list-inside leading-snug">
                      <li>Transfer exact plan total via NEFT / RTGS / IMPS or Instant UPI.</li>
                      <li>Note the 12-digit UTR or Transaction Reference number.</li>
                      <li>Click &ldquo;Submit Payment Proof / UTR&rdquo; below to notify accounts.</li>
                    </ol>
                  </div>
                </div>

                {/* Direct Proof CTA */}
                <button
                  type="button"
                  onClick={() => handleOpenProofModal()}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit Payment Proof / UTR</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── TAB 2: MY TAX INVOICES & RECEIPTS ───────────────────────── */}
      {activeTab === 'invoices' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 sm:space-y-8 will-change-[transform,opacity]"
        >
          {/* 1. Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Invoices Issued
              </span>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-100">
                {invoicesSummary.totalInvoices || invoices.length}
              </p>
              <p className="text-[11px] text-slate-400">Statutory GST Rule 46 B2B Invoices</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total SaaS Spend
              </span>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
                ₹{formatCurrency(invoicesSummary.totalSpend)}
              </p>
              <p className="text-[11px] text-slate-400">Paid & reconciled subscription totals</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total GST ITC Claimable
              </span>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-cyan-400">
                ₹{formatCurrency(invoicesSummary.totalITC)}
              </p>
              <p className="text-[11px] text-slate-400">18% Input Tax Credit on SAC 998313</p>
            </div>
          </div>

          {/* 2. Search & Filter Bar */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                placeholder="Search by invoice number, plan tier, or UTR..."
                className="w-full pl-9 pr-8 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
              {invoiceSearchQuery && (
                <button
                  type="button"
                  onClick={() => setInvoiceSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-blue-500 min-h-[44px]"
              >
                <option value="ALL">All Financial Years</option>
                <option value="26-27">FY 2026-27</option>
                <option value="25-26">FY 2025-26</option>
              </select>
            </div>
          </div>

          {/* 3. High-Density Invoices Table or Empty State */}
          {filteredInvoices.length > 0 ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Plan Tier</th>
                      <th className="py-3 px-3 text-center">SAC</th>
                      <th className="py-3 px-3 text-right">Taxable (₹)</th>
                      <th className="py-3 px-3 text-right">GST (18%)</th>
                      <th className="py-3 px-4 text-right">Total (₹)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv._id || inv.invoiceNumber}
                        className="hover:bg-slate-850/60 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-100 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{inv.invoiceNumber}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-slate-300 whitespace-nowrap">
                          {inv.invoiceDate
                            ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                            {inv.planName || 'Professional'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono text-slate-400">
                          {inv.sacCode || '998313'}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          ₹{formatCurrency(inv.taxableAmount)}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-cyan-400">
                          ₹{formatCurrency(inv.totalTax || (inv.cgstAmount + inv.sgstAmount + inv.igstAmount))}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                          ₹{formatCurrency(inv.totalAmount)}
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            {inv.status || 'ISSUED'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewInvoice(inv)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1 cursor-pointer min-h-[36px]"
                              title="View GST Tax Invoice"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleViewInvoice(inv)}
                              className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="Print or Save PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Clean Empty State */
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-400">
                <Receipt className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">No Tax Invoices Issued Yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Tax invoices are generated automatically when offline payments or subscriptions are approved. Once verified, your statutory GST B2B tax invoices with SAC 998313 and input tax credit breakdown will appear here.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleTabChange('plans')}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <Layers className="w-4 h-4" />
                  <span>View Subscription Plans</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ─── MODALS ──────────────────────────────────────────────────── */}
      {/* 1. Offline Payment Proof Modal */}
      <SubmitPaymentProofModal
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
        initialPlan={selectedPlanForProof}
        initialDuration={selectedDurationForProof}
        initialAmount={selectedAmountForProof}
        appliedPromo={appliedPromo}
        onSuccess={() => {
          refetchPendingRequest();
          queryClient.invalidateQueries({ queryKey: ['saas-subscription'] });
          queryClient.invalidateQueries({ queryKey: ['saas-subscription-invoices'] });
        }}
      />

      {/* 2. Statutory GST Tax Invoice Modal */}
      <TenantInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoice={selectedInvoiceForModal}
      />
    </div>
  );
}
