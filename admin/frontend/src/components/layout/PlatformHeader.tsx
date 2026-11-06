/**
 * Bharat Enterprise Billing System — Platform Control Plane Main Header
 * High-density top navigation with dynamic breadcrumbs, Indian Financial Calendar pill,
 * live sync pulse, quick search trigger, desktop sidebar toggle, and GPU-accelerated profile menu.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ChevronRight,
  ChevronDown,
  Calendar,
  Search,
  LogOut,
  ShieldCheck,
  Headphones,
  Users,
  Shield,
  ShieldAlert,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { usePlatformAuth } from '../../contexts/PlatformAuthContext';
import { PlatformRole } from '../../types';
import { RefreshIndicator } from '../common/RefreshIndicator';

export interface PlatformHeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onOpenMobileSidebar: () => void;
  onOpenCommandPalette?: () => void;
  isSyncing?: boolean;
}

const ROLE_BADGE_STYLE: Record<PlatformRole, string> = {
  [PlatformRole.PLATFORM_OWNER]: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
  [PlatformRole.PLATFORM_ADMIN]: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
  [PlatformRole.SUPPORT_ADMIN]: 'bg-blue-950/80 text-blue-300 border-blue-800/80',
  [PlatformRole.SUPPORT_AGENT]: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
  [PlatformRole.TELESUPPORT]: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
  [PlatformRole.READ_ONLY]: 'bg-slate-800 text-slate-300 border-slate-700',
};

const ROUTE_NAME_MAP: Record<string, string> = {
  '': 'Overview',
  tenants: 'Tenants Directory',
  subscriptions: 'Subscriptions & MRR',
  features: 'Feature Overrides',
  support: 'Support Operations',
  audit: 'Audit Trail',
  users: 'Platform Team',
  settings: 'System Settings',
};

/**
 * Calculates Indian Financial Year & Quarter (April 1 – March 31).
 */
function getIndianFiscalCalendar(date: Date = new Date()): {
  dateFormatted: string;
  quarter: string;
  fiscalYear: string;
  pillText: string;
} {
  const month = date.getMonth(); // 0 = Jan, 11 = Dec
  const year = date.getFullYear();

  let quarter: string;
  let startYear: number;
  let endYear: number;

  if (month >= 3 && month <= 5) {
    quarter = 'Q1';
    startYear = year;
    endYear = year + 1;
  } else if (month >= 6 && month <= 8) {
    quarter = 'Q2';
    startYear = year;
    endYear = year + 1;
  } else if (month >= 9 && month <= 11) {
    quarter = 'Q3';
    startYear = year;
    endYear = year + 1;
  } else {
    quarter = 'Q4';
    startYear = year - 1;
    endYear = year;
  }

  const fiscalYear = `FY${startYear}-${String(endYear).slice(-2)}`;
  const dateFormatted = date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return {
    dateFormatted,
    quarter,
    fiscalYear,
    pillText: `${dateFormatted} • ${quarter} ${fiscalYear}`,
  };
}

