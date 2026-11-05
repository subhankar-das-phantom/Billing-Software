/**
 * Bharat Enterprise Billing System — Platform Subscriptions & SaaS Governance
 * SaaS plan pricing tier matrix, manual tenure adjustments with role-based ceilings,
 * two-phase gateway payment reconciliation, and active subscription directory.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Sliders,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Check,
  Copy,
  X,
} from 'lucide-react';
import api from '../services/api';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import StatusBadge, { StatusVariant } from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import { Toast, ToastMessage } from '../components/common/Toast';
import { usePlatformAuth } from '../contexts/PlatformAuthContext';
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
      // Calls POST /api/platform/subscriptions/reconcile
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

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 4: Subscriptions Directory Table
  // ═══════════════════════════════════════════════════════════════════
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: subscriptionsData,
    isLoading: isSubscriptionsLoading,
    isFetching: isSubscriptionsFetching,
  } = useQuery({
    queryKey: ['platform-subscriptions', page, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter.toLowerCase());
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      const res = await api.get<SubscriptionsListResponse>(`/subscriptions?${params.toString()}`);
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
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
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
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
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
                placeholder="e.g. Gateway webhook delayed; customer confirmed bank transaction UTR."
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400">
                Mandatory SOC2 justification recorded permanently in Platform Audit Trail.
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {reconcileError && (
            <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Reconciliation Rejected: </span>
                {reconcileError}
              </div>
              <button
                type="button"
                onClick={() => setReconcileError(null)}
                className="text-rose-400 hover:text-rose-200 cursor-pointer"
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
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
          SECTION 3: Subscriptions Directory Table
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
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {['ALL', 'ACTIVE', 'TRIAL', 'GRACE', 'EXPIRED', 'SUSPENDED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer ${
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
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search firm, email, tenant..."
                className="bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors w-48 sm:w-60 font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
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
                          <span className="font-semibold text-slate-200 block truncate max-w-[200px]">
                            {firmName}
                          </span>
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
                          label={sub.status.toUpperCase()}
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
                        <button
                          type="button"
                          onClick={() => openAdjustModal(tenantIdStr)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 hover:border-cyan-500/60 font-mono text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                          title="Authorize manual days extension or deduction"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Adjust</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (subscriptionsData.pagination.totalPages || 1)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 border border-slate-700 transition-colors cursor-pointer"
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
                <span className="font-bold text-amber-300">Support Admin 14-Day Ceiling Enforcement</span>
                <p className="leading-relaxed text-[11px] text-amber-300/90">
                  Your current platform role (<span className="font-mono font-semibold">SUPPORT_ADMIN</span>) is governed by a strict ±14 day maximum adjustment ceiling per grant. Platform Owner / Platform Admin retain unrestricted tenure privileges.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-start gap-2.5 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-100">Elevated Platform Privileges: </span>
                As <span className="font-mono text-cyan-400 font-medium">{user?.role}</span>, you possess unlimited tenure adjustment authority. All operations are signed into the immutable platform audit trail.
              </div>
            </div>
          )}

          {/* Tenant ID Input */}
          <div className="space-y-1.5">
            <label htmlFor="adjust-tenant-id" className="block text-xs font-medium text-slate-300">
              Target Tenant Identifier <span className="text-rose-400">*</span>
            </label>
            <input
              id="adjust-tenant-id"
              type="text"
              value={adjustTenantId}
              onChange={(e) => setAdjustTenantId(e.target.value)}
              placeholder="e.g. 65f1a2b3c4d5e6f7a8b9c0d1"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
              required
            />
          </div>

          {/* Adjustment Days (+/-) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="adjust-days" className="block text-xs font-medium text-slate-300">
                Adjustment Days (+/-) <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {adjustDays > 0 ? `+${adjustDays} Days Extension` : `${adjustDays} Days Deduction`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="adjust-days"
                type="number"
                value={adjustDays}
                onChange={(e) => setAdjustDays(parseInt(e.target.value, 10) || 0)}
                max={isSupportAdmin ? 14 : 365}
                min={isSupportAdmin ? -14 : -365}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none transition-colors"
                required
              />
            </div>

            {/* Quick Preset Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-mono text-slate-400">Presets:</span>
              {[7, 14, ...(isSupportAdmin ? [] : [30, 60]), -7].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAdjustDays(preset)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    adjustDays === preset
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'
                  }`}
                >
                  {preset > 0 ? `+${preset}d` : `${preset}d`}
                </button>
              ))}
            </div>

            {isCeilingExceeded && (
              <p className="text-[11px] text-rose-400 font-mono">
                Error: Support Admin cannot exceed ±14 days ceiling.
              </p>
            )}
          </div>

          {/* Adjustment Type Selector */}
          <div className="space-y-1.5">
            <label htmlFor="adjust-type" className="block text-xs font-medium text-slate-300">
              Adjustment Classification Category <span className="text-rose-400">*</span>
            </label>
            <select
              id="adjust-type"
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none transition-colors"
            >
              <option value="manual_bonus">Administrative Manual Bonus</option>
              <option value="compensation">Service Interruption Compensation</option>
              <option value="promotion">Commercial Promotion / Marketing</option>
              <option value="referral_reward">Referral Program Fulfillment</option>
            </select>
          </div>

          {/* Operational Reason (>= 10 chars) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="adjust-reason" className="block text-xs font-medium text-slate-300">
                Operational Reason & Audit Justification <span className="text-rose-400">*</span>
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
              placeholder="e.g. Compensating customer for platform gateway outage during quarterly GST filing."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors resize-none"
              required
            />
          </div>

          {/* Error Message */}
          {adjustError && (
            <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{adjustError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              disabled={adjustMutation.isPending}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {adjustMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying Adjustment...</span>
                </>
              ) : (
                <>
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Authorize Adjustment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SubscriptionsPage;