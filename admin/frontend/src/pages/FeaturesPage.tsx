/**
 * Bharat Enterprise Billing System — Platform Feature Overrides & Entitlements
 * Fine-grained per-tenant capability grants, commercial gating exceptions,
 * high-severity emergency commercial bypass administration with statutory 72-hour safeguards,
 * and high-density dual desktop table / mobile collapsible card views with 2x2 action matrix.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Check,
  Zap,
  Eye,
  Clock,
  UserCheck,
  Building2,
  X,
  Lock,
  Unlock,
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { Toast, ToastMessage } from '../components/common/Toast';
import CollapsibleMobileCard from '../components/common/CollapsibleMobileCard';
import AnimatedCounter from '../components/common/AnimatedCounter';
import SearchInput from '../components/common/SearchInput';
import { usePlatformAuth } from '../contexts/PlatformAuthContext';
import { useListFilterParams } from '../hooks/useListFilterParams';
import {
  PlatformPermission,
  OverrideType,
  ENTERPRISE_FEATURES,
  EMERGENCY_BYPASS_FEATURE,
  type TenantFeatureOverride,
} from '../types';

// ─── Interfaces ───────────────────────────────────────────────────
interface OverridesResponse {
  success: boolean;
  data: {
    overrides: TenantFeatureOverride[];
    effectiveAccess?: {
      canWrite: boolean;
      status: string;
      features: string[];
      emergencyBypassActive: boolean;
      emergencyBypassExpiresAt?: string | null;
    } | null;
  };
}

// ─── Helper: Format Timestamp to IST ──────────────────────────────
function formatISTDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Permanent / Indefinite';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Permanent / Indefinite';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Permanent / Indefinite';
  }
}

// ─── Helper: Compute Human-Readable Expiry Countdown ───────────────
function getExpiryCountdown(dateStr?: string | null): { text: string; isPast: boolean } {
  if (!dateStr) return { text: 'Indefinite', isPast: false };
  try {
    const expiry = new Date(dateStr).getTime();
    const now = Date.now();
    const diffMs = expiry - now;

    if (diffMs <= 0) {
      return { text: 'Expired', isPast: true };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 48) {
      const days = Math.floor(hours / 24);
      return { text: `In ${days} days`, isPast: false };
    }
    if (hours > 0) {
      return { text: `In ${hours}h ${minutes}m`, isPast: false };
    }
    return { text: `In ${minutes} minutes`, isPast: false };
  } catch {
    return { text: 'Indefinite', isPast: false };
  }
}

export const FeaturesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePlatformAuth();

  // Toast feedback state
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Copy-to-clipboard state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Full Reason Inspection Modal State
  const [selectedReason, setSelectedReason] = useState<{
    feature: string;
    reason: string;
    tenantId: string;
    grantedBy: string;
  } | null>(null);

  // Quick Emergency Bypass Card Toggle
  const [showQuickBypassCard, setShowQuickBypassCard] = useState(false);
  const [quickBypassTenantId, setQuickBypassTenantId] = useState('');
  const [quickBypassHours, setQuickBypassHours] = useState(24);
  const [quickBypassReason, setQuickBypassReason] = useState('');

  // Permissions
  const canManageOverrides = hasPermission(PlatformPermission.FEATURE_OVERRIDES_MANAGE);
  const canManageEmergencyBypass = hasPermission(PlatformPermission.EMERGENCY_BYPASS_MANAGE);

  // ═══════════════════════════════════════════════════════════════════
  // 1. QUERY: Feature Overrides List
  // ═══════════════════════════════════════════════════════════════════
  const {
    data: overridesData,
    isLoading: isOverridesLoading,
    isFetching: isOverridesFetching,
  } = useQuery({
    queryKey: ['platform-feature-overrides'],
    queryFn: async () => {
      const res = await api.get<OverridesResponse>('/feature-overrides');
      return res.data.data.overrides || [];
    },
    staleTime: 30000,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. SEARCH & FILTER STATE via useListFilterParams
  // ═══════════════════════════════════════════════════════════════════
  const { params, setParam, resetParams } = useListFilterParams({
    search: '',
    type: 'ALL',
    status: 'ACTIVE_ONLY',
    feature: 'ALL',
  });

  const searchQuery = params.search || '';
  const typeFilter = (params.type || 'ALL') as 'ALL' | 'ALLOW' | 'DENY';
  const statusFilter = (params.status || 'ACTIVE_ONLY') as 'ALL' | 'ACTIVE_ONLY' | 'INACTIVE_ONLY';
  const featureFilter = params.feature || 'ALL';

  const filteredOverrides = useMemo(() => {
    if (!overridesData) return [];
    const now = Date.now();

    return overridesData.filter((item) => {
      // Type Filter
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;

      // Status Filter
      const isExpired = item.expiresAt ? new Date(item.expiresAt).getTime() < now : false;
      const isEffectiveActive = item.isActive && !isExpired;

      if (statusFilter === 'ACTIVE_ONLY' && !isEffectiveActive) return false;
      if (statusFilter === 'INACTIVE_ONLY' && isEffectiveActive) return false;

      // Feature Filter
      if (featureFilter !== 'ALL' && item.feature !== featureFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tenantStr = typeof item.tenantId === 'string' ? item.tenantId : item.tenantId?._id || '';
        const firmStr = typeof item.tenantId === 'object' && item.tenantId?.firmName ? item.tenantId.firmName.toLowerCase() : '';
        const grantedByEmail =
          typeof item.createdBy === 'object' && item.createdBy !== null
            ? item.createdBy.email.toLowerCase()
            : '';
        const matchTenant = tenantStr.toLowerCase().includes(q) || firmStr.includes(q);
        const matchFeature = item.feature.toLowerCase().includes(q);
        const matchReason = item.reason.toLowerCase().includes(q);
        const matchGranted = grantedByEmail.includes(q);

        if (!matchTenant && !matchFeature && !matchReason && !matchGranted) return false;
      }

      return true;
    });
  }, [overridesData, typeFilter, statusFilter, featureFilter, searchQuery]);

  // Telemetry Aggregates
  const stats = useMemo(() => {
    if (!overridesData) return { total: 0, active: 0, allow: 0, deny: 0, bypass: 0 };
    const now = Date.now();
    let active = 0;
    let allow = 0;
    let deny = 0;
    let bypass = 0;

    overridesData.forEach((ov) => {
      const isExpired = ov.expiresAt ? new Date(ov.expiresAt).getTime() < now : false;
      const isActive = ov.isActive && !isExpired;
      if (isActive) {
        active++;
        if (ov.type === OverrideType.ALLOW) allow++;
        if (ov.type === OverrideType.DENY) deny++;
        if (ov.feature === EMERGENCY_BYPASS_FEATURE) bypass++;
      }
    });

    return { total: overridesData.length, active, allow, deny, bypass };
  }, [overridesData]);

  // ═══════════════════════════════════════════════════════════════════
  // 3. GRANT FEATURE OVERRIDE MODAL STATE
  // ═══════════════════════════════════════════════════════════════════
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantTenantId, setGrantTenantId] = useState('');
  const [grantFeature, setGrantFeature] = useState<string>(ENTERPRISE_FEATURES[0]);
  const [grantType, setGrantType] = useState<OverrideType>(OverrideType.ALLOW);
  const [grantDurationHours, setGrantDurationHours] = useState<number>(24);
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [grantReason, setGrantReason] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);

  const isEmergencyBypassSelected = grantFeature === EMERGENCY_BYPASS_FEATURE;

  const openGrantModal = (prefillTenantId?: string, forceBypass?: boolean) => {
    setGrantTenantId(prefillTenantId || '');
    setGrantFeature(forceBypass ? EMERGENCY_BYPASS_FEATURE : ENTERPRISE_FEATURES[0]);
    setGrantType(OverrideType.ALLOW);
    setGrantDurationHours(forceBypass ? 24 : 24);
    setIsIndefinite(false);
    setGrantReason(forceBypass ? 'Emergency unthrottled incident bypass authorized.' : '');
    setGrantError(null);
    setIsGrantModalOpen(true);
  };

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (isEmergencyBypassSelected) {
        // Enforce 72h statutory maximum ceiling for emergency bypass
        if (grantDurationHours > 72 || grantDurationHours <= 0) {
          throw new Error('Emergency commercial bypass duration must be between 1 and 72 hours.');
        }

        const payload = {
          tenantId: grantTenantId.trim(),
          durationHours: Number(grantDurationHours),
          reason: grantReason.trim(),
        };
        const res = await api.post('/feature-overrides/emergency-bypass', payload);
        return res.data;
      } else {
        let expiresAt: string | null = null;
        if (!isIndefinite) {
          const d = new Date();
          d.setHours(d.getHours() + Number(grantDurationHours));
          expiresAt = d.toISOString();
        }

        const payload = {
          tenantId: grantTenantId.trim(),
          feature: grantFeature,
          type: grantType,
          expiresAt,
          reason: grantReason.trim(),
        };
        const res = await api.post('/feature-overrides', payload);
        return res.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-feature-overrides'] });
      setIsGrantModalOpen(false);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: isEmergencyBypassSelected ? 'Emergency Bypass Activated' : 'Feature Override Granted',
        message: data.message || `Successfully configured override for ${grantFeature}.`,
      });
    },
    onError: (err: any) => {
      setGrantError(
        err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to grant feature override.'
      );
    },
  });

  const handleGrantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError(null);

    if (!grantTenantId.trim()) {
      setGrantError('Valid Tenant ID is required.');
      return;
    }
    if (isEmergencyBypassSelected && !canManageEmergencyBypass) {
      setGrantError('Granting Emergency Commercial Bypass requires EMERGENCY_BYPASS_MANAGE platform privilege.');
      return;
    }
    if (isEmergencyBypassSelected && (grantDurationHours <= 0 || grantDurationHours > 72)) {
      setGrantError('Emergency Commercial Bypass duration must not exceed 72 hours.');
      return;
    }
    if (grantReason.trim().length < 10) {
      setGrantError('Operational reason must contain at least 10 characters for SOC2 audit compliance.');
      return;
    }

    grantMutation.mutate();
  };

  // Quick Bypass Mutation
  const quickBypassMutation = useMutation({
    mutationFn: async () => {
      if (quickBypassHours > 72 || quickBypassHours <= 0) {
        throw new Error('Statutory safeguard: Bypass duration must be between 1 and 72 hours.');
      }
      const payload = {
        tenantId: quickBypassTenantId.trim(),
        durationHours: Number(quickBypassHours),
        reason: quickBypassReason.trim(),
      };
      const res = await api.post('/feature-overrides/emergency-bypass', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-feature-overrides'] });
      setShowQuickBypassCard(false);
      setQuickBypassTenantId('');
      setQuickBypassReason('');
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Emergency Commercial Bypass Activated',
        message: data.message || '72h ceiling safeguard engaged. Tenant unthrottled.',
      });
    },
    onError: (err: any) => {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Emergency Bypass Failed',
        message: err.response?.data?.message || err.response?.data?.error || err.message || 'Operation failed.',
      });
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. REVOKE OVERRIDE ACTION & CONFIRM DIALOG STATE
  // ═══════════════════════════════════════════════════════════════════
  const [overrideToRevoke, setOverrideToRevoke] = useState<TenantFeatureOverride | null>(null);
  const [isRevokeConfirmOpen, setIsRevokeConfirmOpen] = useState(false);

  const initiateRevoke = (override: TenantFeatureOverride) => {
    setOverrideToRevoke(override);
    setIsRevokeConfirmOpen(true);
  };

  const revokeMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!overrideToRevoke) return;
      const res = await api.delete(`/feature-overrides/${overrideToRevoke._id}`, {
        data: { reason },
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-feature-overrides'] });
      setIsRevokeConfirmOpen(false);
      setOverrideToRevoke(null);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Feature Override Revoked',
        message: data?.message || 'Override deactivated; tenant restored to baseline plan capabilities.',
      });
    },
    onError: (err: any) => {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Revocation Failed',
        message: err.response?.data?.message || err.response?.data?.error || 'Failed to revoke override.',
      });
    },
  });

  const handleConfirmRevoke = async (reason: string) => {
    await revokeMutation.mutateAsync(reason);
  };

  return (
    <div className="space-y-6 select-text">
      {/* Toast Feedback Notification */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">Feature Overrides & Entitlements</h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-semibold">
              Gating Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Fine-grained per-tenant capability grants, commercial exceptions, and time-bound emergency bypasses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['platform-feature-overrides'] })}
            disabled={isOverridesFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 hover:border-slate-600 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh feature overrides from control plane"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isOverridesFetching ? 'animate-spin' : ''}`} />
            <span className="font-mono">Sync Overrides</span>
          </button>

          {canManageEmergencyBypass && (
            <button
              type="button"
              onClick={() => setShowQuickBypassCard(!showQuickBypassCard)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-950/80 hover:bg-amber-900/80 border border-amber-700/80 transition-all shadow-xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Emergency 72h Bypass</span>
            </button>
          )}

          {canManageOverrides && (
            <button
              type="button"
              onClick={() => openGrantModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Grant Feature Override</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: KPI Aggregates & Emergency Bypass Alert Banner
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
          <span className="text-[11px] font-mono text-slate-400">Total Registered</span>
          <div className="text-xl font-bold font-mono text-slate-100">
            <AnimatedCounter target={stats.total} />
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
          <span className="text-[11px] font-mono text-slate-400">Active Overrides</span>
          <div className="text-xl font-bold font-mono text-emerald-400">
            <AnimatedCounter target={stats.active} />
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
          <span className="text-[11px] font-mono text-slate-400">Entitlement Allows</span>
          <div className="text-xl font-bold font-mono text-cyan-400">
            <AnimatedCounter target={stats.allow} />
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
          <span className="text-[11px] font-mono text-slate-400">Explicit Locks (Deny)</span>
          <div className="text-xl font-bold font-mono text-rose-400">
            <AnimatedCounter target={stats.deny} />
          </div>
        </div>
      </div>

      {/* Emergency Commercial Bypass Alert Callout (If active) */}
      {stats.bypass > 0 && (
        <div className="p-4 bg-amber-950/60 border border-amber-800/90 rounded-xl flex items-start gap-3.5 text-xs text-amber-200 shadow-lg shadow-black/40">
          <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300 text-sm">
                Active Emergency Commercial Bypass In Effect
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-900/80 text-amber-200 border border-amber-700">
                {stats.bypass} Tenant(s) Unlocked
              </span>
            </div>
            <p className="leading-relaxed text-[11px] text-amber-200/90">
              One or more tenants currently hold an unthrottled Emergency Commercial Bypass, bypassing SaaS subscription tier restrictions. Bypasses are audited with CRITICAL severity and must be revoked once operational incidents are resolved.
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION: Emergency Commercial Bypass Quick-Action Card (72h Safeguard)
          ───────────────────────────────────────────────────────────── */}
      {showQuickBypassCard && (
        <div className="p-5 bg-amber-950/40 border border-amber-700/80 rounded-xl space-y-4 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-amber-800/60">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-amber-200">
                  Emergency Commercial Bypass Authorization
                </h3>
                <p className="text-xs text-amber-400/80">
                  Statutory safeguard: Strict 72-hour hard ceiling enforced. Bypasses all plan gating immediately.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickBypassCard(false)}
              className="text-amber-400 hover:text-amber-200 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              quickBypassMutation.mutate();
            }}
            className="space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">
                  Target Tenant ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={quickBypassTenantId}
                  onChange={(e) => setQuickBypassTenantId(e.target.value)}
                  placeholder="65f1a2b3c4d5e6f7a8b9c0d1"
                  className="w-full bg-slate-950 border border-amber-800/80 focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-medium block">
                    Duration (1 to 72 hours max) <span className="text-rose-400">*</span>
                  </label>
                  <span className="font-mono text-amber-400 font-bold">{quickBypassHours} Hours</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={quickBypassHours}
                  onChange={(e) => setQuickBypassHours(Math.min(72, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-full bg-slate-950 border border-amber-800/80 focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">
                  Audit Justification <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={quickBypassReason}
                  onChange={(e) => setQuickBypassReason(e.target.value)}
                  placeholder="e.g. Critical GST e-invoicing deadline buffer"
                  className="w-full bg-slate-950 border border-amber-800/80 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none min-h-[44px]"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={quickBypassMutation.isPending || !quickBypassTenantId.trim() || quickBypassReason.trim().length < 10}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold cursor-pointer inline-flex items-center gap-2"
              >
                {quickBypassMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Engaging 72h Bypass...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Authorize Emergency Bypass (72h Max)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION: Active Overrides Table & Dual Mobile View
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-xs space-y-0">
        {/* Table Filters Toolbar */}
        <div className="p-4 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200 tracking-tight">Active Entitlement Overrides</h2>
            <span className="text-[11px] font-mono text-slate-400">
              ({filteredOverrides.length} records shown)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[
                { key: 'ACTIVE_ONLY', label: 'Active' },
                { key: 'ALL', label: 'All History' },
                { key: 'INACTIVE_ONLY', label: 'Revoked/Expired' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setParam('status', st.key)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer min-h-[30px] flex items-center ${
                    statusFilter === st.key
                      ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['ALL', 'ALLOW', 'DENY'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setParam('type', tp)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer min-h-[30px] flex items-center ${
                    typeFilter === tp
                      ? tp === 'ALLOW'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : tp === 'DENY'
                        ? 'bg-rose-950 text-rose-300 border border-rose-700'
                        : 'bg-slate-800 text-cyan-300 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tp}
                </button>
              ))}
            </div>

            {/* Feature Dropdown Filter */}
            <select
              value={featureFilter}
              onChange={(e) => setParam('feature', e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono min-h-[36px]"
            >
              <option value="ALL">All Features</option>
              <option value={EMERGENCY_BYPASS_FEATURE}>EMERGENCY_BYPASS</option>
              {ENTERPRISE_FEATURES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* Debounced Search Input */}
            <SearchInput
              value={searchQuery}
              onChange={(val) => setParam('search', val)}
              placeholder="Search tenant, reason, operator..."
              className="w-full sm:w-56"
            />
          </div>
        </div>

        {/* ─── A. DESKTOP VIEW (Table: md and up) ─── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Target Tenant</th>
                <th className="py-3 px-4">Feature Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Reason / Audit Trail</th>
                <th className="py-3 px-4">Granted By</th>
                <th className="py-3 px-4">Expiration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isOverridesLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono text-xs">
                    <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
                    Loading platform feature overrides...
                  </td>
                </tr>
              ) : filteredOverrides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs space-y-1">
                    <p className="font-medium text-slate-400">No feature overrides match the active filter criteria.</p>
                    <p className="text-[11px] text-slate-400">
                      Use the &quot;Grant Feature Override&quot; button to establish fine-grained gating exceptions.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOverrides.map((ov) => {
                  const tenantIdStr = typeof ov.tenantId === 'string' ? ov.tenantId : ov.tenantId?._id || '';
                  const firmName = typeof ov.tenantId === 'object' && ov.tenantId?.firmName ? ov.tenantId.firmName : null;

                  const isExpired = ov.expiresAt ? new Date(ov.expiresAt).getTime() < Date.now() : false;
                  const isEffectiveActive = ov.isActive && !isExpired;

                  const isEmergencyBypass = ov.feature === EMERGENCY_BYPASS_FEATURE;
                  const countdown = getExpiryCountdown(ov.expiresAt);

                  const creatorEmail =
                    typeof ov.createdBy === 'object' && ov.createdBy !== null
                      ? ov.createdBy.email
                      : 'Platform Operator';
                  const creatorRole =
                    typeof ov.createdBy === 'object' && ov.createdBy !== null
                      ? ov.createdBy.role
                      : '';

                  return (
                    <tr
                      key={ov._id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Tenant ID */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {firmName && (
                            <span className="font-semibold text-slate-200 block truncate max-w-[160px]">
                              {firmName}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                            <span className="truncate max-w-[120px]">{tenantIdStr}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(tenantIdStr, ov._id)}
                              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                              title="Copy Tenant ID"
                            >
                              {copiedId === ov._id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Feature Name */}
                      <td className="py-3 px-4">
                        {isEmergencyBypass ? (
                          <span className="font-mono font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/80 inline-flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-400" />
                            EMERGENCY_BYPASS
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800/90 text-cyan-300 border border-slate-700/80">
                            {ov.feature}
                          </span>
                        )}
                      </td>

                      {/* Type (ALLOW / DENY) */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          variant={ov.type === OverrideType.ALLOW ? 'emerald' : 'rose'}
                          label={ov.type}
                          dot
                        />
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 max-w-[200px]">
                          <span className="text-slate-300 truncate text-xs block">
                            {ov.reason}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedReason({
                                feature: ov.feature,
                                reason: ov.reason,
                                tenantId: tenantIdStr,
                                grantedBy: creatorEmail,
                              })
                            }
                            className="text-cyan-400 hover:text-cyan-300 shrink-0 text-[10px] font-mono cursor-pointer"
                            title="Inspect full operational justification"
                          >
                            [view]
                          </button>
                        </div>
                      </td>

                      {/* Granted By */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <span className="text-slate-300 block truncate max-w-[160px]">
                            {creatorEmail}
                          </span>
                          {creatorRole && (
                            <span className="text-[10px] text-slate-400 block uppercase">
                              {creatorRole}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Expiration */}
                      <td className="py-3 px-4 font-mono">
                        <div className="space-y-0.5">
                          <span
                            className={`font-semibold text-xs block ${
                              countdown.isPast
                                ? 'text-rose-400'
                                : ov.expiresAt
                                ? 'text-amber-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {countdown.text}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                            {formatISTDateTime(ov.expiresAt)}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          variant={
                            !ov.isActive
                              ? 'slate'
                              : isExpired
                              ? 'rose'
                              : isEmergencyBypass
                              ? 'amber'
                              : 'emerald'
                          }
                          label={
                            !ov.isActive
                              ? 'REVOKED'
                              : isExpired
                              ? 'EXPIRED'
                              : isEmergencyBypass
                              ? 'ACTIVE (BYPASS)'
                              : 'ACTIVE'
                          }
                          dot
                        />
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        {isEffectiveActive && canManageOverrides ? (
                          <button
                            type="button"
                            onClick={() => initiateRevoke(ov)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-[11px] font-mono transition-colors cursor-pointer shadow-xs active:scale-95"
                            title="Revoke capability grant immediately"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            <span>Revoke</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-600">—</span>
                        )}
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
          {isOverridesLoading && (
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

          {!isOverridesLoading && filteredOverrides.length === 0 && (
            <div className="p-8 text-center text-xs space-y-3">
              <Sliders className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-300">No feature overrides found</p>
              <p className="text-slate-500">
                {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ACTIVE_ONLY' || featureFilter !== 'ALL'
                  ? 'No overrides match active filters.'
                  : 'No overrides configured.'}
              </p>
              <button
                type="button"
                onClick={() => resetParams()}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-cyan-600 text-white font-medium cursor-pointer inline-flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>Reset Filters</span>
              </button>
            </div>
          )}

          {!isOverridesLoading &&
            filteredOverrides.map((ov) => {
              const tenantIdStr = typeof ov.tenantId === 'string' ? ov.tenantId : ov.tenantId?._id || '';
              const firmName = typeof ov.tenantId === 'object' && ov.tenantId?.firmName ? ov.tenantId.firmName : null;
              const isExpired = ov.expiresAt ? new Date(ov.expiresAt).getTime() < Date.now() : false;
              const isEffectiveActive = ov.isActive && !isExpired;
              const isEmergencyBypass = ov.feature === EMERGENCY_BYPASS_FEATURE;
              const countdown = getExpiryCountdown(ov.expiresAt);

              const creatorEmail =
                typeof ov.createdBy === 'object' && ov.createdBy !== null
                  ? ov.createdBy.email
                  : 'Platform Operator';

              // Summary: 74-82px bounded height, single line text truncation
              const cardSummary = (
                <div className="flex items-center gap-3 min-w-0 pr-1">
                  <div
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 select-none shadow-2xs ${
                      isEmergencyBypass
                        ? 'bg-amber-950/80 border-amber-700/80 text-amber-300'
                        : ov.type === OverrideType.ALLOW
                        ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
                        : 'bg-rose-950/80 border-rose-700/80 text-rose-300'
                    }`}
                  >
                    {isEmergencyBypass ? <Zap className="w-4 h-4" /> : <Sliders className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 truncate text-xs block font-mono">
                        {isEmergencyBypass ? 'EMERGENCY_BYPASS' : ov.feature}
                      </span>
                      <StatusBadge
                        variant={ov.type === OverrideType.ALLOW ? 'emerald' : 'rose'}
                        label={ov.type}
                        size="sm"
                        dot
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                      <span className="truncate">
                        {firmName || tenantIdStr.slice(-8)}
                      </span>
                      <span
                        className={`font-semibold shrink-0 ${
                          countdown.isPast ? 'text-rose-400' : 'text-amber-300'
                        }`}
                      >
                        {countdown.text}
                      </span>
                    </div>
                  </div>
                </div>
              );

              return (
                <CollapsibleMobileCard
                  key={ov._id}
                  id={ov._id}
                  entityType="override"
                  statusVariant={isEmergencyBypass ? 'warning' : isEffectiveActive ? 'active' : 'default'}
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
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Expires: {formatISTDateTime(ov.expiresAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 col-span-full">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">Granted by: {creatorEmail}</span>
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded border border-slate-800 col-span-full text-slate-300 font-sans">
                        <span className="text-slate-400 font-mono text-[10px] block uppercase mb-0.5">
                          Audit Justification
                        </span>
                        <p className="line-clamp-2">{ov.reason}</p>
                      </div>
                    </div>

                    {/* Structured 2x2 Action Grid with min-h-[44px] touch targets */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                      {/* Action 1: Reason */}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedReason({
                            feature: ov.feature,
                            reason: ov.reason,
                            tenantId: tenantIdStr,
                            grantedBy: creatorEmail,
                          })
                        }
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                        aria-label="View full audit reason"
                      >
                        <Eye className="w-4 h-4 text-cyan-400" />
                        <span>Reason</span>
                      </button>

                      {/* Action 2: Bypass */}
                      <button
                        type="button"
                        onClick={() => openGrantModal(tenantIdStr, true)}
                        disabled={!canManageEmergencyBypass}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 active:bg-amber-900/60 text-amber-300 border border-amber-800/60 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors"
                        aria-label="Trigger emergency commercial bypass"
                      >
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span>Bypass</span>
                      </button>

                      {/* Action 3: Copy ID */}
                      <button
                        type="button"
                        onClick={() => handleCopy(tenantIdStr, ov._id)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                        aria-label="Copy Tenant ID"
                      >
                        {copiedId === ov._id ? (
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

                      {/* Action 4: Revoke */}
                      <button
                        type="button"
                        onClick={() => initiateRevoke(ov)}
                        disabled={!isEffectiveActive || !canManageOverrides}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 active:bg-rose-900/60 text-rose-300 border border-rose-800/60 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors"
                        aria-label="Revoke override"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </div>
                </CollapsibleMobileCard>
              );
            })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Grant Feature Override / Emergency Commercial Bypass
          ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isGrantModalOpen}
        onClose={() => setIsGrantModalOpen(false)}
        title={isEmergencyBypassSelected ? 'Authorize Emergency Commercial Bypass' : 'Grant Tenant Feature Override'}
        maxWidth="lg"
      >
        <form onSubmit={handleGrantSubmit} className="space-y-4">
          {/* Statutory 72h Warning Callout for Emergency Bypass */}
          {isEmergencyBypassSelected ? (
            <div className="p-3.5 bg-amber-950/60 border border-amber-800/80 rounded-lg flex items-start gap-3 text-xs text-amber-200">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100">
                  CRITICAL: Emergency Commercial Bypass (Statutory 72-Hour Safeguard)
                </p>
                <p className="text-amber-300/90 leading-relaxed">
                  This action overrides all plan gating and grants full unrestricted write/read access to the tenant. Under platform regulations, this bypass is <strong>hard-capped at a statutory ceiling of 72 hours max</strong> and requires an audited incident reason.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg flex items-start gap-3 text-xs text-slate-300">
              <Sliders className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-200">
                  Capability Entitlement Rule
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Configure explicit per-tenant capability overrides that take precedence over the subscription plan default.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Field: Target Tenant ID */}
            <div className="space-y-1.5">
              <label htmlFor="grant-tenant-id" className="block text-xs font-medium text-slate-300">
                Target Tenant ID <span className="text-rose-400">*</span>
              </label>
              <input
                id="grant-tenant-id"
                type="text"
                value={grantTenantId}
                onChange={(e) => setGrantTenantId(e.target.value)}
                placeholder="65f1a2b3c4d5e6f7a8b9c0d1"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors min-h-[44px]"
                required
              />
            </div>

            {/* Field: Feature */}
            <div className="space-y-1.5">
              <label htmlFor="grant-feature" className="block text-xs font-medium text-slate-300">
                Entitlement Capability / Flag <span className="text-rose-400">*</span>
              </label>
              <select
                id="grant-feature"
                value={grantFeature}
                onChange={(e) => setGrantFeature(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none transition-colors min-h-[44px]"
              >
                {canManageEmergencyBypass && (
                  <option value={EMERGENCY_BYPASS_FEATURE}>
                    EMERGENCY_COMMERCIAL_BYPASS (Critical Incident Resolution)
                  </option>
                )}
                {ENTERPRISE_FEATURES.map((feat) => (
                  <option key={feat} value={feat}>
                    {feat}
                  </option>
                ))}
              </select>
            </div>

            {/* Field: Type (ALLOW / DENY) */}
            {!isEmergencyBypassSelected && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Override Policy Type <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGrantType(OverrideType.ALLOW)}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-all min-h-[44px] ${
                      grantType === OverrideType.ALLOW
                        ? 'bg-emerald-950/80 text-emerald-200 border-emerald-700/80 shadow-xs'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Unlock className="w-4 h-4 text-emerald-400" />
                    <span>ALLOW (Grant Entitlement)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGrantType(OverrideType.DENY)}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-all min-h-[44px] ${
                      grantType === OverrideType.DENY
                        ? 'bg-rose-950/80 text-rose-200 border-rose-700/80 shadow-xs'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span>DENY (Explicit Lockout)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Field: Duration & Expiration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Duration / Expiry Ceiling <span className="text-rose-400">*</span>
                </label>
                {!isEmergencyBypassSelected && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isIndefinite}
                      onChange={(e) => setIsIndefinite(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    <span>Indefinite / Permanent</span>
                  </label>
                )}
              </div>

              {!isIndefinite && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={isEmergencyBypassSelected ? 72 : 8760}
                      value={grantDurationHours}
                      onChange={(e) => setGrantDurationHours(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors min-h-[44px]"
                      required
                    />
                    <span className="text-xs text-slate-400 font-mono shrink-0">Hours</span>
                  </div>
                  {isEmergencyBypassSelected && (
                    <p className="text-[11px] text-amber-400 font-mono">
                      Statutory ceiling: Maximum 72 hours allowed for emergency bypass.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Field: Mandatory Reason */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="grant-reason" className="block text-xs font-medium text-slate-300">
                  Mandatory Audit Reason <span className="text-rose-400">*</span>
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    grantReason.trim().length >= 10 ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {grantReason.trim().length}/10 chars min
                </span>
              </div>
              <textarea
                id="grant-reason"
                rows={3}
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="Operational justification for granting this override (e.g. Enabling E-Invoicing trial pending bank payment confirmation)..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          {grantError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-300">
              <span className="font-semibold">Grant Failed: </span>
              {grantError}
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsGrantModalOpen(false)}
              className="px-4 py-2 min-h-[44px] rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                grantMutation.isPending ||
                !grantTenantId.trim() ||
                (isEmergencyBypassSelected && (grantDurationHours <= 0 || grantDurationHours > 72)) ||
                grantReason.trim().length < 10
              }
              className={`inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-lg text-xs font-semibold shadow-xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                isEmergencyBypassSelected
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
              }`}
            >
              {grantMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enforcing Policy...</span>
                </>
              ) : isEmergencyBypassSelected ? (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Authorize 72h Emergency Bypass</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Authorize & Grant Override</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Full Reason Inspection Modal
          ───────────────────────────────────────────────────────────── */}
      {selectedReason && (
        <Modal
          isOpen={!!selectedReason}
          onClose={() => setSelectedReason(null)}
          title={`Audit Justification: ${selectedReason.feature}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>Tenant ID:</span>
                <span className="text-cyan-400">{selectedReason.tenantId}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Granted By:</span>
                <span className="text-slate-200">{selectedReason.grantedBy}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider font-mono">
                Cryptographically Signed Reason
              </span>
              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 leading-relaxed font-sans select-text whitespace-pre-wrap">
                {selectedReason.reason}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedReason(null)}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CONFIRM DIALOG: Revoke Override
          ───────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={isRevokeConfirmOpen}
        onClose={() => {
          setIsRevokeConfirmOpen(false);
          setOverrideToRevoke(null);
        }}
        onConfirm={handleConfirmRevoke}
        title={`Revoke Override: ${overrideToRevoke?.feature || 'Feature'}`}
        description="This will immediately deactivate the entitlement grant or lockout policy for this tenant. The firm will revert to baseline entitlements defined in their active SaaS subscription tier. This revocation is cryptographically signed to the platform audit log."
        confirmLabel="Revoke Override Immediately"
        severity="danger"
        minReasonLength={10}
        isLoading={revokeMutation.isPending}
      />
    </div>
  );
};

export default FeaturesPage;
