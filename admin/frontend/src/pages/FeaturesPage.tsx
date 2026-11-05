/**
 * Bharat Enterprise Billing System — Platform Feature Overrides & Entitlements
 * Fine-grained per-tenant capability grants, commercial gating exceptions,
 * and high-severity emergency commercial bypass administration.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { Toast, ToastMessage } from '../components/common/Toast';
import { usePlatformAuth } from '../contexts/PlatformAuthContext';
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
  // 2. SEARCH & FILTER STATE
  // ═══════════════════════════════════════════════════════════════════
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ALLOW' | 'DENY'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE_ONLY' | 'INACTIVE_ONLY'>('ACTIVE_ONLY');
  const [featureFilter, setFeatureFilter] = useState<string>('ALL');

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
        const tenantStr = typeof item.tenantId === 'string' ? item.tenantId : item.tenantId._id;
        const grantedByEmail =
          typeof item.createdBy === 'object' && item.createdBy !== null
            ? item.createdBy.email.toLowerCase()
            : '';
        const matchTenant = tenantStr.toLowerCase().includes(q);
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

  const openGrantModal = (prefillTenantId?: string) => {
    setGrantTenantId(prefillTenantId || '');
    setGrantFeature(ENTERPRISE_FEATURES[0]);
    setGrantType(OverrideType.ALLOW);
    setGrantDurationHours(24);
    setIsIndefinite(false);
    setGrantReason('');
    setGrantError(null);
    setIsGrantModalOpen(true);
  };

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (isEmergencyBypassSelected) {
        // Enforce 72h max ceiling for emergency bypass
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

        <div className="flex items-center gap-2.5">
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
          <div className="text-xl font-bold font-mono text-slate-100">{stats.total}</div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
          <span className="text-[11px] font-mono text-slate-400">Active Overrides</span>
          <div className="text-xl font-bold font-mono text-emerald-400">{stats.active}</div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
          <span className="text-[11px] font-mono text-slate-400">Entitlement Allows</span>
          <div className="text-xl font-bold font-mono text-cyan-400">{stats.allow}</div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
          <span className="text-[11px] font-mono text-slate-400">Explicit Locks (Deny)</span>
          <div className="text-xl font-bold font-mono text-rose-400">{stats.deny}</div>
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
          SECTION: Active Overrides Table
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
                  onClick={() => setStatusFilter(st.key as any)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer ${
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
                  onClick={() => setTypeFilter(tp)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer ${
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
              onChange={(e) => setFeatureFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="ALL">All Features</option>
              <option value={EMERGENCY_BYPASS_FEATURE}>EMERGENCY_BYPASS</option>
              {ENTERPRISE_FEATURES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tenant, reason, operator..."
                className="bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors w-48 sm:w-56 font-mono"
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
                  const tenantIdStr = typeof ov.tenantId === 'string' ? ov.tenantId : ov.tenantId._id;
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
                          <span className="text-[10px] text-slate-400 block">
                            {formatISTDateTime(ov.expiresAt)}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          variant={
                            isEffectiveActive
                              ? 'emerald'
                              : isExpired
                              ? 'amber'
                              : 'slate'
                          }
                          label={
                            isEffectiveActive
                              ? 'ACTIVE'
                              : isExpired
                              ? 'EXPIRED'
                              : 'REVOKED'
                          }
                          dot={isEffectiveActive}
                        />
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        {isEffectiveActive && canManageOverrides ? (
                          <button
                            type="button"
                            onClick={() => initiateRevoke(ov)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-mono text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Revoke active feature override"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            <span>Revoke</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: "Grant Feature Override"
          ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isGrantModalOpen}
        onClose={() => setIsGrantModalOpen(false)}
        title="Grant Per-Tenant Feature Override"
        maxWidth="lg"
      >
        <form onSubmit={handleGrantSubmit} className="space-y-4">
          {/* Target Tenant ID */}
          <div className="space-y-1.5">
            <label htmlFor="grant-tenant-id" className="block text-xs font-medium text-slate-300">
              Target Tenant Identifier <span className="text-rose-400">*</span>
            </label>
            <input
              id="grant-tenant-id"
              type="text"
              value={grantTenantId}
              onChange={(e) => setGrantTenantId(e.target.value)}
              placeholder="e.g. 65f1a2b3c4d5e6f7a8b9c0d1"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
              required
            />
          </div>

          {/* Feature Selector */}
          <div className="space-y-1.5">
            <label htmlFor="grant-feature" className="block text-xs font-medium text-slate-300">
              Target Capability / Feature Selector <span className="text-rose-400">*</span>
            </label>
            <select
              id="grant-feature"
              value={grantFeature}
              onChange={(e) => {
                const nextFeat = e.target.value;
                setGrantFeature(nextFeat);
                if (nextFeat === EMERGENCY_BYPASS_FEATURE) {
                  setGrantType(OverrideType.ALLOW);
                  setIsIndefinite(false);
                  if (grantDurationHours > 72) setGrantDurationHours(12);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none transition-colors"
            >
              <optgroup label="High Severity Emergency Commercial Bypass">
                <option value={EMERGENCY_BYPASS_FEATURE}>
                  ⚡ EMERGENCY_BYPASS (Overrides all commercial subscription limits)
                </option>
              </optgroup>
              <optgroup label="Enterprise Core Capabilities">
                {ENTERPRISE_FEATURES.map((feat) => (
                  <option key={feat} value={feat}>
                    {feat}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Emergency Bypass Warning Banner (If Selected) */}
          {isEmergencyBypassSelected && (
            <div className="p-3.5 bg-amber-950/70 border border-amber-800/90 rounded-lg flex items-start gap-3 text-xs text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-300">
                  Critical Emergency Commercial Bypass Notice
                </span>
                <p className="leading-relaxed text-[11px] text-amber-200/90">
                  This privilege enables unthrottled access across every enterprise module regardless of expired, suspended, or grace subscription states. SOC2 compliance strictly limits grants to a maximum of 72 hours.
                </p>
              </div>
            </div>
          )}

          {/* Override Type Selector (ALLOW vs DENY) */}
          {!isEmergencyBypassSelected && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Override Enforcement Type <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGrantType(OverrideType.ALLOW)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    grantType === OverrideType.ALLOW
                      ? 'bg-emerald-950/70 border-emerald-600 text-emerald-200 shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ALLOW (Grant Access)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Explicitly authorizes capability even if excluded from current subscription plan.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setGrantType(OverrideType.DENY)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    grantType === OverrideType.DENY
                      ? 'bg-rose-950/70 border-rose-600 text-rose-200 shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>DENY (Explicit Lock)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Locks capability even if included in current plan tier.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Duration & Expiration Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="grant-duration" className="block text-xs font-medium text-slate-300">
                Entitlement Expiry & Duration <span className="text-rose-400">*</span>
              </label>
              {!isEmergencyBypassSelected && (
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isIndefinite}
                    onChange={(e) => setIsIndefinite(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-400 focus:ring-0 bg-slate-950"
                  />
                  <span className="font-mono text-[11px]">Permanent / Indefinite</span>
                </label>
              )}
            </div>

            {!isIndefinite && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    id="grant-duration"
                    type="number"
                    value={grantDurationHours}
                    onChange={(e) => setGrantDurationHours(parseInt(e.target.value, 10) || 1)}
                    max={isEmergencyBypassSelected ? 72 : 8760}
                    min={1}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none transition-colors"
                    required
                  />
                  <span className="text-xs text-slate-400 font-mono shrink-0">Hours</span>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400">Presets:</span>
                  {(isEmergencyBypassSelected ? [6, 12, 24, 48, 72] : [12, 24, 48, 168, 720]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setGrantDurationHours(h)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        grantDurationHours === h
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'
                      }`}
                    >
                      {h >= 24 ? `${h / 24}d (${h}h)` : `${h}h`}
                    </button>
                  ))}
                </div>

                {isEmergencyBypassSelected && grantDurationHours > 72 && (
                  <p className="text-[11px] text-rose-400 font-mono">
                    Enforcement Error: Emergency Bypass duration cannot exceed 72 hours.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Operational Reason (>= 10 chars) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="grant-reason" className="block text-xs font-medium text-slate-300">
                Operational Reason & Audit Justification <span className="text-rose-400">*</span>
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
              placeholder="e.g. Granted temporary Inventory Ledger access to test beta release for Enterprise client."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors resize-none"
              required
            />
          </div>

          {/* Error Message Banner */}
          {grantError && (
            <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{grantError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsGrantModalOpen(false)}
              disabled={grantMutation.isPending}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                grantMutation.isPending ||
                !grantTenantId.trim() ||
                (isEmergencyBypassSelected && grantDurationHours > 72) ||
                grantReason.trim().length < 10
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {grantMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing Override...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Authorize Override</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

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
        title="Revoke Tenant Feature Override"
        description={`You are about to revoke the active "${overrideToRevoke?.feature}" override for tenant "${
          typeof overrideToRevoke?.tenantId === 'string'
            ? overrideToRevoke.tenantId
            : overrideToRevoke?.tenantId?._id
        }". Tenant access will immediately revert to their baseline SaaS subscription entitlements.`}
        confirmLabel="Revoke Override"
        severity="danger"
        minReasonLength={10}
        isLoading={revokeMutation.isPending}
      />

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Inspect Full Operational Reason
          ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(selectedReason)}
        onClose={() => setSelectedReason(null)}
        title="Operational Justification & Audit Context"
        maxWidth="md"
      >
        {selectedReason && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span>Feature:</span>
                <span className="text-cyan-400 font-bold">{selectedReason.feature}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Tenant ID:</span>
                <span className="text-slate-200">{selectedReason.tenantId}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Operator:</span>
                <span className="text-slate-200">{selectedReason.grantedBy}</span>
              </div>
            </div>

            <div className="space-y-1.5 font-sans">
              <span className="text-xs font-medium text-slate-300 block">
                SOC2 Recorded Operational Reason:
              </span>
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 leading-relaxed text-xs">
                {selectedReason.reason}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setSelectedReason(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FeaturesPage;