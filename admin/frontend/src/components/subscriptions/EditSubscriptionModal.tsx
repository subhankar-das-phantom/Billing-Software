/**
 * Bharat Enterprise Billing System — Platform Subscription Editor Modal
 * Modifies an enterprise tenant's active SaaS subscription parameters, status state machine,
 * tenure expiration dates, grace window, and custom commercial rates.
 * Mobile-first touch ergonomics: 44px touch targets, pinned action footer with safe-area padding,
 * and double-click submission locks.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Calendar,
  Clock,
  DollarSign,
  Copy,
  Check,
  Info,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Layers,
  Shield,
} from 'lucide-react';
import Modal from '../common/Modal';
import CurrencyDisplay from '../common/CurrencyDisplay';
import StatusBadge from '../common/StatusBadge';
import api from '../../services/api';
import type { SaaSPlan } from '../../types';

export interface EditSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription?: any | null;
  onSuccess?: () => void;
}

const FALLBACK_PLANS = [
  { _id: 'starter', name: 'Starter Plan', code: 'starter', baseMonthlyPrice: 499 },
  { _id: 'business', name: 'Business Suite', code: 'business', baseMonthlyPrice: 1499 },
  { _id: 'professional', name: 'Professional Enterprise', code: 'professional', baseMonthlyPrice: 3499 },
];

const SUBSCRIPTION_STATUSES = [
  { value: 'active', label: 'Active', desc: 'Fully operational with write entitlements' },
  { value: 'trial', label: 'Trial', desc: 'Evaluation period with access limits' },
  { value: 'grace', label: 'Grace Period', desc: 'Payment buffer window prior to suspension' },
  { value: 'expired', label: 'Expired', desc: 'Lapsed account restricted to read-only' },
  { value: 'suspended', label: 'Suspended', desc: 'Administrative lock for compliance' },
] as const;

function toDateInputValue(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0] || '';
  } catch {
    return '';
  }
}

function formatDate(dateStr?: string | null): string {
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

export const EditSubscriptionModal: React.FC<EditSubscriptionModalProps> = ({
  isOpen,
  onClose,
  subscription,
  onSuccess,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  // 1. Fetch live plans list for dropdown
  const { data: plansData } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: async () => {
      try {
        const res = await api.get<{ success: boolean; data: SaaSPlan[] }>('/plans');
        return res.data.data;
      } catch {
        return FALLBACK_PLANS as SaaSPlan[];
      }
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  const availablePlans = plansData && plansData.length > 0 ? plansData : FALLBACK_PLANS;

  // Form State
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [status, setStatus] = useState<'trial' | 'active' | 'grace' | 'expired' | 'suspended'>('active');
  const [expiresAt, setExpiresAt] = useState('');
  const [graceDays, setGraceDays] = useState(7);
  const [autoRenew, setAutoRenew] = useState(false);
  const [customPricing, setCustomPricing] = useState<string>('');
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Anti-race click lock ref
  const isSubmittingRef = useRef(false);

  // Synchronize state when modal opens
  useEffect(() => {
    if (isOpen && subscription) {
      const matchedPlan = availablePlans.find(
        (p) =>
          p._id === subscription.planId ||
          p._id === (typeof subscription.planId === 'object' ? subscription.planId?._id : undefined) ||
          p._id === subscription.plan?._id ||
          (subscription.planCode && p.code.toLowerCase() === String(subscription.planCode).toLowerCase()) ||
          (subscription.plan?.code && p.code.toLowerCase() === String(subscription.plan.code).toLowerCase())
      );
      const planId = matchedPlan?._id ||
        (typeof subscription.planId === 'object' ? subscription.planId?._id : subscription.planId) ||
        subscription.plan?._id ||
        '';
      setSelectedPlanId(planId || (availablePlans[0]?._id ?? ''));

      const initialStatus = (subscription.status || 'active').toLowerCase();
      if (['trial', 'active', 'grace', 'expired', 'suspended'].includes(initialStatus)) {
        setStatus(initialStatus as any);
      } else {
        setStatus('active');
      }

      setExpiresAt(toDateInputValue(subscription.expiresAt));
      setGraceDays(subscription.graceDays ?? 7);
      setAutoRenew(Boolean(subscription.autoRenew));

      const priceOverride = subscription.finalAmount ?? subscription.customMonthlyPrice;
      setCustomPricing(priceOverride !== undefined && priceOverride !== null ? String(priceOverride) : '');

      setReason('');
      setErrorMessage(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen, subscription, availablePlans]);

  // Derived tenant identity fields
  const tenantFirmName =
    subscription?.tenant?.firmName ||
    (typeof subscription?.tenantId === 'object' ? subscription?.tenantId?.firmName : null) ||
    'Unknown Enterprise';

  const tenantEmail =
    subscription?.tenant?.email ||
    (typeof subscription?.tenantId === 'object' ? subscription?.tenantId?.email : null) ||
    '—';

  const tenantIdStr =
    (typeof subscription?.tenantId === 'object' ? subscription?.tenantId?._id : subscription?.tenantId) ||
    subscription?.tenant?._id ||
    '';

  const handleCopyId = () => {
    if (!tenantIdStr) return;
    navigator.clipboard.writeText(tenantIdStr);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Quick date extension helpers
  const extendExpiryByMonths = (months: number) => {
    const base = expiresAt ? new Date(expiresAt) : new Date();
    const target = new Date(base.getTime());
    target.setMonth(target.getMonth() + months);
    setExpiresAt(toDateInputValue(target.toISOString()));
  };

  const extendExpiryByDays = (days: number) => {
    const base = expiresAt ? new Date(expiresAt) : new Date();
    const target = new Date(base.getTime());
    target.setDate(target.getDate() + days);
    setExpiresAt(toDateInputValue(target.toISOString()));
  };

  const selectedPlan = useMemo(() => {
    return availablePlans.find((p) => p._id === selectedPlanId || p.code === selectedPlanId);
  }, [availablePlans, selectedPlanId]);

  const effectiveMonthlyPrice = useMemo(() => {
    if (customPricing.trim() !== '') {
      const parsed = parseFloat(customPricing);
      return isNaN(parsed) ? 0 : parsed;
    }
    return selectedPlan?.baseMonthlyPrice ?? 0;
  }, [customPricing, selectedPlan]);

  const minReasonLength = 10;
  const isReasonValid = reason.trim().length >= minReasonLength;
  const isExpiryValid = Boolean(expiresAt);
  const canSubmit = isReasonValid && isExpiryValid && !isSubmitting && Boolean(subscription?._id);

  const handleClose = () => {
    if (isSubmittingRef.current || isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      planId: selectedPlanId,
      status,
      expiresAt: new Date(expiresAt).toISOString(),
      graceDays: Number(graceDays) || 7,
      autoRenew: Boolean(autoRenew),
      customMonthlyPrice: customPricing.trim() !== '' ? Number(customPricing) : undefined,
      finalAmount: effectiveMonthlyPrice,
      reason: reason.trim(),
    };

    try {
      // Primary route: PUT /api/platform/subscriptions/:id
      try {
        await api.put(`/subscriptions/${subscription._id}`, payload);
      } catch (putErr: any) {
        // Fallback to update/adjust endpoint if PUT returns 404/405
        if (putErr.response?.status === 404 || putErr.response?.status === 405) {
          await api.post(`/subscriptions/${subscription._id}/adjust`, {
            ...payload,
            daysToAdd: 0,
          });
        } else {
          throw putErr;
        }
      }

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to update subscription. Ensure valid operational reason and authorized operator permissions.';
      setErrorMessage(msg);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Pinned Bottom Action Bar
  const footerContent = (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end w-full">
      <button
        type="button"
        onClick={handleClose}
        disabled={isSubmitting}
        className="min-h-[44px] w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer flex items-center justify-center"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={() => handleSubmit()}
        disabled={!canSubmit}
        className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-3.5 h-3.5 text-slate-950 shrink-0" />
        <span>{isSubmitting ? 'Saving Changes...' : 'Save Subscription Changes'}</span>
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <CreditCard className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-bold text-slate-100 truncate text-sm sm:text-base">
            Modify Tenant Subscription
          </span>
          <StatusBadge status={status} dot />
        </div>
      }
      description="Directly adjust SaaS plan tier, lifecycle status, expiration date, and billing parameters."
      maxWidth="2xl"
      footer={footerContent}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tenant Identity Summary Banner */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <span className="text-[11px] text-slate-400 block">Subscribed Enterprise</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-100 text-sm truncate">{tenantFirmName}</span>
                <span className="text-xs text-slate-400 truncate">({tenantEmail})</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800 truncate max-w-[160px] sm:max-w-none">
                {tenantIdStr}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-2 rounded border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                title="Copy Tenant ID"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-slate-800/60 text-xs text-slate-400 flex-wrap">
            <span>
              Current Expiry:{' '}
              <strong className="text-slate-200 font-mono">
                {formatDate(subscription?.expiresAt)}
              </strong>
            </span>
            <span>•</span>
            <span>
              Billing:{' '}
              <strong className="text-slate-200 uppercase font-mono">
                {subscription?.billingMode || 'MANUAL'}
              </strong>
            </span>
          </div>
        </div>

        {/* Row 1: Plan Tier & Subscription Status Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Plan Tier Selection */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Assigned Plan Tier</span> <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition-all font-sans cursor-pointer"
            >
              {availablePlans.map((p) => (
                <option key={p._id} value={p._id} className="bg-slate-900 text-slate-100">
                  {p.name} ({p.code.toUpperCase()}) — ₹{p.baseMonthlyPrice}/mo
                </option>
              ))}
            </select>
          </div>

          {/* Subscription Status State Machine */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Subscription Status</span> <span className="text-rose-400">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition-all font-sans cursor-pointer"
            >
              {SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s.value} value={s.value} className="bg-slate-900 text-slate-100">
                  {s.label.toUpperCase()} — {s.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Expiry Date & Quick Extensions */}
        <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Expiration Date (`expiresAt`)</span> <span className="text-rose-400">*</span>
            </label>

            {/* Quick Extension Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-mono">Quick Extend:</span>
              <button
                type="button"
                onClick={() => extendExpiryByDays(15)}
                className="px-2 py-1 text-[11px] rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
              >
                +15 Days
              </button>
              <button
                type="button"
                onClick={() => extendExpiryByMonths(1)}
                className="px-2 py-1 text-[11px] rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
              >
                +1 Month
              </button>
              <button
                type="button"
                onClick={() => extendExpiryByMonths(3)}
                className="px-2 py-1 text-[11px] rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
              >
                +3 Months
              </button>
              <button
                type="button"
                onClick={() => extendExpiryByMonths(12)}
                className="px-2 py-1 text-[11px] rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
              >
                +1 Year
              </button>
            </div>
          </div>

          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={isSubmitting}
            className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition-all font-mono"
          />
        </div>

        {/* Row 3: Grace Period Slider & Auto-Renew Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Grace Period (1 to 30 days) */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Grace Window</span>
              </label>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80">
                {graceDays} Days
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={30}
                value={graceDays}
                onChange={(e) => setGraceDays(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                className="flex-1 accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <input
                type="number"
                min={1}
                max={30}
                value={graceDays}
                onChange={(e) => setGraceDays(parseInt(e.target.value, 10) || 1)}
                disabled={isSubmitting}
                className="w-16 min-h-[36px] px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-center text-slate-100"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Buffer period after expiration before platform write operations lock.
            </p>
          </div>

          {/* Auto-Renew Switch */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <label className="text-xs font-medium text-slate-300">Gateway Auto-Renewal</label>
              <p className="text-[10px] text-slate-500">
                Toggle automated recurring billing token execution on expiration.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAutoRenew(!autoRenew)}
              disabled={isSubmitting}
              className={`w-full min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                autoRenew
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{autoRenew ? 'Auto-Renewal Enabled' : 'Auto-Renewal Disabled'}</span>
              {autoRenew ? (
                <ToggleRight className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-slate-500 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* Row 4: Custom Pricing Override */}
        <div className="space-y-1 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
              <span>Custom Monthly Rate Override (₹)</span>
            </label>
            <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1">
              <span>Effective:</span>
              <CurrencyDisplay amount={effectiveMonthlyPrice} size="sm" />
              <span className="text-slate-500">/ mo</span>
            </div>
          </div>

          <input
            type="number"
            min={0}
            step="0.01"
            value={customPricing}
            onChange={(e) => setCustomPricing(e.target.value)}
            disabled={isSubmitting}
            placeholder={`Leave blank to use catalog plan rate (₹${selectedPlan?.baseMonthlyPrice || 0})`}
            className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all"
          />
          <p className="text-[10px] text-slate-500">
            Special negotiated enterprise fee. If empty, the base price of the chosen plan is applied.
          </p>
        </div>

        {/* Operational Reason & Justification */}
        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
          <label className="block text-xs font-medium text-slate-300">
            Audit Reason & Justification <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            rows={2}
            placeholder={`Provide a clear operational explanation for this subscription modification (min ${minReasonLength} chars)...`}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-sans min-h-[72px]"
          />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Minimum {minReasonLength} characters required for compliance</span>
            <span
              className={
                reason.trim().length >= minReasonLength
                  ? 'text-emerald-400 font-mono'
                  : 'text-slate-400 font-mono'
              }
            >
              {reason.trim().length}/{minReasonLength}
            </span>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default EditSubscriptionModal;
