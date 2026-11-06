/**
 * Bharat Enterprise Billing System — Platform Control Plane Sidebar
 * High-density enterprise navigation strictly guarded by granular permissions.
 * Supports:
 *   - Desktop collapsible state (full width w-64 vs mini rail w-[68px] with Ctrl+B)
 *   - Hover tooltips when collapsed (name, category, keyboard shortcut)
 *   - Framer Motion active pill indicator with layoutId="sidebarActiveIndicator" (desktop only)
 *   - Mobile sheet drawer with body scroll lock (document.body.style.overflow = 'hidden')
 *   - Min-44px touch targets on all mobile navigation links
 *   - Bottom operator card with iOS safe-area padding (pb-[max(0.75rem,env(safe-area-inset-bottom))])
 */

import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Sliders,
  Headphones,
  ShieldCheck,
  Users,
  LogOut,
  ChevronRight,
  ShieldAlert,
  X,
  Megaphone,
} from 'lucide-react';
import { usePlatformAuth } from '../../contexts/PlatformAuthContext';
import { PlatformPermission, PlatformRole } from '../../types';

export interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
  permission: PlatformPermission;
  category: string;
  shortcut?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    name: 'Overview',
    to: '/',
    icon: LayoutDashboard,
    permission: PlatformPermission.DASHBOARD_VIEW,
    category: 'Analytics',
    shortcut: 'G O',
  },
  {
    name: 'Tenants Directory',
    to: '/tenants',
    icon: Building2,
    permission: PlatformPermission.TENANTS_VIEW,
    category: 'Operations',
    shortcut: 'G T',
  },
  {
    name: 'Subscriptions & MRR',
    to: '/subscriptions',
    icon: CreditCard,
    permission: PlatformPermission.SUBSCRIPTIONS_VIEW,
    category: 'Revenue',
    shortcut: 'G S',
  },
  {
    name: 'Campaigns & Offers',
    to: '/campaigns',
    icon: Megaphone,
    permission: PlatformPermission.SUBSCRIPTIONS_VIEW,
    category: 'Marketing',
    shortcut: 'G C',
  },
  {
    name: 'Feature Overrides',
    to: '/features',
    icon: Sliders,
    permission: PlatformPermission.FEATURE_OVERRIDES_VIEW,
    category: 'Governance',
    shortcut: 'G F',
  },
  {
    name: 'Support Operations',
    to: '/support',
    icon: Headphones,
    permission: PlatformPermission.SUPPORT_START,
    category: 'Diagnostics',
    shortcut: 'G D',
  },
  {
    name: 'Audit Trail',
    to: '/audit',
    icon: ShieldCheck,
    permission: PlatformPermission.AUDIT_VIEW,
    category: 'Security',
    shortcut: 'G A',
  },
  {
    name: 'Platform Team',
    to: '/users',
    icon: Users,
    permission: PlatformPermission.USERS_VIEW,
    category: 'IAM & Access',
    shortcut: 'G U',
  },
];

