/**
 * Bharat Enterprise Billing System — Platform Subscriptions & SaaS Governance
 * SaaS plan pricing tier matrix, manual tenure adjustments with role-based ceilings,
 * two-phase gateway payment reconciliation, animated MRR metrics with exact paise precision,
 * and high-density dual desktop table / mobile collapsible card views with 2x2 action matrix.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Sliders,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Check,
  Copy,
  X,
  Eye,
  TrendingUp,
  Building2,
  Calendar,
  Clock,
  Mail,
} from 'lucide-react';
import api from '../services/api';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import StatusBadge, { StatusVariant } from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import { Toast, ToastMessage } from '../components/common/Toast';
import CollapsibleMobileCard from '../components/common/CollapsibleMobileCard';
import AnimatedCounter from '../components/common/AnimatedCounter';
import SearchInput from '../components/common/SearchInput';
import { usePlatformAuth } from '../contexts/PlatformAuthContext';
import { useListFilterParams } from '../hooks/useListFilterParams';
import {
  PlatformRole,
  type SaaSPlan,
} from '../types';

// ─── Interfaces ───────────────────────────────────────────────────
interface SubscriptionRecord {
  _id: string;
  tenantId: string;
  planId?: string;
  status: string;
  startedAt: string;
  expiresAt: string;
  graceUntil: string;
  autoRenew: boolean;
  billingMode: string;
  daysRemaining: number;
  isGrace: boolean;
  tenant?: {
    _id: string;
    firmName: string;
    email: string;
    firmGSTIN?: string;
    firmPhone?: string;
    isActive: boolean;
  } | null;
  plan?: {
    _id: string;
    name: string;
    code: string;
    baseMonthlyPrice: number;
    features: string[];
  } | null;
}

interface SubscriptionsListResponse {
  success: boolean;
  data: SubscriptionRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PaymentReconciliationData {
  payment: {
    _id: string;
    tenantId: string;
    subscriptionId?: string;
    planId: string;
    durationMonths: number;
    baseAmount: number;
    discountAmount: number;
    finalAmount: number;
    paymentGateway: string;
    paymentStatus: string;
    gatewayPaymentId?: string;
    paidAt?: string;
    metadata?: Record<string, unknown>;
  };
  subscription: {
    _id: string;
    tenantId: string;
    planId: string;
    status: string;
    startedAt: string;
    expiresAt: string;
    graceUntil: string;
    autoRenew: boolean;
    billingMode: string;
  };
}

// ─── Helper: Format Date to IST ───────────────────────────────────
function formatISTDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatISTDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// Map subscription status to semantic badge variant
function getSubscriptionBadgeVariant(status?: string): StatusVariant {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'emerald';
    case 'trial':
    case 'grace':
      return 'amber';
    case 'suspended':
    case 'expired':
      return 'rose';
    default:
      return 'slate';
  }
}

function mapStatusToCardVariant(status?: string): 'default' | 'active' | 'warning' | 'danger' | 'neutral' {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'active';
    case 'trial':
    case 'grace':
      return 'warning';
    case 'suspended':
    case 'expired':
      return 'danger';
    default:
      return 'default';
  }
}

export const SubscriptionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = usePlatformAuth();

  // Toast feedback state
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Copy-to-clipboard state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Inspect modal state
  const [inspectRecord, setInspectRecord] = useState<SubscriptionRecord | null>(null);

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 1: SaaS Plans Matrix Strip
  // ═══════════════════════════════════════════════════════════════════
  const {
    data: plans,
    isLoading: isPlansLoading,
    isFetching: isPlansFetching,
  } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SaaSPlan[] }>('/plans');
      return res.data.data;
    },
    staleTime: 60000,
  });

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 2: Manual Subscription Adjustment Tool State
  // ═══════════════════════════════════════════════════════════════════
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTenantId, setAdjustTenantId] = useState('');
  const [adjustDays, setAdjustDays] = useState<number>(14);
  const [adjustType, setAdjustType] = useState<'manual_bonus' | 'compensation' | 'promotion' | 'referral_reward'>('manual_bonus');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const isSupportAdmin = user?.role === PlatformRole.SUPPORT_ADMIN;
  const isCeilingExceeded = isSupportAdmin && Math.abs(adjustDays) > 14;

  const openAdjustModal = (tenantId?: string) => {
    if (tenantId) setAdjustTenantId(tenantId);
    setAdjustDays(isSupportAdmin ? 14 : 30);
    setAdjustType('manual_bonus');
    setAdjustReason('');
    setAdjustError(null);
    setIsAdjustModalOpen(true);
  };

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenantId: adjustTenantId.trim(),
        daysToAdd: Number(adjustDays),
        type: adjustType,
        reason: adjustReason.trim(),
      };
      const res = await api.post(`/subscriptions/${adjustTenantId.trim()}/adjust`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-subscriptions'] });
      setIsAdjustModalOpen(false);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Subscription Tenure Adjusted',
        message: data.message || `Successfully applied ${adjustDays} days adjustment.`,
      });
    },
    onError: (err: any) => {
      setAdjustError(
        err.response?.data?.message || err.response?.data?.error || 'Failed to adjust subscription tenure.'
      );
    },
  });

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);

    if (!adjustTenantId.trim()) {
      setAdjustError('Valid Tenant ID is required.');
      return;
    }
    if (!adjustDays || isNaN(adjustDays) || adjustDays === 0) {
      setAdjustError('Adjustment days must be a non-zero integer.');
      return;
    }
    if (isCeilingExceeded) {
      setAdjustError('Support Admin role is restricted to a maximum 14-day adjustment ceiling.');
      return;
    }
    if (adjustReason.trim().length < 10) {
      setAdjustError('Operational reason must be at least 10 characters for audit compliance.');
      return;
    }

    adjustMutation.mutate();
  };

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 3: Payment Reconciliation Section
  // ═══════════════════════════════════════════════════════════════════
  const [reconcilePaymentId, setReconcilePaymentId] = useState('');
  const [reconcileReason, setReconcileReason] = useState('');
  const [reconcileResult, setReconcileResult] = useState<PaymentReconciliationData | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        paymentId: reconcilePaymentId.trim(),
        reason: reconcileReason.trim(),
      };
      const res = await api.post<{
        success: boolean;
        message: string;
        data: PaymentReconciliationData;
      }>('/subscriptions/reconcile', payload);
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['platform-subscriptions'] });
      setReconcileResult(resData.data);
      setReconcileError(null);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Payment Reconciled & Applied',
        message: resData.message || 'Payment claimed and subscription activated successfully.',
      });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Reconciliation failed.';
      setReconcileError(msg);
      setReconcileResult(null);
    },
  });

  const handleReconcileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReconcileError(null);

    if (!reconcilePaymentId.trim()) {
      setReconcileError('Payment ID or Razorpay Payment ID is required.');
      return;
    }
    if (reconcileReason.trim().length < 10) {
      setReconcileError('A valid operational reason (minimum 10 characters) is required for payment reconciliation.');
      return;
    }

    reconcileMutation.mutate();
  };

  const handleInitiateReconcileForTenant = (tenantId: string) => {
    setReconcilePaymentId(tenantId);
    const element = document.getElementById('reconciliation-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 4: Subscriptions Directory Table & URL Query State
  // ═══════════════════════════════════════════════════════════════════
  const { params, setParam, resetParams } = useListFilterParams({
    page: 1,
    status: 'ALL',
    search: '',
  });

  const page = Number(params.page) || 1;
  const statusFilter = (params.status || 'ALL').toUpperCase();
  const searchQuery = params.search || '';

  const {
    data: subscriptionsData,
    isLoading: isSubscriptionsLoading,
    isFetching: isSubscriptionsFetching,
  } = useQuery({
    queryKey: ['platform-subscriptions', page, statusFilter, searchQuery],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', '10');
      if (statusFilter !== 'ALL') {
        queryParams.append('status', statusFilter.toLowerCase());
      }
      if (searchQuery.trim()) {
        queryParams.append('search', searchQuery.trim());
      }
      const res = await api.get<SubscriptionsListResponse>(`/subscriptions?${queryParams.toString()}`);
      return res.data;
    },
    staleTime: 30000,
  });

  const isGlobalRefreshing = isPlansFetching || isSubscriptionsFetching;

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    queryClient.invalidateQueries({ queryKey: ['platform-subscriptions'] });
  };

  // Sorted plans by displayOrder
  const sortedPlans = useMemo(() => {
    if (!plans) return [];
    return [...plans].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [plans]);

  // Financial MRR calculations with exact paise precision
  const financialMetrics = useMemo(() => {
    const subs = subscriptionsData?.data ?? [];
    let activeCount = 0;
    let graceCount = 0;
    let expiringCount = 0;
    let estimatedMRR = 0;

    for (const sub of subs) {
      const isSubActive = sub.status?.toLowerCase() === 'active';
      if (isSubActive) {
        activeCount++;
        const planPrice = sub.plan?.baseMonthlyPrice ?? 0;
        estimatedMRR += planPrice;
      }
      if (sub.isGrace || sub.status?.toLowerCase() === 'grace') {
        graceCount++;
      }
      if (sub.daysRemaining > 0 && sub.daysRemaining <= 14) {
        expiringCount++;
      }
    }

    const arpt = activeCount > 0 ? estimatedMRR / activeCount : 0;

    return {
      activeCount,
      graceCount,
      expiringCount,
      estimatedMRR,
      arpt,
    };
  }, [subscriptionsData]);

  return (
    <div className="space-y-8 select-text">
      {/* Toast Notification Container */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">Subscriptions & SaaS Governance</h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-semibold">
              Control Plane
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Pricing tier catalog, tenure adjustment authorization, and two-phase gateway payment reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isGlobalRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 hover:border-slate-600 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh pricing plans and subscription registries"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isGlobalRefreshing ? 'animate-spin' : ''}`} />
            <span className="font-mono">Sync State</span>
          </button>

          <button
            type="button"
            onClick={() => openAdjustModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Adjust Subscription</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 0: Animated MRR & Subscription KPI Cards (Paise Precision)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Estimated MRR */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Page Estimated MRR</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-100 font-mono tracking-tight flex items-baseline gap-0.5">
            <AnimatedCounter
              target={financialMetrics.estimatedMRR}
              isCurrency
              prefix="₹"
              decimals={2}
              className="text-emerald-400"
            />
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Across {financialMetrics.activeCount} active subscriptions
          </p>
        </div>

        {/* Card 2: Active Subscriptions */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Active Accounts</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-100 font-mono tracking-tight">
            <AnimatedCounter target={financialMetrics.activeCount} decimals={0} />
            <span className="text-xs text-slate-400 font-sans font-normal ml-1.5">
              / {subscriptionsData?.pagination?.total ?? 0} total
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {subscriptionsData?.pagination?.total ? Math.round((financialMetrics.activeCount / subscriptionsData.pagination.total) * 100) : 0}% active ratio
          </p>
        </div>

        {/* Card 3: Grace & Trials */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Grace / Buffer</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-amber-300 font-mono tracking-tight">
            <AnimatedCounter target={financialMetrics.graceCount} decimals={0} />
            <span className="text-xs text-slate-400 font-sans font-normal ml-1.5">tenants</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Automated 7-day grace period
          </p>
        </div>

        {/* Card 4: Avg Revenue Per Tenant (ARPT) */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Avg Revenue / Tenant</span>
            <CreditCard className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-100 font-mono tracking-tight">
            <AnimatedCounter
              target={financialMetrics.arpt}
              isCurrency
              prefix="₹"
              decimals={2}
              className="text-sky-300"
            />
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Monthly run-rate basis
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: SaaS Plans Matrix Strip
          ───────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200 tracking-tight">SaaS Plans Matrix Strip</h2>
            <span className="text-[11px] font-mono text-slate-400">
              ({sortedPlans.length} Active Catalog Tiers)
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            GET /api/platform/plans
          </span>
        </div>

        {isPlansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-64 bg-slate-900 border border-slate-800/80 rounded-xl p-5 animate-pulse space-y-4"
              >
                <div className="h-5 w-24 bg-slate-800 rounded" />
                <div className="h-8 w-32 bg-slate-800 rounded" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-slate-800/60 rounded" />
                  <div className="h-3 w-4/5 bg-slate-800/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedPlans.length === 0 ? (
          <div className="p-8 bg-slate-900 border border-slate-800/80 rounded-xl text-center text-xs text-slate-400">
            No SaaS pricing plans found in database.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sortedPlans.map((plan) => {
              const isBusiness = plan.code.toLowerCase() === 'business';
              const isPro = plan.code.toLowerCase() === 'professional';

              return (
                <div
                  key={plan._id}
                  className={`relative bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition-all hover:border-slate-700/80 shadow-xs ${
                    isPro
                      ? 'border-cyan-800/60 shadow-cyan-950/20'
                      : isBusiness
                      ? 'border-indigo-800/60 shadow-indigo-950/20'
                      : 'border-slate-800/80'
                  }`}
                >
                  {/* Top Badge Strip */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-100 tracking-tight">
                          {plan.name}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 font-medium">
                          {plan.code}
                        </span>
                      </div>
                      <StatusBadge
                        variant={plan.active ? 'emerald' : 'slate'}
                        label={plan.active ? 'ACTIVE' : 'INACTIVE'}
                        dot
                      />
                    </div>

                    {/* Pricing Display with Banned Truncation */}
                    <div className="pt-1 pb-2 border-b border-slate-800/80 flex items-baseline gap-1.5">
                      <CurrencyDisplay
                        amount={plan.baseMonthlyPrice}
                        size="2xl"
                        className="text-slate-100 font-bold"
                      />
                      <span className="text-xs text-slate-400 font-mono">/ month</span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 leading-relaxed min-h-[34px]">
                      {plan.description || 'Enterprise billing tier with modular feature gating.'}
                    </p>

                    {/* Features Tag Strip */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>Included Capabilities</span>
                        <span className="text-cyan-400 font-semibold">{plan.features.length} Entitlements</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {plan.features.slice(0, 8).map((feat) => (
                          <span
                            key={feat}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60"
                          >
                            {feat}
                          </span>
                        ))}
                        {plan.features.length > 8 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                            +{plan.features.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Billing: 30-Day Intervals</span>
                    <span className="text-slate-400">Order #{plan.displayOrder || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: Payment Reconciliation Section
          ───────────────────────────────────────────────────────────── */}
      <div id="reconciliation-section" className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
                Two-Phase Gateway Payment Reconciliation
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Verify Razorpay gateway status, resolve orphaned payments, and atomically claim subscription extensions.
            </p>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            POST /api/platform/subscriptions/reconcile
          </span>
        </div>

        <form onSubmit={handleReconcileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input: Payment ID */}
            <div className="space-y-1.5">
              <label htmlFor="reconcile-payment-id" className="block text-xs font-medium text-slate-300">
                Payment Identifier / Gateway ID <span className="text-rose-400">*</span>
              </label>
              <input
                id="reconcile-payment-id"
                type="text"
                value={reconcilePaymentId}
                onChange={(e) => setReconcilePaymentId(e.target.value)}
                placeholder="e.g. pay_N29Xz78dE or 65f1a2b3c4d5e6f7a8b9c0d1"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors min-h-[44px]"
                required
              />
              <p className="text-[11px] text-slate-400">
                Supports internal MongoDB payment ID or Razorpay gateway payment ID.
              </p>
            </div>

            {/* Input: Operational Reason */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="reconcile-reason" className="block text-xs font-medium text-slate-300">
                  Audit Reconciliation Reason <span className="text-rose-400">*</span>
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    reconcileReason.trim().length >= 10 ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {reconcileReason.trim().length}/10 chars min
                </span>
              </div>
              <input
                id="reconcile-reason"
                type="text"
                value={reconcileReason}
                onChange={(e) => setReconcileReason(e.target.value)}
                placeholder="Reason for payment claim (e.g. Gateway webhook timeout resolved via UTR)"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors min-h-[44px]"
                required
              />
              <p className="text-[11px] text-slate-400">
                Logged to immutable cryptographic platform audit trail.
              </p>
            </div>
          </div>

          {reconcileError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-center justify-between">
              <div className="flex-1">
                <span className="font-semibold">Reconciliation Rejected: </span>
                {reconcileError}
              </div>
              <button
                type="button"
                onClick={() => setReconcileError(null)}
                className="text-rose-400 hover:text-rose-200 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="submit"
              disabled={
                reconcileMutation.isPending ||
                !reconcilePaymentId.trim() ||
                reconcileReason.trim().length < 10
              }
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {reconcileMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Gateway...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify & Reconcile Payment</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* ─── Reconciliation Result Card ───────────────────────────── */}
        {reconcileResult && (
          <div className="mt-4 p-4 bg-slate-950 border border-emerald-800/70 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300 tracking-tight">
                  Reconciliation Succeeded & Subscription Activated
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReconcileResult(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono cursor-pointer"
              >
                Dismiss
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {/* Payment Details */}
              <div className="p-3 bg-slate-900/90 border border-slate-800/80 rounded-lg space-y-1.5">
                <span className="text-[11px] font-sans font-semibold text-slate-300 uppercase tracking-wider">
                  Payment Ledger Entity
                </span>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Payment ID:</span>
                  <span className="text-cyan-400 font-bold">{reconcileResult.payment._id}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Status:</span>
                  <StatusBadge variant="emerald" label={reconcileResult.payment.paymentStatus} dot />
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Amount Reconciled:</span>
                  <CurrencyDisplay amount={reconcileResult.payment.finalAmount} className="text-emerald-400 font-bold" />
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Gateway:</span>
                  <span className="text-slate-200 uppercase">{reconcileResult.payment.paymentGateway}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Duration:</span>
                  <span className="text-slate-200">{reconcileResult.payment.durationMonths} Months</span>
                </div>
              </div>

              {/* Updated Subscription State */}
              <div className="p-3 bg-slate-900/90 border border-slate-800/80 rounded-lg space-y-1.5">
                <span className="text-[11px] font-sans font-semibold text-slate-300 uppercase tracking-wider">
                  Activated Subscription State
                </span>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Tenant ID:</span>
                  <span className="text-slate-200">{reconcileResult.subscription.tenantId}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Subscription Status:</span>
                  <StatusBadge variant="emerald" label={reconcileResult.subscription.status} dot />
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Expires At:</span>
                  <span className="text-emerald-300">{formatISTDateTime(reconcileResult.subscription.expiresAt)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Grace Until:</span>
                  <span className="text-amber-300">{formatISTDateTime(reconcileResult.subscription.graceUntil)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Auto Renew:</span>
                  <span className="text-slate-300">{reconcileResult.subscription.autoRenew ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: Subscriptions Directory Table & Dual Mobile View
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-xs space-y-0">
        {/* Table Filter & Search Header */}
        <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-200 tracking-tight">Active Tenant Subscriptions</h2>
            <span className="text-[11px] font-mono text-slate-400">
              ({subscriptionsData?.pagination?.total ?? 0} Total Records)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
              {['ALL', 'ACTIVE', 'TRIAL', 'GRACE', 'EXPIRED', 'SUSPENDED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setParam('status', st);
                    setParam('page', 1);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer min-h-[32px] flex items-center ${
                    statusFilter === st
                      ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Debounced Search Input */}
            <SearchInput
              value={searchQuery}
              onChange={(val) => {
                setParam('search', val);
                setParam('page', 1);
              }}
              placeholder="Search firm, email, tenant..."
              className="w-full sm:w-60"
            />
          </div>
        </div>

        {/* ─── A. DESKTOP VIEW (Table: md and up) ─── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Tenant / Firm</th>
                <th className="py-3 px-4">Plan & Tier</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Tenure / Remaining</th>
                <th className="py-3 px-4">Expires (IST)</th>
                <th className="py-3 px-4">Billing Mode</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isSubscriptionsLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                    <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
                    Fetching subscriptions directory...
                  </td>
                </tr>
              ) : !subscriptionsData?.data || subscriptionsData.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    No subscriptions match the applied filters.
                  </td>
                </tr>
              ) : (
                subscriptionsData.data.map((sub) => {
                  const firmName = sub.tenant?.firmName || 'Unnamed Firm';
                  const tenantIdStr = sub.tenantId;

                  return (
                    <tr
                      key={sub._id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Tenant Firm & ID */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => setInspectRecord(sub)}
                            className="font-semibold text-slate-200 hover:text-cyan-400 text-left block truncate max-w-[200px] cursor-pointer"
                            title="Inspect subscription record"
                          >
                            {firmName}
                          </button>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                            <span className="truncate max-w-[130px]">{tenantIdStr}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(tenantIdStr, sub._id)}
                              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                              title="Copy Tenant ID"
                            >
                              {copiedId === sub._id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-medium text-slate-200 block">
                            {sub.plan?.name || 'Custom Plan'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {sub.plan?.code || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          variant={getSubscriptionBadgeVariant(sub.status)}
                          label={sub.status ? sub.status.toUpperCase() : 'UNKNOWN'}
                          dot
                        />
                      </td>

                      {/* Days Remaining */}
                      <td className="py-3 px-4 font-mono">
                        <span
                          className={`font-semibold ${
                            sub.daysRemaining > 14
                              ? 'text-emerald-400'
                              : sub.daysRemaining > 0
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {sub.daysRemaining} Days
                        </span>
                        {sub.isGrace && (
                          <span className="block text-[10px] text-amber-400">In Grace Period</span>
                        )}
                      </td>

                      {/* Expiration Date */}
                      <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                        {formatISTDate(sub.expiresAt)}
                      </td>

                      {/* Billing Mode */}
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px] uppercase">
                        {sub.billingMode || 'MANUAL'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect */}
                          <button
                            type="button"
                            onClick={() => setInspectRecord(sub)}
                            className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
                            title="Inspect subscription details"
                            aria-label={`Inspect subscription for ${firmName}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Adjust */}
                          <button
                            type="button"
                            onClick={() => openAdjustModal(tenantIdStr)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 hover:border-cyan-500/60 font-mono text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Authorize manual days extension or deduction"
                            aria-label={`Adjust tenure for ${firmName}`}
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Adjust</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── B. MOBILE VIEW (Collapsible Cards: < md) ─── */}
        <div className="md:hidden p-3 space-y-3">
          {isSubscriptionsLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 animate-pulse space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-slate-800 rounded w-36" />
                      <div className="h-2.5 bg-slate-800/60 rounded w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isSubscriptionsLoading && (!subscriptionsData?.data || subscriptionsData.data.length === 0) && (
            <div className="p-8 text-center text-xs space-y-3">
              <CreditCard className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-300">No subscriptions found</p>
              <p className="text-slate-500">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No subscriptions match your active filters.'
                  : 'No subscription records available.'}
              </p>
              {(searchQuery || statusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => resetParams()}
                  className="px-4 py-2 min-h-[44px] rounded-lg bg-cyan-600 text-white font-medium cursor-pointer inline-flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          )}

          {!isSubscriptionsLoading &&
            subscriptionsData?.data &&
            subscriptionsData.data.map((sub) => {
              const firmName = sub.tenant?.firmName || 'Unnamed Firm';
              const tenantIdStr = sub.tenantId;

              // Summary: 74-82px bounded height, single-line truncation
              const cardSummary = (
                <div className="flex items-center gap-3 min-w-0 pr-1">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-cyan-300 shrink-0 select-none shadow-2xs">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 truncate text-xs block">
                        {firmName}
                      </span>
                      <StatusBadge
                        variant={getSubscriptionBadgeVariant(sub.status)}
                        label={sub.status ? sub.status.toUpperCase() : 'UNKNOWN'}
                        dot
                        size="sm"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] font-mono">
                      <span className="text-slate-400 truncate">
                        {sub.plan?.name || 'Standard'} • {sub.billingMode || 'MANUAL'}
                      </span>
                      <span
                        className={`font-semibold shrink-0 ${
                          sub.daysRemaining > 14
                            ? 'text-emerald-400'
                            : sub.daysRemaining > 0
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {sub.daysRemaining}d left
                      </span>
                    </div>
                  </div>
                </div>
              );

              return (
                <CollapsibleMobileCard
                  key={sub._id}
                  id={sub._id}
                  entityType="subscription"
                  statusVariant={mapStatusToCardVariant(sub.status)}
                  summary={cardSummary}
                >
                  <div className="space-y-3 pt-2 text-xs">
                    {/* Meta info grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                      <div className="flex items-center gap-2 text-slate-300 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate select-all">{tenantIdStr}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Expires: {formatISTDate(sub.expiresAt)}</span>
                      </div>
                      {sub.graceUntil && (
                        <div className="flex items-center gap-2 text-amber-300">
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Grace: {formatISTDate(sub.graceUntil)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-400">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{sub.tenant?.email || '—'}</span>
                      </div>
                    </div>

                    {/* Structured 2x2 Action Grid (min-h-[44px] touch targets) */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                      {/* Action 1: Adjust */}
                      <button
                        type="button"
                        onClick={() => openAdjustModal(tenantIdStr)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                        aria-label={`Adjust subscription for ${firmName}`}
                      >
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        <span>Adjust</span>
                      </button>

                      {/* Action 2: Reconcile */}
                      <button
                        type="button"
                        onClick={() => handleInitiateReconcileForTenant(tenantIdStr)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 active:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                        aria-label={`Reconcile payment for ${firmName}`}
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Reconcile</span>
                      </button>

                      {/* Action 3: Copy ID */}
                      <button
                        type="button"
                        onClick={() => handleCopy(tenantIdStr, sub._id)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                        aria-label="Copy Tenant ID"
                      >
                        {copiedId === sub._id ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 font-mono">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-slate-400" />
                            <span>Copy ID</span>
                          </>
                        )}
                      </button>

                      {/* Action 4: Inspect */}
                      <button
                        type="button"
                        onClick={() => setInspectRecord(sub)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                        aria-label={`Inspect details for ${firmName}`}
                      >
                        <Eye className="w-4 h-4 text-indigo-400" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </div>
                </CollapsibleMobileCard>
              );
            })}
        </div>

        {/* Keyset / Page Navigation Bar */}
        {subscriptionsData?.pagination && (
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>
              Showing Page {subscriptionsData.pagination.page} of {subscriptionsData.pagination.totalPages || 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setParam('page', Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setParam('page', page + 1)}
                disabled={page >= (subscriptionsData.pagination.totalPages || 1)}
                className="px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Manual Subscription Adjustment Tool
          ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Adjust Tenant Subscription Tenure"
        maxWidth="lg"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          {/* Role-Based Ceiling Information Callout */}
          {isSupportAdmin ? (
            <div className="p-3.5 bg-amber-950/60 border border-amber-800/80 rounded-lg flex items-start gap-3 text-xs text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100">
                  Role Privilege Ceiling Active: Support Admin
                </p>
                <p className="text-amber-300/90 leading-relaxed">
                  Support Admins are authorized for a statutory maximum ceiling of <strong>±14 days</strong> per tenure adjustment. Platform Owner credentials are required for longer overrides.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg flex items-start gap-3 text-xs text-slate-300">
              <Sliders className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-200">
                  Platform Operator Tenure Extension
                </p>
                <p className="text-slate-400 leading-relaxed">
                  This action directly recalculates the tenant subscription expiration and grace timestamps. Every adjustment is permanently signed in the platform audit log.
                </p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3">
            {/* Field: Tenant ID */}
            <div className="space-y-1.5">
              <label htmlFor="adjust-tenant-id" className="block text-xs font-medium text-slate-300">
                Target Tenant ID <span className="text-rose-400">*</span>
              </label>
              <input
                id="adjust-tenant-id"
                type="text"
                value={adjustTenantId}
                onChange={(e) => setAdjustTenantId(e.target.value)}
                placeholder="65f1a2b3c4d5e6f7a8b9c0d1"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors min-h-[44px]"
                required
              />
            </div>

            {/* Field: Days To Add */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="adjust-days" className="block text-xs font-medium text-slate-300">
                  Tenure Days Adjustment (Positive = Extend, Negative = Deduct){' '}
                  <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] font-mono text-cyan-400">
                  {adjustDays > 0 ? `+${adjustDays}` : adjustDays} Days
                </span>
              </div>
              <input
                id="adjust-days"
                type="number"
                step="1"
                value={adjustDays}
                onChange={(e) => setAdjustDays(parseInt(e.target.value, 10) || 0)}
                max={isSupportAdmin ? 14 : 365}
                min={isSupportAdmin ? -14 : -365}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors min-h-[44px]"
                required
              />
              {isCeilingExceeded && (
                <p className="text-[11px] text-rose-400 font-mono">
                  Error: Support Admin ceiling exceeded (Max ±14 days allowed).
                </p>
              )}
            </div>

            {/* Field: Adjustment Type */}
            <div className="space-y-1.5">
              <label htmlFor="adjust-type" className="block text-xs font-medium text-slate-300">
                Classification Type <span className="text-rose-400">*</span>
              </label>
              <select
                id="adjust-type"
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none transition-colors min-h-[44px]"
              >
                <option value="manual_bonus">Manual Bonus (Discretionary Extension)</option>
                <option value="compensation">Incident Compensation (SLA / Downtime Credit)</option>
                <option value="promotion">Promotional Campaign / Onboarding Trial</option>
                <option value="referral_reward">Referral Reward Credit</option>
              </select>
            </div>

            {/* Field: Reason */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="adjust-reason" className="block text-xs font-medium text-slate-300">
                  Mandatory Audit Reason <span className="text-rose-400">*</span>
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    adjustReason.trim().length >= 10 ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {adjustReason.trim().length}/10 chars min
                </span>
              </div>
              <textarea
                id="adjust-reason"
                rows={3}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Detailed reason for tenure adjustment (e.g. Compensating customer for Razorpay webhook timeout during month-end billing)..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          {adjustError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-300">
              <span className="font-semibold">Adjustment Error: </span>
              {adjustError}
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 min-h-[44px] rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                adjustMutation.isPending ||
                !adjustTenantId.trim() ||
                !adjustDays ||
                isCeilingExceeded ||
                adjustReason.trim().length < 10
              }
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {adjustMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing Adjustment...</span>
                </>
              ) : (
                <>
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Authorize & Apply Adjustment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Inspect Subscription Record
          ───────────────────────────────────────────────────────────── */}
      {inspectRecord && (
        <Modal
          isOpen={!!inspectRecord}
          onClose={() => setInspectRecord(null)}
          title={`Subscription Details: ${inspectRecord.tenant?.firmName || 'Tenant'}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Header snapshot */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-slate-400 text-[11px]">Subscription Plan</span>
                <div className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>{inspectRecord.plan?.name || 'Custom Plan'}</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                    {inspectRecord.plan?.code || '—'}
                  </span>
                </div>
              </div>
              <StatusBadge
                variant={getSubscriptionBadgeVariant(inspectRecord.status)}
                label={inspectRecord.status ? inspectRecord.status.toUpperCase() : 'UNKNOWN'}
                dot
              />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Tenant Firm</span>
                <span className="text-slate-200 font-semibold">{inspectRecord.tenant?.firmName || 'Unnamed Firm'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Tenant ID</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-cyan-400 truncate">{inspectRecord.tenantId}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(inspectRecord.tenantId, 'modal-tid')}
                    className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {copiedId === 'modal-tid' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Days Remaining</span>
                <span className="text-emerald-400 font-bold">{inspectRecord.daysRemaining} Days</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Billing Mode</span>
                <span className="text-slate-200 uppercase">{inspectRecord.billingMode || 'MANUAL'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Started At (IST)</span>
                <span className="text-slate-300">{formatISTDateTime(inspectRecord.startedAt)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Expires At (IST)</span>
                <span className="text-emerald-300">{formatISTDateTime(inspectRecord.expiresAt)}</span>
              </div>
              {inspectRecord.graceUntil && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Grace Period Until</span>
                  <span className="text-amber-300">{formatISTDateTime(inspectRecord.graceUntil)}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Auto Renewal</span>
                <span className="text-slate-200">{inspectRecord.autoRenew ? 'Active (Automatic)' : 'Manual Invoicing'}</span>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const tid = inspectRecord.tenantId;
                  setInspectRecord(null);
                  openAdjustModal(tid);
                }}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Sliders className="w-4 h-4" />
                <span>Adjust Tenure</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SubscriptionsPage;
