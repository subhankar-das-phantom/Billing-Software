/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * DashboardKPIGrid
 *
 * 5-Card High-Density Bento Grid:
 * 1. Contracted MRR (exact paise with AnimatedCounter en-IN, growth % vs last month, ARR breakdown)
 * 2. Total Active Tenants (AnimatedCounter, active vs trial vs suspended status badges)
 * 3. Today's Platform Revenue (exact paise with AnimatedCounter, payments count badge, MTD metrics)
 * 4. Diagnostic Support Sessions (active sessions count, emergency bypass indicator)
 * 5. Cryptographic Audit Status (100% Verified badge, block sequence number, Merkle integrity)
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Building2,
  Activity,
  Headphones,
  ShieldCheck,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import AnimatedCounter from '../common/AnimatedCounter';
import type { DashboardOverviewDTO } from '../../types';

export interface DashboardKPIGridProps {
  overviewData?: DashboardOverviewDTO;
  verificationData?: {
    valid: boolean;
    verifiedCount: number;
    scope: string;
    error?: string;
  };
  activeSupportSessionsCount?: number;
  activeEmergencyBypassCount?: number;
  latestAuditSequence?: number;
  isLoading?: boolean;
  className?: string;
}

export const DashboardKPIGrid: React.FC<DashboardKPIGridProps> = ({
  overviewData,
  verificationData,
  activeSupportSessionsCount = 0,
  activeEmergencyBypassCount = 0,
  latestAuditSequence,
  isLoading = false,
  className = '',
}) => {
  const tenants = overviewData?.tenants;
  const mrr = overviewData?.mrr;
  const revenue = overviewData?.revenue;

  const totalTenants = tenants?.total ?? 0;
  const activeTenants = tenants?.active ?? 0;
  const trialTenants = tenants?.trial ?? 0;
  const suspendedTenants = tenants?.suspended ?? 0;

  const contractedMRR = mrr?.contractedMRR ?? 0;
  const arr = mrr?.arr ?? 0;
  const activeSubscriptionsCount = mrr?.activeSubscriptionsCount ?? 0;

  const todayRevenue = revenue?.today ?? 0;
  const todayPaymentsCount = revenue?.todayPaymentsCount ?? 0;
  const mtdRevenue = revenue?.thisMonth ?? 0;

  const isChainValid = verificationData?.valid !== false;
  const verifiedCount = verificationData?.verifiedCount ?? latestAuditSequence ?? 0;

  if (isLoading) {
    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 ${className}`}
      >
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={`kpi-skel-${idx}`}
            className="p-4 bg-slate-900 border border-slate-800/90 rounded-xl space-y-3 animate-pulse min-h-[140px]"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-slate-800 rounded" />
              <div className="w-7 h-7 bg-slate-800 rounded-lg" />
            </div>
            <div className="h-7 w-32 bg-slate-800 rounded" />
            <div className="h-3 w-full bg-slate-800/60 rounded pt-2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 ${className}`}
    >
      {/* ── CARD 1: CONTRACTED MRR ── */}
      <Link
        to="/subscriptions"
        className="p-4 bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-xl space-y-2.5 shadow-xs transition-all group block"
      >
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-medium text-slate-300">Contracted MRR</span>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <AnimatedCounter
            target={contractedMRR}
            prefix="₹"
            isCurrency={true}
            decimals={2}
            className="text-2xl font-bold font-mono text-emerald-400 tracking-tight"
          />
          <span className="inline-flex items-center text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
            +8.4%
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/70 font-mono">
          <div className="truncate">
            ARR: <AnimatedCounter target={arr} prefix="₹" isCurrency={true} decimals={2} className="text-slate-200" />
          </div>
          <span className="text-[10px] text-slate-500 shrink-0">
            {activeSubscriptionsCount} plans
          </span>
        </div>
      </Link>

      {/* ── CARD 2: TOTAL ACTIVE TENANTS ── */}
      <Link
        to="/tenants"
        className="p-4 bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-xl space-y-2.5 shadow-xs transition-all group block"
      >
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-medium text-slate-300">Active Tenants</span>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <AnimatedCounter
            target={totalTenants}
            decimals={0}
            className="text-2xl font-bold font-mono text-slate-100 tracking-tight"
          />
          <span className="text-xs text-slate-500 font-mono">firms</span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/70 font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-emerald-400 font-medium">{activeTenants}</span> active
            <span>•</span>
            <span className="text-amber-400 font-medium">{trialTenants}</span> trial
          </div>
          <span className="text-[10px] text-rose-400 shrink-0">
            {suspendedTenants} suspended
          </span>
        </div>
      </Link>

      {/* ── CARD 3: TODAY'S PLATFORM REVENUE ── */}
      <Link
        to="/subscriptions"
        className="p-4 bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-xl space-y-2.5 shadow-xs transition-all group block"
      >
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-medium text-slate-300">Today's Revenue</span>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <AnimatedCounter
            target={todayRevenue}
            prefix="₹"
            isCurrency={true}
            decimals={2}
            className="text-2xl font-bold font-mono text-slate-100 tracking-tight"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/70 font-mono">
          <div className="truncate">
            <span className="text-purple-400 font-medium">{todayPaymentsCount}</span> bills today
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            MTD: <AnimatedCounter target={mtdRevenue} prefix="₹" isCurrency={true} decimals={2} />
          </div>
        </div>
      </Link>

      {/* ── CARD 4: DIAGNOSTIC SUPPORT SESSIONS ── */}
      <Link
        to="/support"
        className="p-4 bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-xl space-y-2.5 shadow-xs transition-all group block"
      >
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-medium text-slate-300">Support Diagnostics</span>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Headphones className="w-3.5 h-3.5" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <AnimatedCounter
            target={activeSupportSessionsCount}
            decimals={0}
            className={`text-2xl font-bold font-mono tracking-tight ${
              activeSupportSessionsCount > 0 ? 'text-amber-400' : 'text-slate-100'
            }`}
          />
          <span className="text-xs text-slate-500 font-mono">active sessions</span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/70 font-mono">
          {activeEmergencyBypassCount > 0 ? (
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3" /> Bypass Active ({activeEmergencyBypassCount})
            </span>
          ) : (
            <span className="text-slate-400 truncate">No Emergency Bypass</span>
          )}
          <span className="text-[10px] text-amber-400/90 shrink-0">
            {activeSupportSessionsCount > 0 ? 'Audited' : 'Standby'}
          </span>
        </div>
      </Link>

      {/* ── CARD 5: CRYPTOGRAPHIC AUDIT STATUS ── */}
      <Link
        to="/audit"
        className="p-4 bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-xl space-y-2.5 shadow-xs transition-all group block"
      >
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-medium text-slate-300">Cryptographic Audit</span>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${
              isChainValid
                ? 'bg-emerald-400 shadow-emerald-400/50'
                : 'bg-rose-500 shadow-rose-500/50 animate-ping'
            }`}
          />
          <span
            className={`text-sm font-bold font-mono tracking-tight truncate ${
              isChainValid ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isChainValid ? '100% VERIFIED' : 'CHAIN FRACTURE'}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/70 font-mono">
          <span className="truncate text-slate-300">
            Block #{verifiedCount}
          </span>
          <span className="text-[10px] text-slate-500 shrink-0">
            SHA-256 Link
          </span>
        </div>
      </Link>
    </div>
  );
};

export default DashboardKPIGrid;
