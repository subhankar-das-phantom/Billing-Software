/**
 * Bharat Enterprise Billing System — Platform Control Plane Sidebar
 * High-density enterprise navigation strictly guarded by granular permissions.
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { usePlatformAuth } from '../../contexts/PlatformAuthContext';
import { PlatformPermission, PlatformRole } from '../../types';

interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
  permission: PlatformPermission;
  badge?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    name: 'Overview',
    to: '/',
    icon: LayoutDashboard,
    permission: PlatformPermission.DASHBOARD_VIEW,
  },
  {
    name: 'Tenants Directory',
    to: '/tenants',
    icon: Building2,
    permission: PlatformPermission.TENANTS_VIEW,
  },
  {
    name: 'Subscriptions & MRR',
    to: '/subscriptions',
    icon: CreditCard,
    permission: PlatformPermission.SUBSCRIPTIONS_VIEW,
  },
  {
    name: 'Feature Overrides',
    to: '/features',
    icon: Sliders,
    permission: PlatformPermission.FEATURE_OVERRIDES_VIEW,
  },
  {
    name: 'Support Operations',
    to: '/support',
    icon: Headphones,
    permission: PlatformPermission.SUPPORT_START,
  },
  {
    name: 'Audit Trail',
    to: '/audit',
    icon: ShieldCheck,
    permission: PlatformPermission.AUDIT_VIEW,
  },
  {
    name: 'Platform Team',
    to: '/users',
    icon: Users,
    permission: PlatformPermission.USERS_VIEW,
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

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, role, hasPermission, logout } = usePlatformAuth();
  const location = useLocation();

  const allowedNavItems = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Platform Branding Header */}
      <div className="h-14 min-h-[56px] border-b border-slate-800/80 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm shadow-xs">
            BE
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-xs tracking-tight text-slate-100 uppercase">
              Control Plane
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider">
              BHARAT ENTERPRISE
            </span>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        )}
      </div>

      {/* Role Pill Banner */}
      {role && (
        <div className="px-3 pt-3 pb-1">
          <div
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider border flex items-center justify-between ${
              ROLE_BADGE_STYLE[role] || 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <span className="truncate">{role.replace(/_/g, ' ')}</span>
            {role === PlatformRole.PLATFORM_OWNER ? (
              <ShieldAlert className="w-3 h-3 shrink-0" />
            ) : null}
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {allowedNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`group flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Operator Profile & Sign Out Bar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 font-bold text-xs uppercase shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-xs font-medium text-slate-200 truncate">
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
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
            title="Sign out of Platform Control Plane"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
