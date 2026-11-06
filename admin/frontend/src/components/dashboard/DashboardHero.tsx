/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * DashboardHero
 *
 * High-density command header with Indian financial calendar context,
 * live sync pulse indicator, horizontal time horizon pills, and primary action CTAs.
 */

import React, { useMemo } from 'react';
import {
  Calendar,
  RefreshCw,
  UserPlus,
  Headphones,
  Layers,
} from 'lucide-react';
import ScrollAffordanceContainer from '../common/ScrollAffordanceContainer';
import LiveCalendarClock from './LiveCalendarClock';

export type DashboardTimeHorizon = 'Today' | '7D' | '30D' | 'Month' | 'Year';

export interface DashboardHeroProps {
  timeHorizon: DashboardTimeHorizon;
  onTimeHorizonChange: (horizon: DashboardTimeHorizon) => void;
  isSyncing: boolean;
  onRefresh: () => void;
  onOpenOnboardModal: () => void;
  onOpenDiagnosticModal: () => void;
  canOnboardAdmin?: boolean;
  canOnboardTenant?: boolean; // legacy alias
  canStartDiagnostic?: boolean;
  clusterStatus?: 'HEALTHY' | 'DEGRADED';
  className?: string;
}

const TIME_HORIZONS: readonly DashboardTimeHorizon[] = [
  'Today',
  '7D',
  '30D',
  'Month',
  'Year',
];

/**
 * Computes Indian financial calendar context string (e.g. "Mon, 5 Nov • Q3 FY2026-27").
 */
function getIndianFinancialContext(date: Date = new Date()): string {
  try {
    const istDate = new Date(
      date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    );

    const month = istDate.getMonth(); // 0 = Jan, 3 = Apr, 9 = Oct, 11 = Dec
    const year = istDate.getFullYear();

    let fyStartYear: number;
    let fyEndYear: number;
    let quarter: number;

    if (month >= 3) {
      // April to December
      fyStartYear = year;
      fyEndYear = year + 1;
      quarter = Math.floor((month - 3) / 3) + 1;
    } else {
      // January to March
      fyStartYear = year - 1;
      fyEndYear = year;
      quarter = 4;
    }

    const fyEndShort = String(fyEndYear).slice(-2);
    const quarterStr = `Q${quarter} FY${fyStartYear}-${fyEndShort}`;

    // Format "Mon, 5 Nov" in IST
    const dayMonth = istDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    return `${dayMonth} • ${quarterStr}`;
  } catch {
    return 'Q3 FY2026-27';
  }
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  timeHorizon,
  onTimeHorizonChange,
  isSyncing,
  onRefresh,
  onOpenOnboardModal,
  onOpenDiagnosticModal,
  canOnboardAdmin,
  canOnboardTenant = true,
  canStartDiagnostic = true,
  clusterStatus = 'HEALTHY',
  className = '',
}) => {
  const financialContext = useMemo(() => getIndianFinancialContext(), []);

  return (
    <div
      className={`p-4 sm:p-5 bg-slate-900 border border-slate-800/90 rounded-2xl shadow-sm space-y-4 ${className}`}
    >
      {/* ── Top Bar: Title, Financial Calendar Context & Live Controls ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Branding, Platform Scope & Financial Calendar */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              Platform Command Center
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase bg-slate-800 text-blue-400 border border-slate-700/80 rounded-md">
              SUPER ADMIN
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
            {/* Indian Financial Calendar Pill */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-slate-300"
              title="Indian Financial Year & Current Active Quarter (IST)"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-semibold text-slate-200">{financialContext}</span>
            </div>

            {/* Live IST Clock Isolated Leaf */}
            <LiveCalendarClock variant="badge" />
          </div>
        </div>

        {/* Right: Sync Status Pulse & Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Sync Status Indicator Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-medium text-slate-300 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] sm:min-h-[38px]"
            title="Click to bypass TTL cache and trigger immediate telemetry re-scan"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                <span className="text-blue-300">Syncing...</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-emerald-400 font-semibold">Live</span>
                <span className="text-slate-500 text-[11px] hidden sm:inline">• Refresh</span>
              </>
            )}
          </button>

          {/* Primary Action 1: Onboard Platform Admin / Operator (Primary Blue) */}
          {(() => {
            const hasAdminPerm = canOnboardAdmin ?? canOnboardTenant;
            return (
              <button
                type="button"
                onClick={onOpenOnboardModal}
                disabled={!hasAdminPerm}
                className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] ${
                  hasAdminPerm
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 border border-blue-500/70 active:scale-[0.98]'
                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                }`}
                title={hasAdminPerm ? 'Onboard new platform admin or operator' : 'Requires USERS_MANAGE permission'}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Onboard Admin</span>
              </button>
            );
          })()}

          {/* Primary Action 2: Start Diagnostic (Amber) */}
          <button
            type="button"
            onClick={onOpenDiagnosticModal}
            disabled={!canStartDiagnostic}
            className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] ${
              canStartDiagnostic
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 hover:border-amber-500/60 shadow-amber-950/20 active:scale-[0.98]'
                : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
            }`}
            title={canStartDiagnostic ? 'Launch audited diagnostic support session' : 'Requires SUPPORT_START permission'}
          >
            <Headphones className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Start Diagnostic</span>
          </button>
        </div>
      </div>

      {/* ── Bottom Strip: Time Horizon Filter Pills & Quick Scope ── */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 shrink-0 hidden md:inline">
            Time Horizon:
          </span>

          <ScrollAffordanceContainer className="w-full sm:w-auto">
            <div className="flex items-center gap-1.5 py-0.5">
              {TIME_HORIZONS.map((horizon) => {
                const isActive = timeHorizon === horizon;
                return (
                  <button
                    key={horizon}
                    type="button"
                    onClick={() => onTimeHorizonChange(horizon)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer shrink-0 min-h-[38px] sm:min-h-[32px] flex items-center justify-center ${
                      isActive
                        ? 'bg-blue-950/80 border border-blue-500/70 text-blue-300 font-semibold shadow-xs'
                        : 'bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {horizon}
                  </button>
                );
              })}
            </div>
          </ScrollAffordanceContainer>
        </div>

        {/* Telemetry Scope Note & Cluster Health */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 shrink-0">
          <span className="hidden lg:inline text-slate-500">Scope: Global Multi-Tenant Mesh</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                clusterStatus === 'HEALTHY' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className={clusterStatus === 'HEALTHY' ? 'text-slate-300' : 'text-amber-300'}>
              Cluster: {clusterStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHero;