const ROLE_BADGE_STYLE: Record<PlatformRole, string> = {
  [PlatformRole.PLATFORM_OWNER]: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
  [PlatformRole.PLATFORM_ADMIN]: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
  [PlatformRole.SUPPORT_ADMIN]: 'bg-blue-950/80 text-blue-300 border-blue-800/80',
  [PlatformRole.SUPPORT_AGENT]: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
  [PlatformRole.TELESUPPORT]: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
  [PlatformRole.READ_ONLY]: 'bg-slate-800 text-slate-300 border-slate-700',
};

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { user, role, hasPermission, logout } = usePlatformAuth();
  const location = useLocation();

  // Desktop media query tracker to guard layout animations and collapse rules
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Body scroll lock on mobile drawer sheet open
  useEffect(() => {
    if (isOpen && !isDesktop) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, isDesktop]);

  const allowedNavItems = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  // Determine desktop width classes
  const desktopWidthClass = isCollapsed ? 'md:w-[68px]' : 'md:w-64';

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-slate-900 border-r border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out md:translate-x-0 ${desktopWidthClass} ${
        isOpen ? 'translate-x-0 w-72 max-w-[85vw] shadow-2xl shadow-black/80' : '-translate-x-full md:translate-x-0'
      }`}
      aria-label="Platform navigation"
    >
      {/* ── Platform Branding Header ── */}
      <div className="h-14 min-h-[56px] border-b border-slate-800/80 px-3 sm:px-4 flex items-center justify-between shrink-0 overflow-hidden">
        <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed && isDesktop ? 'mx-auto' : ''}`}>
          {/* Logo Monogram */}
          <button
            type="button"
            onClick={isDesktop ? onToggleCollapse : undefined}
            className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shadow-xs shrink-0 cursor-pointer hover:border-blue-400/60 transition-colors"
            title="Bharat Enterprise Platform Control Plane"
            aria-label="Toggle navigation rail"
          >
            BE
          </button>

          {/* Logo Title (hidden in desktop collapsed mini-rail) */}
          {(!isCollapsed || !isDesktop) && (
            <div className="flex flex-col min-w-0 select-none animate-in fade-in duration-200">
              <span className="font-semibold text-xs tracking-tight text-slate-100 uppercase truncate">
                Control Plane
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider truncate">
                BHARAT ENTERPRISE
              </span>
            </div>
          )}
        </div>

        {/* Mobile Close Button (min 44x44px touch target) */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden min-h-[44px] min-w-[44px] p-2.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Close navigation sidebar"
          >
            <X className="w-5 h-5 pointer-events-none" />
          </button>
        )}
      </div>

      {/* ── Role Pill Banner ── */}
      {role && (
        <div className="px-2.5 pt-3 pb-1 shrink-0 overflow-hidden">
          {isCollapsed && isDesktop ? (
            <div
              className={`w-8 h-8 mx-auto rounded-lg border flex items-center justify-center ${
                ROLE_BADGE_STYLE[role] || 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title={`Role: ${role.replace(/_/g, ' ')}`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
            </div>
          ) : (
            <div
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider border flex items-center justify-between select-none animate-in fade-in duration-200 ${
                ROLE_BADGE_STYLE[role] || 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <span className="truncate">{role.replace(/_/g, ' ')}</span>
              {role === PlatformRole.PLATFORM_OWNER ? (
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── Navigation Links ── */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto no-scrollbar">
        {allowedNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

          return (
            <div key={item.to} className="relative group">
              <NavLink
                to={item.to}
                onClick={onClose}
                className={`relative flex items-center rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[44px] select-none ${
                  isCollapsed && isDesktop
                    ? 'justify-center px-0 py-2.5 w-full'
                    : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'text-blue-400 font-semibold'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                {/* Framer-Motion Active Pill Indicator (Guarded on Desktop only) */}
                {isActive && isDesktop && (
                  <motion.div
                    layoutId="sidebarActiveIndicator"
                    className="absolute inset-0 rounded-lg bg-blue-600/15 border border-blue-500/30 shadow-xs"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}

                {/* Mobile Active Background (Instant, non-layoutId to prevent sheet jump) */}
                {isActive && !isDesktop && (
                  <div className="absolute inset-0 rounded-lg bg-blue-600/15 border border-blue-500/30 shadow-xs" />
                )}

                {/* Left region: Icon + Label */}
                <div
                  className={`relative z-10 flex items-center min-w-0 ${
                    isCollapsed && isDesktop ? 'justify-center' : 'gap-3'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors pointer-events-none ${
                      isActive
                        ? 'text-blue-400'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {(!isCollapsed || !isDesktop) && (
                    <span className="truncate pointer-events-none">{item.name}</span>
                  )}
                </div>

                {/* Active Chevron Indicator (Expanded state only) */}
                {isActive && (!isCollapsed || !isDesktop) && (
                  <ChevronRight className="relative z-10 w-3.5 h-3.5 text-blue-400/80 shrink-0 pointer-events-none" />
                )}
              </NavLink>

              {/* Collapsed Rail Hover Tooltip (Desktop Only, Right-aligned, GPU-accelerated) */}
              {isCollapsed && isDesktop && (
                <div className="fixed left-[76px] top-auto -translate-y-10 px-3 py-2 bg-slate-900 border border-slate-700/90 rounded-lg shadow-2xl shadow-black/90 text-left pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50 whitespace-nowrap min-w-[150px]">
                  <div className="text-xs font-semibold text-slate-100 flex items-center justify-between gap-3">
                    <span>{item.name}</span>
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-slate-800 text-slate-300 border border-slate-700 rounded">
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                  {item.category && (
                    <div className="text-[10px] text-blue-400 font-mono mt-0.5">
                      {item.category}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Operator Profile & Sign Out Bar with iOS Safe-Area Padding ── */}
      <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/60 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {isCollapsed && isDesktop ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-300 font-bold text-xs uppercase cursor-pointer"
              title={`${user?.fullName || 'Operator'} (${user?.role || 'Control Plane'})`}
            >
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Sign Out (Ctrl+Q)"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 pointer-events-none" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 min-h-[44px]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-300 font-bold text-xs uppercase shrink-0">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex flex-col select-none">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {user?.fullName || 'Platform Operator'}
                </span>
                <span className="text-[10px] text-slate-400 truncate font-mono">
                  {user?.email || 'operator@platform.internal'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Sign out of Platform Control Plane"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 pointer-events-none" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
