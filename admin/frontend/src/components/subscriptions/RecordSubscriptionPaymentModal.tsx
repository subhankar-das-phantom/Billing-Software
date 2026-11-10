/**
 * Bharat Enterprise Billing System — Platform Subscription Payment & Renewal Modal
 * Allows Platform Admins to record offline payments, renew active subscriptions,
 * execute plan upgrades/switches, preview co-terminous tenure stacking,
 * and issue statutory B2B GST tax invoices with mandatory audit justification.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  X,
  AlertCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Modal from '../common/Modal';
import api from '../../services/api';
import type {
  SaaSPlan,
  PlatformPaymentMode,
  RecordPaymentPayload,
} from '../../types';

export interface RecordSubscriptionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: {
    _id: string;
    tenantId: string;
    planId?: string;
    status: string;
    expiresAt: string;
    tenant?: {
      _id?: string;
      firmName: string;
      email: string;
      firmGSTIN?: string;
      firmPhone?: string;
    } | null;
    plan?: {
      _id?: string;
      name: string;
      code: string;
      baseMonthlyPrice: number;
      features?: string[];
    } | null;
  } | null;
  onSuccess?: () => void;
}

const FALLBACK_PLANS: SaaSPlan[] = [
  {
    _id: 'plan_starter',
    name: 'Starter Plan',
    code: 'starter',
    description: 'Core billing and customer ledger essentials',
    baseMonthlyPrice: 499,
    features: ['INVOICE_CREATE', 'CUSTOMERS', 'PAYMENTS', 'COLLECTIONS'],
    active: true,
    displayOrder: 1,
  },
  {
    _id: 'plan_business',
    name: 'Business Suite',
    code: 'business',
    description: 'Advanced inventory intelligence, batch tracking & multi-store',
    baseMonthlyPrice: 1499,
    features: ['INVOICE_CREATE', 'CUSTOMERS', 'PRODUCTS', 'BATCHES', 'INVENTORY_LEDGER', 'PURCHASES'],
    active: true,
    displayOrder: 2,
  },
  {
    _id: 'plan_professional',
    name: 'Professional Enterprise',
    code: 'professional',
    description: 'Full statutory GST compliance, multi-user RBAC & audit logs',
    baseMonthlyPrice: 3499,
    features: ['INVOICE_CREATE', 'CUSTOMERS', 'PRODUCTS', 'BATCHES', 'GST_REPORTS', 'EMPLOYEES', 'ACTIVITY_LOGS'],
    active: true,
    displayOrder: 3,
  },
  {
    _id: 'plan_custom',
    name: 'Enterprise Custom',
    code: 'enterprise',
    description: 'Bespoke high-volume deployment with custom SLAs and bypass keys',
    baseMonthlyPrice: 7999,
    features: ['ALL_FEATURES', 'EMERGENCY_BYPASS', 'PRIORITY_SUPPORT'],
    active: true,
    displayOrder: 4,
  },
];

const DURATION_OPTIONS = [
  { label: '+1 Month', months: 1 },
  { label: '+3 Months', months: 3 },
  { label: '+6 Months', months: 6 },
  { label: '+1 Year', months: 12 },
  { label: 'Custom Date', months: 0 },
];

const PAYMENT_MODES: Array<{ value: PlatformPaymentMode; label: string }> = [
  { value: 'UPI', label: 'UPI / QR Payment' },
  { value: 'NEFT', label: 'NEFT Transfer' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'IMPS', label: 'IMPS (Instant)' },
  { value: 'CASH', label: 'Direct Cash' },
  { value: 'CHEQUE', label: 'Cheque / DD' },
];

const PLATFORM_STATE_CODE = '27'; // Maharashtra

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDateIST(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

export const RecordSubscriptionPaymentModal: React.FC<RecordSubscriptionPaymentModalProps> = ({
  isOpen,
  onClose,
  subscription,
  onSuccess,
}) => {
  // ─── Fetch Live Plans ─────────────────────────────────────────────
  const { data: plansData } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: async () => {
      try {
        const res = await api.get<{ success: boolean; data: SaaSPlan[] }>('/plans');
        return res.data.data;
      } catch {
        return FALLBACK_PLANS;
      }
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  const availablePlans = plansData && plansData.length > 0 ? plansData : FALLBACK_PLANS;

  // ─── Form State ───────────────────────────────────────────────────
  const [renewalMode, setRenewalMode] = useState<'renew' | 'switch'>('renew');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [durationMonths, setDurationMonths] = useState<number>(12); // Default to +1 Year
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('');

  // Commercials & Discounts
  const [discountAmount, setDiscountAmount] = useState<string>('0');

  // Payment Recording
  const [paymentMode, setPaymentMode] = useState<PlatformPaymentMode>('UPI');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('HDFC Bank - Current A/C');
  const [depositedAccount, setDepositedAccount] = useState<string>('Primary Operating A/C');
  const [paidDate, setPaidDate] = useState<string>(getTodayDateString());
  const [generateInvoice, setGenerateInvoice] = useState<boolean>(true);

  // Operational Reason
  const [reason, setReason] = useState<string>('');

  // UI States
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Synchronize state when modal opens
  useEffect(() => {
    if (isOpen && subscription) {
      setErrorBanner(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;

      setRenewalMode('renew');
      setSelectedPlanId(subscription.planId || subscription.plan?._id || '');
      setDurationMonths(12);

      // Default custom date to current expiry + 1 year
      const baseDate =
        subscription.expiresAt && new Date(subscription.expiresAt) > new Date()
          ? new Date(subscription.expiresAt)
          : new Date();
      baseDate.setFullYear(baseDate.getFullYear() + 1);
      setCustomExpiryDate(baseDate.toISOString().split('T')[0] ?? '');

      setDiscountAmount('0');
      setPaymentMode('UPI');
      setUtrNumber('');
      setBankName('HDFC Bank - Current A/C');
      setDepositedAccount('Primary Operating A/C');
      setPaidDate(getTodayDateString());
      setGenerateInvoice(true);
      setReason('');
    }
  }, [isOpen, subscription]);

  // Active Target Plan (either current plan or selected upgrade)
  const activePlan = useMemo(() => {
    if (renewalMode === 'renew') {
      return (
        subscription?.plan ||
        availablePlans.find((p) => p._id === subscription?.planId) ||
        availablePlans[0]
      );
    }
    return availablePlans.find((p) => p._id === selectedPlanId) || availablePlans[0];
  }, [renewalMode, selectedPlanId, subscription, availablePlans]);

  // Co-terminous Stacking Calculation:
  // If current expiry is in future, stack on top of current expiry; otherwise stack from today.
  const stackingPreview = useMemo(() => {
    if (!subscription) {
      return { currentExpiryFormatted: 'N/A', newExpiryDate: '', newExpiryFormatted: 'N/A', daysAdded: 0 };
    }

    const currentExpiry = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
    const now = new Date();
    const isCurrentActive = currentExpiry && !isNaN(currentExpiry.getTime()) && currentExpiry > now;
    const anchorDate = isCurrentActive ? new Date(currentExpiry.getTime()) : new Date();

    let newDate: Date;
    if (durationMonths > 0) {
      newDate = new Date(anchorDate.getTime());
      newDate.setMonth(newDate.getMonth() + durationMonths);
    } else if (customExpiryDate) {
      newDate = new Date(customExpiryDate);
    } else {
      newDate = new Date(anchorDate.getTime());
    }

    const daysAdded = Math.max(
      0,
      Math.ceil((newDate.getTime() - (currentExpiry?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24))
    );

    return {
      currentExpiryFormatted: formatDateIST(subscription.expiresAt),
      newExpiryDate: newDate.toISOString().split('T')[0],
      newExpiryFormatted: formatDateIST(newDate.toISOString()),
      daysAdded,
    };
  }, [subscription, durationMonths, customExpiryDate]);

  // Commercials & GST Breakdown Calculation
  const financials = useMemo(() => {
    const monthlyRate = activePlan?.baseMonthlyPrice || 0;
    const effectiveMonths = durationMonths > 0 ? durationMonths : Math.max(1, Math.round(stackingPreview.daysAdded / 30));
    const baseAmount = monthlyRate * effectiveMonths;

    const discount = Math.max(0, parseFloat(discountAmount) || 0);
    const netTaxable = Math.max(0, baseAmount - discount);

    const tenantGstin = subscription?.tenant?.firmGSTIN?.trim().toUpperCase() || '';
    const tenantStateCode = tenantGstin.length >= 2 ? tenantGstin.slice(0, 2) : '';
    const isIntraState = tenantStateCode === PLATFORM_STATE_CODE;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalGst = 0;

    if (isIntraState) {
      cgst = Math.round(netTaxable * 0.09 * 100) / 100;
      sgst = Math.round(netTaxable * 0.09 * 100) / 100;
      totalGst = cgst + sgst;
    } else {
      igst = Math.round(netTaxable * 0.18 * 100) / 100;
      totalGst = igst;
    }

    const totalAmount = Math.round((netTaxable + totalGst) * 100) / 100;

    return {
      monthlyRate,
      effectiveMonths,
      baseAmount,
      discount,
      netTaxable,
      isIntraState,
      cgst,
      sgst,
      igst,
      totalGst,
      totalAmount,
    };
  }, [activePlan, durationMonths, stackingPreview.daysAdded, discountAmount, subscription]);

  // ─── Submit Payment & Renewal ─────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (isSubmittingRef.current || !subscription) return;

    // Validation
    const isElectronic = ['UPI', 'NEFT', 'RTGS', 'IMPS'].includes(paymentMode);
    if (isElectronic && !utrNumber.trim()) {
      setErrorBanner(`UTR / Reference Number is required for ${paymentMode} transactions.`);
      return;
    }

    if (reason.trim().length < 10) {
      setErrorBanner('Operational reason is required and must be at least 10 characters.');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);

      const payload: RecordPaymentPayload = {
        subscriptionId: subscription._id,
        tenantId: subscription.tenantId,
        mode: renewalMode,
        targetPlanId: activePlan?._id,
        durationMonths: durationMonths > 0 ? durationMonths : undefined,
        customExpiresAt: stackingPreview.newExpiryDate,
        baseAmount: financials.baseAmount,
        discountAmount: financials.discount,
        netTaxable: financials.netTaxable,
        gstAmount: financials.totalGst,
        totalAmount: financials.totalAmount,
        paymentMode,
        utrNumber: utrNumber.trim(),
        bankName: bankName.trim(),
        depositedAccount: depositedAccount.trim(),
        paidDate,
        generateInvoice,
        reason: reason.trim(),
      };

      // Attempt to hit the subscription record-payment endpoint
      try {
        await api.post(`/subscriptions/${subscription._id}/record-payment`, payload);
      } catch (subErr: any) {
        if (subErr?.response?.status === 404) {
          // Fallback to top-level activate or adjust endpoint
          await api.post('/subscriptions/activate', {
            tenantId: subscription.tenantId,
            planId: activePlan?._id,
            durationMonths: financials.effectiveMonths,
            reason: `${reason.trim()} [Offline ${paymentMode} Ref: ${utrNumber.trim()}]`,
          });
        } else {
          throw subErr;
        }
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to record payment and renewal. Please check the provided details.';
      setErrorBanner(msg);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  if (!subscription) return null;

  const isFormValid =
    reason.trim().length >= 10 &&
    (!['UPI', 'NEFT', 'RTGS', 'IMPS'].includes(paymentMode) || utrNumber.trim().length > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100 tracking-tight">
              Record Offline Payment & Subscription Renewal
            </h3>
            <p className="text-xs text-slate-400">
              Reconcile offline revenue, stack co-terminous tenure, and emit statutory tax invoice
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error Alert Banner */}
        {errorBanner && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs leading-relaxed animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorBanner}</div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-rose-400 hover:text-rose-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Contextual Tenant & Subscription Snapshot Header ──────── */}
        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100 text-sm truncate">
                  {subscription.tenant?.firmName || 'Tenant Account'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {subscription.plan?.name || 'Active Tier'}
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate mt-0.5">
                {subscription.tenant?.email}
                {subscription.tenant?.firmGSTIN && ` • GSTIN: ${subscription.tenant.firmGSTIN}`}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Current Expiry</div>
            <div className="text-xs font-semibold text-slate-200 font-mono mt-0.5">
              {stackingPreview.currentExpiryFormatted}
            </div>
          </div>
        </div>

        {/* ── Mode Toggle: Renew vs Switch Plan ─────────────────────── */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setRenewalMode('renew')}
            className={`py-2 rounded-lg text-xs font-semibold transition-all ${
              renewalMode === 'renew'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Renew Current Plan ({subscription.plan?.name || 'Same Tier'})
          </button>
          <button
            type="button"
            onClick={() => setRenewalMode('switch')}
            className={`py-2 rounded-lg text-xs font-semibold transition-all ${
              renewalMode === 'switch'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Switch / Upgrade Plan Tier
          </button>
        </div>

        {/* Switch Plan Selector (if mode is switch) */}
        {renewalMode === 'switch' && (
          <div className="space-y-1.5 animate-in fade-in duration-150">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Select Target Plan Tier
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {availablePlans.map((p) => {
                const isSelected = selectedPlanId === p._id;
                return (
                  <div
                    key={p._id}
                    onClick={() => setSelectedPlanId(p._id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500/80 bg-blue-600/10 ring-1 ring-blue-500/50 shadow-xs'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-200 truncate">{p.name}</div>
                    <div className="text-sm font-bold text-slate-100 font-mono mt-1">
                      {formatCurrency(p.baseMonthlyPrice)}
                      <span className="text-[10px] text-slate-400 ml-0.5">/mo</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Duration Picker & Co-terminous Stacking Preview ────────── */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Renewal Tenure Duration
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.label}
                onClick={() => setDurationMonths(opt.months)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  durationMonths === opt.months
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {durationMonths === 0 && (
            <div className="pt-1">
              <input
                type="date"
                value={customExpiryDate}
                min={getTodayDateString()}
                onChange={(e) => setCustomExpiryDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
              />
            </div>
          )}

          {/* Co-terminous Stacking Ribbon */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="truncate">
                <span className="text-slate-400">Co-terminous Stacking: </span>
                <span className="font-semibold text-slate-200 font-mono">
                  {stackingPreview.currentExpiryFormatted}
                </span>
                <span className="text-blue-400 mx-1.5">➔</span>
                <span className="font-bold text-blue-300 font-mono">
                  {stackingPreview.newExpiryFormatted}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 shrink-0">
              +{stackingPreview.daysAdded} days
            </span>
          </div>
        </div>

        {/* ── Commercials, Discount & GST Calculation ───────────────── */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Base Amount ({financials.effectiveMonths} mo @ {formatCurrency(financials.monthlyRate)})
              </label>
              <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-semibold text-slate-200">
                {formatCurrency(financials.baseAmount)}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Discount / Waiver (₹)
              </label>
              <input
                type="number"
                value={discountAmount}
                min="0"
                step="0.01"
                onChange={(e) => setDiscountAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500/80"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Net Taxable Amount
              </label>
              <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-semibold text-slate-200">
                {formatCurrency(financials.netTaxable)}
              </div>
            </div>
          </div>

          {/* GST breakdown row */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-slate-400 font-sans">
              Statutory 18% GST ({financials.isIntraState ? 'CGST 9% + SGST 9%' : 'IGST 18%'}):
            </span>
            <span className="text-slate-200 font-semibold">{formatCurrency(financials.totalGst)}</span>
            <div className="w-full sm:w-auto text-right">
              <span className="text-slate-400 font-sans mr-2">Grand Total Payable:</span>
              <span className="text-emerald-400 font-bold text-sm">
                {formatCurrency(financials.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Payment Details ───────────────────────────────────────── */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Payment Settlement Details
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Payment Mode <span className="text-rose-400">*</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PlatformPaymentMode)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                UTR / Reference #{' '}
                {['UPI', 'NEFT', 'RTGS', 'IMPS'].includes(paymentMode) && (
                  <span className="text-rose-400">*</span>
                )}
              </label>
              <input
                type="text"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="e.g. UTR12345678"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500/80"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Clearing Bank
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Payment Date
              </label>
              <input
                type="date"
                value={paidDate}
                max={getTodayDateString()}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-200">
                Generate Statutory B2B GST Tax Invoice (PlatformInvoice)
              </div>
              <div className="text-[10px] text-slate-400">
                Issues canonical SAC 998313 invoice into the tenant's legal billing ledger
              </div>
            </div>
            <input
              type="checkbox"
              checked={generateInvoice}
              onChange={(e) => setGenerateInvoice(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-700 bg-slate-800 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>

        {/* ── Operational Reason ─────────────────────────────────────── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Operational Justification <span className="text-rose-400">*</span>
            </label>
            <span
              className={`text-[11px] font-mono ${
                reason.trim().length >= 10 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {reason.trim().length} / 10 min chars
            </span>
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="State UTR confirmation, physical payment receipt reference, or commercial agreement details..."
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 leading-relaxed"
          />
        </div>

        {/* ── Actions Footer ────────────────────────────────────────── */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors min-h-[44px]"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Recording Payment...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Record Renewal</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RecordSubscriptionPaymentModal;