export const PlatformHeader: React.FC<PlatformHeaderProps> = ({
  isSidebarCollapsed,
  onToggleSidebarCollapse,
  onOpenMobileSidebar,
  onOpenCommandPalette,
  isSyncing = false,
}) => {
  const { user, role, themeMode, setThemeMode, logout } = usePlatformAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click or Escape key
  useEffect(() => {
    if (!isProfileOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen]);

  // Dynamic breadcrumb hierarchy resolution
  const breadcrumbs = useMemo(() => {
    const rawSegments = location.pathname.split('/').filter(Boolean);
    if (rawSegments.length === 0) {
      return [{ label: 'Overview', to: '/' }];
    }

    return rawSegments.map((segment, index) => {
      const path = `/${rawSegments.slice(0, index + 1).join('/')}`;
      const label =
        ROUTE_NAME_MAP[segment.toLowerCase()] ||
        (segment.length > 12 ? `${segment.slice(0, 10)}...` : segment.charAt(0).toUpperCase() + segment.slice(1));
      return { label, to: path };
    });
  }, [location.pathname]);

  // Indian Fiscal Calendar Pill text (computed once on render; immune to 1s clock re-renders)
  const fiscalInfo = useMemo(() => getIndianFiscalCalendar(), []);

  return (
    <header className="h-14 min-h-[56px] border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-xs sticky top-0 z-20 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 select-none">
      {/* ── Left Region: Sidebar Toggles & Breadcrumbs ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Drawer Toggle (min 44x44px touch target) */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2.5 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
          aria-label="Open navigation sidebar"
        >
          <Menu className="w-5 h-5 pointer-events-none" />
        </button>

        {/* Desktop Sidebar Rail Toggle with dynamic tooltip and Ctrl+B hint */}
        <button
          type="button"
          onClick={onToggleSidebarCollapse}
          className="hidden md:flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-transparent hover:border-slate-700/80 transition-all cursor-pointer group"
          title={
            isSidebarCollapsed
              ? 'Expand navigation rail (Ctrl+B)'
              : 'Collapse navigation rail (Ctrl+B)'
          }
          aria-label={
            isSidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'
          }
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors pointer-events-none" />
          ) : (
            <PanelLeftClose className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors pointer-events-none" />
          )}
        </button>

        {/* Dynamic Breadcrumb Hierarchy */}
        <nav
          aria-label="Breadcrumbs"
          className="flex items-center gap-1.5 text-xs font-medium min-w-0"
        >
          <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors">
            <Shield className="w-3.5 h-3.5 text-cyan-500/80" />
            <span>Platform</span>
          </span>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.to}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden sm:inline" />
                {isLast ? (
                  <span className="text-slate-100 font-semibold tracking-tight truncate max-w-[140px] sm:max-w-[220px]">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.to}
                    className="text-slate-400 hover:text-slate-200 transition-colors truncate max-w-[120px] hidden sm:inline"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* ── Center Region: Live Fiscal Calendar & Sync Pulse ── */}
      <div className="hidden xl:flex items-center gap-3 shrink-0">
        {/* Live Indian Financial Calendar Pill */}
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-md text-[11px] font-mono font-medium text-slate-300 bg-slate-950/70 border border-slate-800/80 shadow-xs"
          title="Indian Fiscal Calendar (April 1 - March 31)"
        >
          <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{fiscalInfo.pillText}</span>
        </div>

        {/* Live Sync Pulse */}
        <RefreshIndicator
          isRefreshing={isSyncing}
          showLiveState
          showText
          size="xs"
          className="px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800/80 shadow-xs"
        />
      </div>

      {/* ── Right Region: Quick Search & Profile Dropdown ── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick Search Action Bar / Command Palette Trigger (min 44px touch) */}
        {onOpenCommandPalette && (
          <>
            {/* Desktop / Tablet expandable trigger bar */}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden sm:flex items-center justify-between gap-3 px-3 py-1.5 text-xs text-slate-400 bg-slate-950/70 hover:bg-slate-800/70 hover:text-slate-200 border border-slate-800/80 hover:border-slate-700 rounded-lg transition-colors cursor-pointer group shadow-xs min-h-[38px] w-52 md:w-60 lg:w-64"
              title="Open command palette (Ctrl+K or ⌘K)"
              aria-label="Quick search actions"
            >
              <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                <span className="truncate text-slate-400 group-hover:text-slate-300 text-xs">
                  Search actions...
                </span>
              </div>
              <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 group-hover:text-cyan-400 border border-slate-700/80 rounded shadow-xs pointer-events-none">
                ⌘K
              </kbd>
            </button>

            {/* Mobile icon-only touch trigger */}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="sm:hidden p-2.5 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer border border-slate-800/80"
              aria-label="Open command palette"
            >
              <Search className="w-4 h-4 pointer-events-none" />
            </button>
          </>
        )}

        {/* GPU-Accelerated Profile Dropdown */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            aria-expanded={isProfileOpen}
            aria-haspopup="menu"
            className={`flex items-center gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer min-h-[44px] select-none ${
              isProfileOpen
                ? 'bg-slate-800 border-slate-600 text-slate-100 shadow-xs'
                : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/80 text-slate-300'
            }`}
          >
            {/* Operator Avatar with Initial */}
            <div className="w-7 h-7 rounded-full bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-xs uppercase shrink-0 pointer-events-none">
              {user?.fullName?.charAt(0) || 'U'}
            </div>

            {/* Operator Details (visible on desktop) */}
            <div className="hidden md:flex flex-col text-left pointer-events-none max-w-[130px]">
              <span className="text-xs font-medium text-slate-200 truncate leading-tight">
                {user?.fullName || 'Operator'}
              </span>
              <span className="text-[10px] text-slate-400 truncate font-mono leading-tight">
                {user?.role?.replace(/_/g, ' ') || 'CONTROL'}
              </span>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 pointer-events-none ${
                isProfileOpen ? 'rotate-180 text-slate-200' : ''
              }`}
            />
          </button>

          {/* Floating Profile Menu — GPU-accelerated opacity & subtle Y-glide */}
          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'top right' }}
                className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/80 z-50 overflow-hidden will-change-[transform,opacity]"
                role="menu"
                aria-orientation="vertical"
              >
                {/* Header Profile Summary */}
                <div className="p-3 bg-slate-950/80 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-sm uppercase shrink-0">
                      {user?.fullName?.charAt(0) || 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {user?.fullName || 'Platform Operator'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {user?.email || 'operator@platform.internal'}
                      </div>
                    </div>
                  </div>

                  {/* Role Pill */}
                  {role && (
                    <div className="mt-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border ${
                          ROLE_BADGE_STYLE[role] || 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {role === PlatformRole.PLATFORM_OWNER && (
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                        )}
                        <span>{role.replace(/_/g, ' ')}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* 1-Click Operational Shortcuts */}
                <div className="py-1">
                  <Link
                    to="/audit"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition-colors min-h-[44px]"
                    role="menuitem"
                  >
                    <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Cryptographic Audit Trail</span>
                  </Link>

                  <Link
                    to="/support"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition-colors min-h-[44px]"
                    role="menuitem"
                  >
                    <Headphones className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Support Diagnostic Sessions</span>
                  </Link>

                  <Link
                    to="/users"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition-colors min-h-[44px]"
                    role="menuitem"
                  >
                    <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Platform Team Directory</span>
                  </Link>
                </div>

                {/* Theme Mode Segmented Control */}
                <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-950/40">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
                    <span>Appearance</span>
                    <span className="capitalize text-[10px] font-mono text-slate-400">{themeMode}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setThemeMode('light')}
                      className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-all min-h-[36px] cursor-pointer ${
                        themeMode === 'light'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                      aria-label="Light mode"
                      title="Light Mode"
                    >
                      <Sun className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px]">Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setThemeMode('dark')}
                      className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-all min-h-[36px] cursor-pointer ${
                        themeMode === 'dark'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                      aria-label="Dark mode"
                      title="Dark Mode"
                    >
                      <Moon className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px]">Dark</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setThemeMode('system')}
                      className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-all min-h-[36px] cursor-pointer ${
                        themeMode === 'system'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                      aria-label="System theme"
                      title="System Theme"
                    >
                      <Laptop className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px]">System</span>
                    </button>
                  </div>
                </div>

                {/* Sign Out Bar */}
                <div className="p-1 border-t border-slate-800/80 bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer min-h-[44px]"
                    role="menuitem"
                  >
                    <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Sign Out of Control Plane</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default PlatformHeader;
