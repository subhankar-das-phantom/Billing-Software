/**
 * Bharat Enterprise Billing System — Platform Control Plane Dashboard
 * High-density executive overview, cross-tenant telemetry, contracted MRR tracking,
 * subscription lifecycle distribution, and tamper-evident audit inspection.
 *
 * Modularized Architecture:
 * - DashboardHero: Indian financial context (Q3 FY2026-27), live sync pulse, time horizon pills, primary CTAs.
 * - DashboardKPIGrid: 5-card bento grid with exact paise precision (MRR, Tenants, Revenue, Diagnostics, Audit).
 * - LiveCalendarClock: Isolated leaf component preventing whole-tree timer re-rendering.
 * - Subscription Lifecycle & Churn Breakdown.
 * - Administrative Quick Actions & Real-Time Telemetry Diagnostic Matrix.
 * - Recent Keyset Cryptographic Audit Stream with full state inspection modals.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  RefreshCw,
  UserPlus,
  Headphones,
  Sliders,
  Database,
  Server,
  Layers,
  ArrowRight,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Key,
  Shield,
  Zap,
} from 'lucide-react';
import api from '../services/api';
import StatusBadge, { StatusVariant } from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import { usePlatformAuth } from '../contexts/PlatformAuthContext';
import {
  PlatformRole,
  PlatformPermission,
  type DashboardOverviewDTO,
  type AuditLog,
  type AuditSeverity,
  type TenantListItemDTO,
  type ActiveSupportSession,
} from '../types';
import DashboardHero, { DashboardTimeHorizon } from '../components/dashboard/DashboardHero';
import DashboardKPIGrid from '../components/dashboard/DashboardKPIGrid';
import LiveCalendarClock from '../components/dashboard/LiveCalendarClock';

// Helper to determine semantic badge color based on audit action
function getActionBadgeVariant(action: string): StatusVariant {
  const act = action.toUpperCase();
  if (act.includes('CREATE') || act.includes('ACTIVATE') || act.includes('LOGIN') || act.includes('START')) {
    return 'emerald';
  }
  if (act.includes('UPDATE') || act.includes('OVERRIDE') || act.includes('RESET')) {
    return 'amber';
  }
  if (act.includes('SUSPEND') || act.includes('REVOKE') || act.includes('END') || act.includes('DELETE') || act.includes('FAIL')) {
    return 'rose';
  }
  return 'sky';
}

function getSeverityVariant(severity: AuditSeverity): StatusVariant {
  switch (severity) {
    case 'CRITICAL':
    case 'SECURITY_ALERT':
      return 'rose';
    case 'WARNING':
      return 'amber';
    case 'INFO':
    default:
      return 'sky';
  }
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasPermission } = usePlatformAuth();

  // Granular Permission Evaluation
  const canOnboardUsers = hasPermission(PlatformPermission.USERS_MANAGE);
  const canLaunchSupport = hasPermission(PlatformPermission.SUPPORT_START);

  // Time horizon filter state
  const [timeHorizon, setTimeHorizon] = useState<DashboardTimeHorizon>('Today');

  // Modal States
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  // Quick Support Session Form State
  const [supportTenantId, setSupportTenantId] = useState('');
  const [supportReason, setSupportReason] = useState('');
  const [supportDuration, setSupportDuration] = useState(2);
  const [supportIsSubmitting, setSupportIsSubmitting] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  // Quick Platform User Form State
  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<PlatformRole>(PlatformRole.SUPPORT_AGENT);
  const [userIsSubmitting, setUserIsSubmitting] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccessMessage, setUserSuccessMessage] = useState<string | null>(null);

  // ─── 1. Query: Dashboard Overview ──────────────────────────────
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    isFetching: isOverviewFetching,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['platform-dashboard-overview'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DashboardOverviewDTO }>('/dashboard/overview');
      return res.data.data;
    },
    staleTime: 30000,
  });

  // ─── 2. Query: Recent Platform Audit Logs (limit=5) ─────────────
  const {
    data: recentAuditLogs,
    isLoading: isAuditLoading,
    isFetching: isAuditFetching,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['platform-audit-recent'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AuditLog[] }>('/audit?limit=5');
      return res.data.data;
    },
    staleTime: 30000,
  });

  // ─── 3. Query: Cryptographic Hash Chain Verification ───────────
  const {
    data: verificationData,
    isLoading: isVerifyLoading,
    isFetching: isVerifyFetching,
    refetch: refetchVerify,
  } = useQuery({
    queryKey: ['platform-audit-verify'],
    queryFn: async () => {
      const res = await api.get<{
        success: boolean;
        verification: {
          valid: boolean;
          verifiedCount: number;
          scope: string;
          error?: string;
        };
      }>('/audit/verify?scope=global');
      return res.data.verification;
    },
    staleTime: 60000,
  });

  // ─── 4. Query: Active Support Sessions Count ────────────────────
  const { data: activeSupportSession } = useQuery({
    queryKey: ['platform-support-active-session-summary'],
    queryFn: async () => {
      try {
        const res = await api.get<{ success: boolean; data: ActiveSupportSession | null }>(
          '/support/sessions/active'
        );
        return res.data.data;
      } catch {
        return null;
      }
    },
    staleTime: 15000,
  });

  // ─── 5. Query: Emergency Bypass Status Check ───────────────────
  const { data: featureOverridesData } = useQuery({
    queryKey: ['platform-features-bypass-summary'],
    queryFn: async () => {
      try {
        const res = await api.get<{
          success: boolean;
          data: {
            effectiveAccess?: { emergencyBypassActive: boolean };
          };
        }>('/features');
        return res.data.data;
      } catch {
        return null;
      }
    },
    staleTime: 30000,
  });

  // ─── 6. Query: Optional Tenant List for Support Launcher ────────
  const { data: tenantCandidates } = useQuery({
    queryKey: ['platform-tenants-quick-candidates'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TenantListItemDTO[] }>('/tenants?limit=15');
      return res.data.data;
    },
    staleTime: 60000,
    enabled: isSupportModalOpen,
  });

  // ─── Refresh All Telemetry ──────────────────────────────────────
  const isRefreshingAll = isOverviewFetching || isAuditFetching || isVerifyFetching;

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      refetchOverview(),
      refetchAudit(),
      refetchVerify(),
      queryClient.invalidateQueries({ queryKey: ['platform-dashboard-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-audit-recent'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-audit-verify'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-support-active-session-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-features-bypass-summary'] }),
    ]);
  }, [refetchOverview, refetchAudit, refetchVerify, queryClient]);

  // ─── Quick Support Session Submission ──────────────────────────
  const handleLaunchSupportSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportError(null);

    if (!supportTenantId.trim()) {
      setSupportError('Please provide a valid Target Tenant ID.');
      return;
    }
    if (!supportReason.trim() || supportReason.trim().length < 10) {
      setSupportError('Reason is mandatory and must contain at least 10 characters for audit compliance.');
      return;
    }

    setSupportIsSubmitting(true);
    try {
      const res = await api.post('/support/sessions', {
        targetTenantId: supportTenantId.trim(),
        reason: supportReason.trim(),
        durationHours: Number(supportDuration) || 2,
      });

      if (res.data?.success) {
        setIsSupportModalOpen(false);
        setSupportTenantId('');
        setSupportReason('');
        navigate('/support');
      } else {
        setSupportError(res.data?.error || 'Failed to start support session.');
      }
    } catch (err: any) {
      setSupportError(
        err.response?.data?.error || err.response?.data?.message || 'Error initiating support session'
      );
    } finally {
      setSupportIsSubmitting(false);
    }
  };

  // ─── Quick Platform User Onboarding ────────────────────────────
  const handleCreatePlatformUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccessMessage(null);

    if (!userFullName.trim() || !userEmail.trim() || !userPassword) {
      setUserError('Full Name, Email, and Temporary Password are required.');
      return;
    }

    setUserIsSubmitting(true);
    try {
      const res = await api.post('/users', {
        fullName: userFullName.trim(),
        email: userEmail.trim().toLowerCase(),
        password: userPassword,
        role: userRole,
        reason: 'Onboarded via Super Admin Command Center Quick Action',
      });

      if (res.data?.success) {
        setUserSuccessMessage(`Operator "${userFullName}" onboarded successfully.`);
        setUserFullName('');
        setUserEmail('');
        setUserPassword('');
        // Invalidate audit logs to immediately show the registration
        queryClient.invalidateQueries({ queryKey: ['platform-audit-recent'] });
        setTimeout(() => {
          setIsUserModalOpen(false);
          setUserSuccessMessage(null);
        }, 1200);
      } else {
        setUserError(res.data?.message || 'Failed to onboard platform user.');
      }
    } catch (err: any) {
      setUserError(
        err.response?.data?.message || err.response?.data?.error || 'Failed to onboard platform operator'
      );
    } finally {
      setUserIsSubmitting(false);
    }
  };

  // ─── Subscription Distribution Calculations ─────────────────────
  const tenants = overviewData?.tenants;
  const totalTenantCount = tenants?.total ?? 0;
  const activeCount = tenants?.active ?? 0;
  const trialCount = tenants?.trial ?? 0;
  const graceCount = tenants?.grace ?? 0;
  const expiredCount = tenants?.expired ?? 0;
  const suspendedCount = tenants?.suspended ?? 0;

  // Compute breakdown percentages safely
  const sumTracked = activeCount + trialCount + graceCount + expiredCount + suspendedCount;
  const denominator = sumTracked > 0 ? sumTracked : totalTenantCount > 0 ? totalTenantCount : 1;

  const pctActive = ((activeCount / denominator) * 100).toFixed(1);
  const pctTrial = ((trialCount / denominator) * 100).toFixed(1);
  const pctGrace = ((graceCount / denominator) * 100).toFixed(1);
  const pctExpired = ((expiredCount / denominator) * 100).toFixed(1);
  const pctSuspended = ((suspendedCount / denominator) * 100).toFixed(1);

  // Cache age calculation
  const cacheAgeSec = useMemo(() => {
    if (!overviewData?.systemHealth?.cacheTimestamp) return 0;
    const diff = Math.max(0, Date.now() - new Date(overviewData.systemHealth.cacheTimestamp).getTime());
    return Math.floor(diff / 1000);
  }, [overviewData?.systemHealth?.cacheTimestamp]);

  const latestAuditSequence = recentAuditLogs?.[0]?.sequence ?? 0;
  const activeEmergencyBypassCount = featureOverridesData?.effectiveAccess?.emergencyBypassActive ? 1 : 0;
  const activeSupportSessionsCount = activeSupportSession ? 1 : 0;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════
          MODULE 1: DASHBOARD COMMAND HERO
          Indian financial calendar context, live sync indicator, time horizon, and CTAs
          ═══════════════════════════════════════════════════════════════ */}
      <DashboardHero
        timeHorizon={timeHorizon}
        onTimeHorizonChange={setTimeHorizon}
        isSyncing={isRefreshingAll}
        onRefresh={handleRefreshAll}
        onOpenOnboardModal={() => setIsUserModalOpen(true)}
        onOpenDiagnosticModal={() => setIsSupportModalOpen(true)}
        canOnboardAdmin={canOnboardUsers}
        canStartDiagnostic={canLaunchSupport}
        clusterStatus={overviewData?.systemHealth?.status ?? 'HEALTHY'}
      />

      {/* ═══════════════════════════════════════════════════════════════
          MODULE 2: 5-CARD HIGH-DENSITY BENTO KPI GRID
          Contracted MRR, Active Tenants, Today's Revenue, Support Diagnostics, Cryptographic Audit
          ═══════════════════════════════════════════════════════════════ */}
      <DashboardKPIGrid
        overviewData={overviewData}
        verificationData={verificationData}
        activeSupportSessionsCount={activeSupportSessionsCount}
        activeEmergencyBypassCount={activeEmergencyBypassCount}
        latestAuditSequence={latestAuditSequence}
        isLoading={isOverviewLoading || isVerifyLoading}
      />

      {/* ═══════════════════════════════════════════════════════════════
          MODULE 3: PLAN & SUBSCRIPTION HEALTH BREAKDOWN
          ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Tenant Subscription Lifecycle & Churn Prevention
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status distribution across active plans, trials, grace periods, and operator suspensions.
            </p>
          </div>

          <Link
            to="/subscriptions"
            className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 self-start sm:self-auto"
          >
            Subscriptions Manager <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Visual Proportional Distribution Bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex border border-slate-700/60">
            {activeCount > 0 && (
              <div
                style={{ width: `${pctActive}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Active: ${activeCount} (${pctActive}%)`}
              />
            )}
            {trialCount > 0 && (
              <div
                style={{ width: `${pctTrial}%` }}
                className="bg-amber-400 h-full transition-all duration-300"
                title={`Trial: ${trialCount} (${pctTrial}%)`}
              />
            )}
            {graceCount > 0 && (
              <div
                style={{ width: `${pctGrace}%` }}
                className="bg-yellow-500 h-full transition-all duration-300"
                title={`Grace Period: ${graceCount} (${pctGrace}%)`}
              />
            )}
            {expiredCount > 0 && (
              <div
                style={{ width: `${pctExpired}%` }}
                className="bg-slate-600 h-full transition-all duration-300"
                title={`Expired: ${expiredCount} (${pctExpired}%)`}
              />
            )}
            {suspendedCount > 0 && (
              <div
                style={{ width: `${pctSuspended}%` }}
                className="bg-rose-500 h-full transition-all duration-300"
                title={`Suspended: ${suspendedCount} (${pctSuspended}%)`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>0%</span>
            <span>Total Lifecycle Scope: {totalTenantCount} Tenants</span>
            <span>100%</span>
          </div>
        </div>

        {/* 5 High-Density Distribution Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          {/* Active */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400">{activeCount}</div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>{pctActive}% share</span>
              <span className="text-emerald-500/80">Paid</span>
            </div>
          </div>

          {/* Trial */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">Trial</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>
            <div className="text-lg font-bold font-mono text-amber-300">{trialCount}</div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>{pctTrial}% share</span>
              <span className="text-amber-500/80">Evaluating</span>
            </div>
          </div>

          {/* Grace */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">Grace Buffer</span>
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            </div>
            <div className="text-lg font-bold font-mono text-yellow-300">{graceCount}</div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>{pctGrace}% share</span>
              <span className="text-yellow-500/80">Past Due</span>
            </div>
          </div>

          {/* Expired */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">Expired</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            </div>
            <div className="text-lg font-bold font-mono text-slate-400">{expiredCount}</div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>{pctExpired}% share</span>
              <span className="text-slate-500">Read-Only</span>
            </div>
          </div>

          {/* Suspended */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">Suspended</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            </div>
            <div className="text-lg font-bold font-mono text-rose-400">{suspendedCount}</div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>{pctSuspended}% share</span>
              <span className="text-rose-500/80">Locked</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODULE 4: QUICK ACTIONS + TELEMETRY DIAGNOSTICS
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Quick Actions Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100 tracking-tight flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Administrative Quick Actions
              </h2>
              <span className="text-[11px] font-mono text-slate-500">1-Click Fast Triggers</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Rapid access to operator onboarding, support impersonation, feature flags, and audit inspection.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Action 1: Onboard New Platform User */}
            <button
              type="button"
              onClick={() => setIsUserModalOpen(true)}
              disabled={!canOnboardUsers}
              title={canOnboardUsers ? 'Onboard new operator' : 'Requires USERS_MANAGE permission'}
              className={`p-3 rounded-lg border text-left transition-all group flex items-start gap-3 cursor-pointer min-h-[44px] ${
                canOnboardUsers
                  ? 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/40 border-slate-800/50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="p-2 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-400 group-hover:text-sky-300 shrink-0">
                <UserPlus className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                  Onboard Platform User
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {canOnboardUsers ? 'Invite operator & grant RBAC privileges' : 'Restricted (Owner/Admin only)'}
                </div>
              </div>
            </button>

            {/* Action 2: Launch Support Session */}
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              disabled={!canLaunchSupport}
              title={canLaunchSupport ? 'Launch diagnostic support session' : 'Requires SUPPORT_START permission'}
              className={`p-3 rounded-lg border text-left transition-all group flex items-start gap-3 cursor-pointer min-h-[44px] ${
                canLaunchSupport
                  ? 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/40 border-slate-800/50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="p-2 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:text-amber-300 shrink-0">
                <Headphones className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                  Launch Support Session
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {canLaunchSupport ? 'Audited time-capped tenant access' : 'Restricted (Support Admin only)'}
                </div>
              </div>
            </button>

            {/* Action 3: Inspect Audit Trail */}
            <Link
              to="/audit"
              className="p-3 rounded-lg bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-left transition-all group flex items-start gap-3 min-h-[44px]"
            >
              <div className="p-2 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:text-emerald-300 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                  Inspect Audit Trail
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  SHA-256 keyset log verification
                </div>
              </div>
            </Link>

            {/* Action 4: Manage Feature Overrides */}
            <Link
              to="/features"
              className="p-3 rounded-lg bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-left transition-all group flex items-start gap-3 min-h-[44px]"
            >
              <div className="p-2 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-400 group-hover:text-purple-300 shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                  Feature Overrides
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Tenant entitlements & bypass switches
                </div>
              </div>
            </Link>
          </div>

          {/* Action 5: Full Invalidation Footer Affordance */}
          <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-mono">Parallel Aggregation Engine (Zero $facet Anti-Pattern)</span>
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isRefreshingAll}
              className="text-blue-400 hover:text-blue-300 font-mono text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50 min-h-[32px]"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshingAll ? 'animate-spin' : ''}`} />
              Re-scan DB
            </button>
          </div>
        </div>

        {/* Right Column: Real-Time Telemetry & System Health Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 tracking-tight flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Real-Time Telemetry & System Architecture
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              OPTIMAL
            </span>
          </div>

          {/* High-Density Key-Value Diagnostic Rows */}
          <div className="divide-y divide-slate-800/80 text-xs">
            {/* Cluster Plane */}
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-500" /> Server Plane & Isolation
              </span>
              <span className="font-mono text-slate-200 font-medium">CONTROL_PLANE (Tenant-Isolated)</span>
            </div>

            {/* Database Engine */}
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-500" /> Database Engine
              </span>
              <span className="font-mono text-emerald-400 font-medium">MongoDB Cluster (ReadyState: 1)</span>
            </div>

            {/* Cache Status */}
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> In-Memory Cache (TTL 30s)
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                    overviewData?.systemHealth?.isCached
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {overviewData?.systemHealth?.isCached ? 'CACHE HIT' : 'DIRECT DB SCAN'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">{cacheAgeSec}s age</span>
              </div>
            </div>

            {/* Isolated Live IST Clock Leaf (Zero Re-render on page tree) */}
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <LiveCalendarClock showIcon={true} showDate={true} />
              </span>
              <span className="text-[10px] font-mono uppercase text-slate-500">Live Tick</span>
            </div>

            {/* Cryptographic Standard */}
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-500" /> Cryptographic Ledger
              </span>
              <span className="font-mono text-slate-300">SHA-256 Monotonic Hash Chain</span>
            </div>

            {/* Active User Session */}
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" /> Operator Active Context
              </span>
              <span className="font-mono text-blue-400 truncate max-w-[200px]" title={user?.email}>
                {user?.email || 'operator@platform.internal'} ({user?.role || 'SUPER_ADMIN'})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODULE 5: RECENT PLATFORM ACTIVITY STREAM (Audit Logs limit=5)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs space-y-0">
        <div className="p-4 border-b border-slate-800/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Recent Platform Activity & Cryptographic Log Stream
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live cryptographic event feed of administrative operations, session initiations, and tenant mutations.
            </p>
          </div>

          <Link
            to="/audit"
            className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 self-start sm:self-auto"
          >
            Full Keyset Audit Explorer <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Audit Log Table Feed */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-4 font-medium">Seq / Hash</th>
                <th className="py-2.5 px-4 font-medium">Timestamp (IST)</th>
                <th className="py-2.5 px-4 font-medium">Operator Email</th>
                <th className="py-2.5 px-4 font-medium">Action & Scope</th>
                <th className="py-2.5 px-4 font-medium">Target</th>
                <th className="py-2.5 px-4 font-medium">Severity</th>
                <th className="py-2.5 px-4 font-medium text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isAuditLoading ? (
                // Skeletons reserving space to eliminate CLS
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`audit-skel-${idx}`} className="animate-pulse">
                    <td className="py-3 px-4">
                      <div className="h-3 w-16 bg-slate-800 rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3 w-24 bg-slate-800 rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3 w-32 bg-slate-800 rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3 w-24 bg-slate-800 rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3 w-28 bg-slate-800 rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3 w-14 bg-slate-800 rounded" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-3 w-10 bg-slate-800 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : recentAuditLogs && recentAuditLogs.length > 0 ? (
                recentAuditLogs.map((log) => {
                  const actionVariant = getActionBadgeVariant(log.action);
                  const severityVariant = getSeverityVariant(log.severity);
                  const istFormatted = new Date(log.createdAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  });

                  return (
                    <tr
                      key={log._id}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedAuditLog(log)}
                    >
                      {/* Seq / Hash snippet */}
                      <td className="py-2.5 px-4 font-mono text-[11px]">
                        <span className="text-blue-400 font-semibold">#{log.sequence}</span>
                        <span className="text-slate-500 ml-1.5" title={log.hash}>
                          {log.hash ? `${log.hash.substring(0, 7)}…` : 'GENESIS'}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {istFormatted}
                      </td>

                      {/* Operator Email */}
                      <td className="py-2.5 px-4 text-slate-300 font-medium truncate max-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          <span className="truncate" title={log.actorEmail}>
                            {log.actorEmail || 'SYSTEM'}
                          </span>
                        </div>
                      </td>

                      {/* Action Tag & Scope */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge variant={actionVariant} label={log.action} size="sm" />
                          <span className="text-[10px] font-mono text-slate-500">[{log.scope}]</span>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] truncate max-w-[140px]">
                        <span className="text-slate-300">{log.targetType}</span>
                        {log.targetId && (
                          <span className="text-slate-500 ml-1">
                            :{log.targetId.substring(0, 6)}…
                          </span>
                        )}
                      </td>

                      {/* Severity */}
                      <td className="py-2.5 px-4">
                        <StatusBadge variant={severityVariant} label={log.severity} size="sm" />
                      </td>

                      {/* Inspection Button */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAuditLog(log);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Inspect full cryptographic record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono text-xs">
                    No recent audit activity found on global partition scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL 1: QUICK SUPPORT SESSION LAUNCHER
          ═══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isSupportModalOpen}
        onClose={() => {
          setIsSupportModalOpen(false);
          setSupportError(null);
        }}
        title="Launch Diagnostic Support Session"
        description="Audited tenant impersonation with cryptographically sealed operator tokens and mandatory compliance reason."
        maxWidth="lg"
      >
        <form onSubmit={handleLaunchSupportSession} className="space-y-4 text-xs">
          {supportError && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{supportError}</div>
            </div>
          )}

          {/* Target Tenant ID */}
          <div className="space-y-1">
            <label className="block text-slate-300 font-medium">Target Tenant ID / Firm</label>
            <input
              type="text"
              value={supportTenantId}
              onChange={(e) => setSupportTenantId(e.target.value)}
              placeholder="e.g. 670bc23fa819..."
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono text-xs"
            />
            {tenantCandidates && tenantCandidates.length > 0 && (
              <div className="pt-1 flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-slate-500">Quick Select:</span>
                {tenantCandidates.slice(0, 3).map((candidate) => (
                  <button
                    key={candidate.tenantId}
                    type="button"
                    onClick={() => setSupportTenantId(candidate.tenantId)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    {candidate.firmName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Session Reason */}
          <div className="space-y-1">
            <label className="block text-slate-300 font-medium">
              Mandatory Diagnostic Reason (min. 10 chars)
            </label>
            <textarea
              value={supportReason}
              onChange={(e) => setSupportReason(e.target.value)}
              placeholder="e.g. Investigating GSTIN invoice validation failure reported in Ticket #49102"
              rows={3}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-xs resize-none"
            />
          </div>

          {/* Duration in Hours */}
          <div className="space-y-1">
            <label className="block text-slate-300 font-medium">Session Max Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 4, 8].map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setSupportDuration(hours)}
                  className={`py-1.5 rounded-lg border font-mono text-xs transition-colors cursor-pointer min-h-[38px] ${
                    supportDuration === hours
                      ? 'bg-blue-950/70 border-blue-500/80 text-blue-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {hours} Hour{hours > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(false)}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={supportIsSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer min-h-[38px]"
            >
              {supportIsSubmitting ? 'Starting Session...' : 'Authorize Support Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL 2: QUICK PLATFORM USER ONBOARDING
          ═══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setUserError(null);
          setUserSuccessMessage(null);
        }}
        title="Onboard Platform Operator"
        description="Register a new platform user with granular role assignments and MFA enforcement."
        maxWidth="lg"
      >
        <form onSubmit={handleCreatePlatformUser} className="space-y-4 text-xs">
          {userError && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{userError}</div>
            </div>
          )}

          {userSuccessMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{userSuccessMessage}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Full Name */}
            <div className="space-y-1">
              <label className="block text-slate-300 font-medium">Full Name</label>
              <input
                type="text"
                value={userFullName}
                onChange={(e) => setUserFullName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-xs"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="block text-slate-300 font-medium">Operator Email</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="ramesh@bharatenterprise.in"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Temporary Password */}
            <div className="space-y-1">
              <label className="block text-slate-300 font-medium">Temporary Password</label>
              <input
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono text-xs"
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-1">
              <label className="block text-slate-300 font-medium">Platform Role</label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as PlatformRole)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-xs cursor-pointer"
              >
                <option value={PlatformRole.PLATFORM_ADMIN}>Platform Admin (High Privilege)</option>
                <option value={PlatformRole.SUPPORT_ADMIN}>Support Admin</option>
                <option value={PlatformRole.SUPPORT_AGENT}>Support Agent</option>
                <option value={PlatformRole.TELESUPPORT}>Telesupport</option>
                <option value={PlatformRole.READ_ONLY}>Read Only Auditor</option>
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Note: Newly registered platform users are required to change their password and register TOTP Multi-Factor Authentication upon initial sign-in.
          </p>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <Link
              to="/users"
              onClick={() => setIsUserModalOpen(false)}
              className="text-blue-400 hover:text-blue-300 font-mono text-xs flex items-center gap-1"
            >
              Full Users Directory →
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={userIsSubmitting}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer min-h-[38px]"
              >
                {userIsSubmitting ? 'Onboarding...' : 'Create Platform User'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL 3: AUDIT RECORD DEEP INSPECTION
          ═══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={Boolean(selectedAuditLog)}
        onClose={() => setSelectedAuditLog(null)}
        title={`Audit Log Record #${selectedAuditLog?.sequence}`}
        description="Immutable cryptographic transaction details and state delta payload."
        maxWidth="xl"
      >
        {selectedAuditLog && (
          <div className="space-y-4 text-xs font-mono">
            {/* Metadata Summary */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Action:</span>
                <StatusBadge
                  variant={getActionBadgeVariant(selectedAuditLog.action)}
                  label={selectedAuditLog.action}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Timestamp:</span>
                <span>{new Date(selectedAuditLog.createdAt).toISOString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Actor Email:</span>
                <span className="text-blue-400">{selectedAuditLog.actorEmail || 'SYSTEM'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Actor Role:</span>
                <span>{selectedAuditLog.actorRole || 'PLATFORM'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">IP & User Agent:</span>
                <span className="truncate max-w-[280px]" title={selectedAuditLog.userAgent}>
                  {selectedAuditLog.ipAddress}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Target Type / ID:</span>
                <span>
                  {selectedAuditLog.targetType} : {selectedAuditLog.targetId}
                </span>
              </div>
              {selectedAuditLog.reason && (
                <div className="pt-2 border-t border-slate-800/80 font-sans text-xs text-slate-300">
                  <span className="text-slate-500 font-mono">Compliance Reason:</span> {selectedAuditLog.reason}
                </div>
              )}
            </div>

            {/* Cryptographic Linkage Block */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Cryptographic Linkage (SHA-256)
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="text-slate-500">Entry Hash:</div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 break-all select-all">
                  {selectedAuditLog.hash}
                </div>
                <div className="text-slate-500 pt-1">Previous Block Hash:</div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 break-all select-all">
                  {selectedAuditLog.previousHash}
                </div>
              </div>
            </div>

            {/* Payload Before / After States */}
            {(selectedAuditLog.before || selectedAuditLog.after) && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  State Mutation Snapshot
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500">Before:</span>
                    <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 overflow-x-auto max-h-40">
                      {JSON.stringify(selectedAuditLog.before || {}, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500">After:</span>
                    <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-emerald-300 overflow-x-auto max-h-40">
                      {JSON.stringify(selectedAuditLog.after || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans text-xs transition-colors cursor-pointer min-h-[38px]"
              >
                Close Record
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DashboardPage;
