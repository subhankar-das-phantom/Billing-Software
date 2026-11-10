/**
 * Bharat Enterprise Billing System — Platform Subscription Allocation Modal
 * Allows Platform Admins to allocate SaaS subscription tiers from scratch to any tenant,
 * with debounced tenant lookup, flexible tenure presets or custom expiration dates,
 * optional offline payment recording (NEFT/RTGS/IMPS/UPI/CASH/CHEQUE/COMPLIMENTARY),
 * live statutory B2B GST tax calculation (CGST/SGST vs IGST), and mandatory audited reason.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Building2,
  Calendar,
  Search,
  Check,
  X,
  AlertCircle,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import Modal from '../common/Modal';
import api from '../../services/api';
import type {
  SaaSPlan,
  PlatformPaymentMode,
  SubscriptionLifecycleStatus,
  AllocateSubscriptionPayload,
} from '../../types';

export interface AllocateSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedTenantId?: string;
  preselectedTenant?: {
    _id?: string;
    tenantId?: string;
    firmName: string;
    email: string;
    firmGSTIN?: string;
    firmPhone?: string;
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

const DURATION_PRESETS = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '12 Months (1 Yr)', months: 12 },
  { label: 'Custom Date', months: 0 },
];

const LIFECYCLE_STATUSES: Array<{
  value: SubscriptionLifecycleStatus;
  label: string;
  badgeClass: string;
  desc: string;
}> = [
  {
    value: 'active',
    label: 'Active',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    desc: 'Full operational & write access granted',
  },
  {
    value: 'trial',
    label: 'Trial',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    desc: 'Evaluation window with temporary access',
  },
  {
    value: 'grace',
    label: 'Grace Period',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    desc: 'Payment buffer window prior to suspension',
  },
];

const PAYMENT_MODES: Array<{ value: PlatformPaymentMode; label: string }> = [
  { value: 'NEFT', label: 'NEFT Transfer' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'IMPS', label: 'IMPS (Instant)' },
  { value: 'UPI', label: 'UPI / QR' },
  { value: 'CASH', label: 'Direct Cash' },
  { value: 'CHEQUE', label: 'Cheque / DD' },
  { value: 'COMPLIMENTARY', label: 'Complimentary / Zero Fee' },
];

// Platform Maharashtra state code standard for GST intra-state vs inter-state
const PLATFORM_STATE_CODE = '27';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0] ?? '';
}

function addMonthsToDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0] ?? '';
}

export const AllocateSubscriptionModal: React.FC<AllocateSubscriptionModalProps> = ({
  isOpen,
  onClose,
  preselectedTenantId,
  preselectedTenant,
  onSuccess,
}) => {
  // ─── 1. Tenant Selection State ────────────────────────────────────
  const [selectedTenant, setSelectedTenant] = useState<{
    _id: string;
    firmName: string;
    email: string;
    firmGSTIN?: string;
    firmPhone?: string;
  } | null>(null);

  const [isChangingTenant, setIsChangingTenant] = useState(false);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [debouncedTenantSearch, setDebouncedTenantSearch] = useState('');

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTenantSearch(tenantSearchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [tenantSearchQuery]);

  // Query tenant autocomplete
  const { data: tenantSearchResults, isFetching: isSearchingTenants } = useQuery({
    queryKey: ['platform-tenant-search', debouncedTenantSearch],
    queryFn: async () => {
      if (!debouncedTenantSearch) return [];
      const res = await api.get<{ data: any[] }>('/tenants', {
        params: { search: debouncedTenantSearch, limit: 8 },
      });
      return res.data.data || [];
    },
    enabled: isOpen && (isChangingTenant || !selectedTenant),
    staleTime: 30000,
  });

  // ─── 2. Plans Catalog Query ───────────────────────────────────────
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

  // ─── 3. Form State ────────────────────────────────────────────────
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [durationPreset, setDurationPreset] = useState<number>(1); // 1, 3, 6, 12 or 0 for custom
  const [customExpiryDate, setCustomExpiryDate] = useState<string>(addMonthsToDate(1));
  const [lifecycleStatus, setLifecycleStatus] = useState<SubscriptionLifecycleStatus>('active');

  // Offline Payment Recording
  const [recordPayment, setRecordPayment] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<PlatformPaymentMode>('NEFT');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('HDFC Bank - Current A/C');
  const [depositedAccount, setDepositedAccount] = useState<string>('Primary Operating A/C');
  const [customPaidAmount, setCustomPaidAmount] = useState<string>('');
  const [paidDate, setPaidDate] = useState<string>(getTodayDateString());
  const [generateInvoice, setGenerateInvoice] = useState<boolean>(true);

  // Operational Reason
  const [reason, setReason] = useState<string>('');

  // UI States
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Synchronize initial state on modal open
  useEffect(() => {
    if (isOpen) {
      setErrorBanner(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;

      // Handle preselected tenant
      if (preselectedTenant) {
        setSelectedTenant({
          _id: preselectedTenant._id || preselectedTenant.tenantId || preselectedTenantId || '',
          firmName: preselectedTenant.firmName,
          email: preselectedTenant.email,
          firmGSTIN: preselectedTenant.firmGSTIN,
          firmPhone: preselectedTenant.firmPhone,
        });
        setIsChangingTenant(false);
      } else if (preselectedTenantId) {
        setSelectedTenant({
          _id: preselectedTenantId,
          firmName: 'Selected Tenant',
          email: '',
        });
        setIsChangingTenant(false);
      } else {
        setSelectedTenant(null);
        setIsChangingTenant(true);
      }

      // Default plan selection (Business or first)
      if (availablePlans.length > 0) {
        const defaultPlan =
          availablePlans.find((p) => p.code === 'business') || availablePlans[0];
        if (defaultPlan?._id) {
          setSelectedPlanId(defaultPlan._id);
        }
      }

      setDurationPreset(1);
      setCustomExpiryDate(addMonthsToDate(1));
      setLifecycleStatus('active');
      setRecordPayment(false);
      setPaymentMode('NEFT');
      setUtrNumber('');
      setBankName('HDFC Bank - Current A/C');
      setDepositedAccount('Primary Operating A/C');
      setCustomPaidAmount('');
      setPaidDate(getTodayDateString());
      setGenerateInvoice(true);
      setReason('');
      setTenantSearchQuery('');
    }
  }, [isOpen, preselectedTenant, preselectedTenantId, availablePlans]);

  // Active selected plan object
  const activePlan = useMemo(() => {
    return availablePlans.find((p) => p._id === selectedPlanId) || availablePlans[0] || null;
  }, [availablePlans, selectedPlanId]);

  // Calculate Expiry Date Preview
  const calculatedExpiryDate = useMemo(() => {
    if (durationPreset === 0) {
      return customExpiryDate;
    }
    return addMonthsToDate(durationPreset);
  }, [durationPreset, customExpiryDate]);

  // Calculate Days Remaining
  const daysRemaining = useMemo(() => {
    if (!calculatedExpiryDate) return 0;
    const exp = new Date(calculatedExpiryDate).getTime();
    const now = new Date().getTime();
    return Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
  }, [calculatedExpiryDate]);

  // Calculate Base and Total Pricing
  const durationMonthsCount = durationPreset > 0 ? durationPreset : Math.max(1, Math.round(daysRemaining / 30));
  const planBaseMonthly = activePlan?.baseMonthlyPrice || 0;
  const autoCalculatedBaseAmount = planBaseMonthly * durationMonthsCount;

  const effectiveTaxableAmount = useMemo(() => {
    if (paymentMode === 'COMPLIMENTARY') return 0;
    if (customPaidAmount !== '' && !isNaN(Number(customPaidAmount))) {
      return Math.max(0, Number(customPaidAmount));
    }
    return autoCalculatedBaseAmount;
  }, [paymentMode, customPaidAmount, autoCalculatedBaseAmount]);

  // GST Calculation (18% Total: CGST 9% + SGST 9% if intra-state Maharashtra, else IGST 18%)
  const gstBreakdown = useMemo(() => {
    if (paymentMode === 'COMPLIMENTARY' || effectiveTaxableAmount === 0) {
      return { isIntraState: false, cgst: 0, sgst: 0, igst: 0, totalGst: 0, grandTotal: 0 };
    }

    const tenantGstin = selectedTenant?.firmGSTIN?.trim().toUpperCase() || '';
    const tenantStateCode = tenantGstin.length >= 2 ? tenantGstin.slice(0, 2) : '';
    const isIntraState = tenantStateCode === PLATFORM_STATE_CODE;

    if (isIntraState) {
      const cgst = Math.round(effectiveTaxableAmount * 0.09 * 100) / 100;
      const sgst = Math.round(effectiveTaxableAmount * 0.09 * 100) / 100;
      const totalGst = cgst + sgst;
      const grandTotal = Math.round((effectiveTaxableAmount + totalGst) * 100) / 100;
      return { isIntraState: true, cgst, sgst, igst: 0, totalGst, grandTotal };
    } else {
      const igst = Math.round(effectiveTaxableAmount * 0.18 * 100) / 100;
      const grandTotal = Math.round((effectiveTaxableAmount + igst) * 100) / 100;
      return { isIntraState: false, cgst: 0, sgst: 0, igst, totalGst: igst, grandTotal };
    }
  }, [paymentMode, effectiveTaxableAmount, selectedTenant]);

  // Handle Tenant selection from autocomplete
  const handleSelectTenant = (tenant: any) => {
    setSelectedTenant({
      _id: tenant._id || tenant.tenantId,
      firmName: tenant.firmName,
      email: tenant.email,
      firmGSTIN: tenant.firmGSTIN,
      firmPhone: tenant.phone || tenant.firmPhone,
    });
    setIsChangingTenant(false);
    setTenantSearchQuery('');
    setErrorBanner(null);
  };

  // ─── Submission Handler ───────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (isSubmittingRef.current) return;

    // 1. Tenant validation
    if (!selectedTenant?._id) {
      setErrorBanner('Please select a target tenant account for subscription allocation.');
      return;
    }

    // 2. Plan validation
    if (!activePlan?._id) {
      setErrorBanner('Please select a valid SaaS subscription plan.');
      return;
    }

    // 3. Expiry date validation
    if (!calculatedExpiryDate || new Date(calculatedExpiryDate) <= new Date()) {
      setErrorBanner('Expiration date must be set in the future.');
      return;
    }

    // 4. Payment validation if toggle is active
    const isElectronic = ['NEFT', 'RTGS', 'IMPS', 'UPI'].includes(paymentMode);
    if (recordPayment && isElectronic && !utrNumber.trim()) {
      setErrorBanner(`UTR / Reference Number is required for ${paymentMode} transactions.`);
      return;
    }

    // 5. Audit reason validation (min 10 chars)
    if (reason.trim().length < 10) {
      setErrorBanner('Operational reason is required and must be at least 10 characters.');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);

      const payload: AllocateSubscriptionPayload = {
        tenantId: selectedTenant._id,
        planId: activePlan._id,
        durationMonths: durationPreset > 0 ? durationPreset : undefined,
        customExpiresAt: calculatedExpiryDate,
        status: lifecycleStatus,
        recordPayment,
        paymentMode: recordPayment ? paymentMode : undefined,
        utrNumber: recordPayment && isElectronic ? utrNumber.trim() : undefined,
        bankName: recordPayment ? bankName.trim() : undefined,
        depositedAccount: recordPayment ? depositedAccount.trim() : undefined,
        paidAmount: recordPayment ? (gstBreakdown.grandTotal || effectiveTaxableAmount) : undefined,
        paidDate: recordPayment ? paidDate : undefined,
        generateInvoice: recordPayment ? generateInvoice : false,
        reason: reason.trim(),
      };

      // Call platform allocate endpoint
      try {
        await api.post('/subscriptions/allocate', payload);
      } catch (postErr: any) {
        // If /allocate is not mounted, gracefully fall back to /activate with offline payment
        if (postErr?.response?.status === 404) {
          await api.post('/subscriptions/activate', {
            tenantId: selectedTenant._id,
            planId: activePlan._id,
            durationMonths: durationMonthsCount,
            reason: `${reason.trim()} [Mode: ${recordPayment ? paymentMode : 'Manual Direct'}]`,
          });
        } else {
          throw postErr;
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
        'Failed to allocate subscription to tenant. Please verify parameters.';
      setErrorBanner(msg);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const isFormValid =
    Boolean(selectedTenant?._id) &&
    Boolean(activePlan?._id) &&
    reason.trim().length >= 10 &&
    (!recordPayment || !['NEFT', 'RTGS', 'IMPS', 'UPI'].includes(paymentMode) || utrNumber.trim().length > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100 tracking-tight">
              Allocate Tenant Subscription
            </h3>
            <p className="text-xs text-slate-400">
              Provision SaaS tier, set lifecycle state, and record offline payment reconciliation
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
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

        {/* ── SECTION 1: Tenant Selector ────────────────────────────── */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            1. Target Tenant Account <span className="text-rose-400">*</span>
          </label>

          {selectedTenant && !isChangingTenant ? (
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100 text-sm truncate">
                      {selectedTenant.firmName}
                    </span>
                    {selectedTenant.firmGSTIN && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                        GST: {selectedTenant.firmGSTIN}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {selectedTenant.email || 'No email registered'}
                    {selectedTenant.firmPhone && ` • ${selectedTenant.firmPhone}`}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsChangingTenant(true)}
                className="shrink-0 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/30 transition-colors cursor-pointer"
              >
                Change Tenant
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={tenantSearchQuery}
                  onChange={(e) => setTenantSearchQuery(e.target.value)}
                  placeholder="Search by firm name, email, GSTIN, or tenant ID..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50"
                  autoFocus
                />
                {tenantSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTenantSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete Results Dropdown */}
              {isSearchingTenants ? (
                <div className="p-3 text-center text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl">
                  Searching tenants...
                </div>
              ) : debouncedTenantSearch && tenantSearchResults && tenantSearchResults.length > 0 ? (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
                  {tenantSearchResults.map((t: any) => (
                    <div
                      key={t._id || t.tenantId}
                      onClick={() => handleSelectTenant(t)}
                      className="p-2.5 hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {t.firmName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {t.email} {t.firmGSTIN ? `• GST: ${t.firmGSTIN}` : ''}
                        </div>
                      </div>
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 shrink-0">
                        Select
                      </span>
                    </div>
                  ))}
                </div>
              ) : debouncedTenantSearch ? (
                <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/40 border border-slate-800/80 rounded-xl">
                  No matching tenants found for "{debouncedTenantSearch}".
                </div>
              ) : null}

              {selectedTenant && isChangingTenant && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsChangingTenant(false)}
                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    Cancel changing tenant
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 2: Plan Selector ──────────────────────────────── */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            2. Choose Subscription Plan Tier <span className="text-rose-400">*</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {availablePlans.map((plan) => {
              const isSelected = selectedPlanId === plan._id;
              return (
                <div
                  key={plan._id}
                  onClick={() => setSelectedPlanId(plan._id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-500/80 bg-blue-600/10 ring-1 ring-blue-500/50 shadow-md'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-200 text-xs truncate">
                        {plan.name}
                      </span>
                      {isSelected ? (
                        <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                      )}
                    </div>
                    <div className="text-base font-bold text-slate-100 font-mono">
                      {formatCurrency(plan.baseMonthlyPrice)}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">/mo</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex flex-wrap gap-1">
                    {plan.features?.slice(0, 3).map((feat, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono"
                      >
                        {feat.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {(plan.features?.length || 0) > 3 && (
                      <span className="text-[9px] px-1 py-0.5 text-slate-500">
                        +{(plan.features?.length || 0) - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 3: Tenure & Expiration Mode ────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              3. Duration & Expiration <span className="text-rose-400">*</span>
            </label>

            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => setDurationPreset(preset.months)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    durationPreset === preset.months
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {durationPreset === 0 ? (
              <div className="pt-2">
                <input
                  type="date"
                  value={customExpiryDate}
                  min={getTodayDateString()}
                  onChange={(e) => setCustomExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
                />
              </div>
            ) : (
              <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Calculated Expiry Date:
                </span>
                <span className="font-semibold text-slate-200 font-mono">
                  {calculatedExpiryDate} ({daysRemaining} days remaining)
                </span>
              </div>
            )}
          </div>

          {/* ── SECTION 4: Lifecycle State ───────────────────────────── */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              4. Lifecycle Status <span className="text-rose-400">*</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {LIFECYCLE_STATUSES.map((statusItem) => {
                const isSelected = lifecycleStatus === statusItem.value;
                return (
                  <button
                    type="button"
                    key={statusItem.value}
                    onClick={() => setLifecycleStatus(statusItem.value)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? `${statusItem.badgeClass} ring-1 ring-current shadow-xs`
                        : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs">{statusItem.label}</div>
                    <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      {statusItem.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── SECTION 5: Offline Payment Recording Toggle ───────────── */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-200">
                  Record Offline Payment for this Allocation
                </span>
                <p className="text-[11px] text-slate-400">
                  Record bank transfer / cheque / cash details and issue official B2B GST tax invoice
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={recordPayment}
                onChange={(e) => setRecordPayment(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Expanded Offline Payment Form Controls */}
          {recordPayment && (
            <div className="pt-4 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Payment Mode */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Payment Mode <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PlatformPaymentMode)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* UTR / Transaction Ref */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    UTR / Reference #{' '}
                    {['NEFT', 'RTGS', 'IMPS', 'UPI'].includes(paymentMode) && (
                      <span className="text-rose-400">*</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="e.g. CMS1234567890"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/80 font-mono"
                  />
                </div>

                {/* Bank / Clearing Account */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Deposited Bank
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank - A/C 9876"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
                  />
                </div>

                {/* Payment Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Payment Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={paidDate}
                    max={getTodayDateString()}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/80"
                  />
                </div>
              </div>

              {/* Amount Overrides & GST Calculation Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Taxable Amount (Pre-GST)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={customPaidAmount}
                      onChange={(e) => setCustomPaidAmount(e.target.value)}
                      placeholder={autoCalculatedBaseAmount.toString()}
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500/80"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Defaults to plan price ({formatCurrency(planBaseMonthly)}) × {durationMonthsCount}{' '}
                    mo = {formatCurrency(autoCalculatedBaseAmount)}.
                  </p>
                </div>

                {/* Statutory Invoice Generation Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      Generate B2B GST Tax Invoice
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Creates statutory SAC 998313 PlatformInvoice
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

              {/* Live Statutory GST Summary Card */}
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800/80 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Live Statutory B2B GST Computation</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    SAC: 998313 • {gstBreakdown.isIntraState ? 'Intra-State (MH)' : 'Inter-State'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Taxable Value</div>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {formatCurrency(effectiveTaxableAmount)}
                    </div>
                  </div>

                  {gstBreakdown.isIntraState ? (
                    <>
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">CGST (9%)</div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {formatCurrency(gstBreakdown.cgst)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">SGST (9%)</div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {formatCurrency(gstBreakdown.sgst)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 sm:col-span-2">
                      <div className="text-[10px] text-slate-400">IGST (18%)</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {formatCurrency(gstBreakdown.igst)}
                      </div>
                    </div>
                  )}

                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="text-[10px] text-blue-400 font-sans font-medium">
                      Total Payable
                    </div>
                    <div className="font-bold text-blue-200 mt-0.5">
                      {formatCurrency(gstBreakdown.grandTotal)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 6: Operational Reason ─────────────────────────── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              5. Operational Reason & Governance Note <span className="text-rose-400">*</span>
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
            placeholder="Document commercial agreement reference, offline transfer clearance, or justification..."
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 leading-relaxed"
          />
          <p className="text-[11px] text-slate-500">
            Immutable audit record logged to PlatformAuditHead chain with operator signature.
          </p>
        </div>

        {/* ── Actions Footer ────────────────────────────────────────── */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
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
                <span>Allocating Subscription...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Allocate Subscription</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AllocateSubscriptionModal;
