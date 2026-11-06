/**
 * Bharat Enterprise Billing System — Platform Control Plane Command Palette (Ctrl+K)
 *
 * Full W3C ARIA 1.2 Combobox implementation with zero-flicker GPU transitions.
 * Features:
 *   - Categorized catalog: Navigation, Tenant Operations, Support & Diagnostics, Security & Audit, System & Preferences
 *   - Granular RBAC filtering strictly guarded by PlatformPermission and PlatformRole
 *   - Action execution semantics (direct actions + route navigation)
 *   - Arrow wrapping, Home, End, Enter, Escape
 *   - isKeyboardNavigatingRef to eliminate mouse vs keyboard selection conflicts
 *   - GPU-accelerated opacity & subtle Y-glide (strictly banning spring physics)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  CornerDownLeft,
  LayoutDashboard,
  Building2,
  CreditCard,
  Sliders,
  Headphones,
  ShieldCheck,
  Users,
  LogOut,
  PlusCircle,
  Activity,
  CheckCircle2,
  AlertTriangle,
  PanelLeft,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { usePlatformAuth } from '../../contexts/PlatformAuthContext';
import { PlatformPermission, PlatformRole } from '../../types';
import { registerEscapeHandler } from '../../hooks/useKeyboardShortcuts';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDiagnosticModal?: (tenantId?: string) => void;
  onOpenOnboardModal?: () => void;
  onToggleSidebar?: () => void;
}

export type CommandCategory =
  | 'Navigation'
  | 'Tenant Operations'
  | 'Support & Diagnostics'
  | 'Security & Audit'
  | 'System & Preferences';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  icon: React.ElementType;
  path?: string;
  action?: () => void;
  permission?: PlatformPermission;
  roles?: PlatformRole[];
  badge?: {
    text: string;
    variant: 'blue' | 'emerald' | 'amber' | 'purple' | 'slate';
  };
  keywords?: string[];
}

const BADGE_VARIANTS: Record<string, string> = {
  blue: 'bg-sky-950/80 text-sky-300 border-sky-800/80',
  emerald: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
  amber: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
  purple: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
  slate: 'bg-slate-800 text-slate-300 border-slate-700',
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenDiagnosticModal,
  onOpenOnboardModal,
  onToggleSidebar,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavigatingRef = useRef(false);

  const navigate = useNavigate();
  const { role, hasPermission, logout } = usePlatformAuth();

  // Register in centralized priority escape stack (priority 30)
  useEffect(() => {
    if (!isOpen) return;
    const unregister = registerEscapeHandler(30, () => {
      onClose();
      return true; // handled
    });
    return unregister;
  }, [isOpen, onClose]);

  // Command catalog definition
  const catalog: CommandItem[] = useMemo(() => {
    return [
      // ── 1. Navigation ───────────────────────────────────────────
      {
        id: 'nav-overview',
        label: 'Dashboard Overview',
        description: 'View real-time contracted MRR, tenant health, and revenue telemetry',
        category: 'Navigation',
        icon: LayoutDashboard,
        path: '/',
        permission: PlatformPermission.DASHBOARD_VIEW,
        keywords: ['home', 'kpi', 'metrics', 'analytics', 'mrr', 'arr'],
      },
      {
        id: 'nav-tenants',
        label: 'Tenants Directory',
        description: 'Manage registered firms, database isolation, and lifecycle states',
        category: 'Navigation',
        icon: Building2,
        path: '/tenants',
        permission: PlatformPermission.TENANTS_VIEW,
        keywords: ['firms', 'clients', 'businesses', 'customers', 'gstin'],
      },
      {
        id: 'nav-subscriptions',
        label: 'Subscriptions & MRR',
        description: 'SaaS subscription statuses, billing cycles, and manual reconciliation',
        category: 'Navigation',
        icon: CreditCard,
        path: '/subscriptions',
        permission: PlatformPermission.SUBSCRIPTIONS_VIEW,
        keywords: ['plans', 'billing', 'revenue', 'mrr', 'renewals', 'grace'],
      },
      {
        id: 'nav-features',
        label: 'Feature Overrides & Bypass',
        description: 'Commercial precedence overrides, enterprise flags, and emergency bypass',
        category: 'Navigation',
        icon: Sliders,
        path: '/features',
        permission: PlatformPermission.FEATURE_OVERRIDES_VIEW,
        keywords: ['flags', 'toggles', 'permissions', 'commercial', 'override'],
      },
      {
        id: 'nav-support',
        label: 'Support Operations',
        description: 'Scoped diagnostic access, time-bounded sessions, and active countdowns',
        category: 'Navigation',
        icon: Headphones,
        path: '/support',
        permission: PlatformPermission.SUPPORT_START,
        keywords: ['diagnostic', 'sessions', 'troubleshoot', 'telesupport', 'operators'],
      },
      {
        id: 'nav-audit',
        label: 'Cryptographic Audit Trail',
        description: 'Keyset-paginated immutable activity audit logs with SHA-256 Merkle chain',
        category: 'Navigation',
        icon: ShieldCheck,
        path: '/audit',
        permission: PlatformPermission.AUDIT_VIEW,
        keywords: ['logs', 'merkle', 'hash', 'security', 'compliance', 'trail'],
      },
      {
        id: 'nav-users',
        label: 'Platform Team Directory',
        description: 'Manage platform operators, role hierarchy, and MFA enforcement',
        category: 'Navigation',
        icon: Users,
        path: '/users',
        permission: PlatformPermission.USERS_VIEW,
        keywords: ['team', 'staff', 'admins', 'roles', 'operators', '2fa', 'mfa'],
      },

      // ── 2. Tenant Operations ────────────────────────────────────
      {
        id: 'tenant-onboard',
        label: 'Onboard New Tenant',
        description: 'Provision a new tenant business firm with automated database indexing',
        category: 'Tenant Operations',
        icon: PlusCircle,
        action: () => {
          if (onOpenOnboardModal) {
            onOpenOnboardModal();
          } else {
            navigate('/tenants?action=onboard');
          }
        },
        permission: PlatformPermission.TENANTS_MANAGE,
        badge: { text: 'Action', variant: 'emerald' },
        keywords: ['create', 'new', 'provision', 'firm', 'register'],
      },
      {
        id: 'tenant-filter-active',
        label: 'Filter Active Tenants',
        description: 'Show all tenants currently in active commercial status',
        category: 'Tenant Operations',
        icon: CheckCircle2,
        path: '/tenants?status=active',
        permission: PlatformPermission.TENANTS_VIEW,
        keywords: ['active', 'paid', 'operating'],
      },
      {
        id: 'tenant-filter-suspended',
        label: 'Filter Suspended Tenants',
        description: 'Review tenants locked or suspended due to policy or delinquency',
        category: 'Tenant Operations',
        icon: AlertTriangle,
        path: '/tenants?status=suspended',
        permission: PlatformPermission.TENANTS_VIEW,
        badge: { text: 'Review', variant: 'amber' },
        keywords: ['suspended', 'locked', 'frozen', 'disabled'],
      },
      {
        id: 'tenant-filter-enterprise',
        label: 'Filter Enterprise Plan Tenants',
        description: 'View premium enterprise-tier firms and custom volume tiers',
        category: 'Tenant Operations',
        icon: FolderOpen,
        path: '/tenants?plan=ENTERPRISE',
        permission: PlatformPermission.TENANTS_VIEW,
        badge: { text: 'Tier', variant: 'purple' },
        keywords: ['enterprise', 'high volume', 'custom'],
      },

      // ── 3. Support & Diagnostics ────────────────────────────────
      {
        id: 'support-start-diagnostic',
        label: 'Start Diagnostic Session',
        description: 'Initiate a time-bounded, audited support session on a tenant firm',
        category: 'Support & Diagnostics',
        icon: Activity,
        action: () => {
          if (onOpenDiagnosticModal) {
            onOpenDiagnosticModal();
          } else {
            navigate('/support');
          }
        },
        permission: PlatformPermission.SUPPORT_START,
        badge: { text: 'Security', variant: 'blue' },
        keywords: ['diagnostic', 'assist', 'troubleshoot', 'access', 'token'],
      },
      {
        id: 'support-view-active',
        label: 'View Active Support Sessions',
        description: 'Monitor ongoing diagnostic sessions with live remaining countdowns',
        category: 'Support & Diagnostics',
        icon: Headphones,
        path: '/support',
        permission: PlatformPermission.SUPPORT_START,
        keywords: ['active support', 'live', 'timer', 'operator'],
      },

      // ── 4. Security & Audit ─────────────────────────────────────
      {
        id: 'audit-verify-chain',
        label: 'Verify Audit Merkle Hash Chain',
        description: 'Run cryptographic verification over sequential SHA-256 audit blocks',
        category: 'Security & Audit',
        icon: ShieldCheck,
        path: '/audit?verify=true',
        permission: PlatformPermission.AUDIT_VIEW,
        badge: { text: 'Crypto', variant: 'emerald' },
        keywords: ['verify', 'merkle', 'sha256', 'hash', 'tamper', 'integrity'],
      },
      {
        id: 'audit-security-alerts',
        label: 'Filter Security & Critical Alerts',
        description: 'Audit critical security warnings, lockouts, and emergency bypass events',
        category: 'Security & Audit',
        icon: AlertTriangle,
        path: '/audit?severity=CRITICAL',
        permission: PlatformPermission.AUDIT_VIEW,
        badge: { text: 'Critical', variant: 'amber' },
        keywords: ['security', 'alerts', 'lockout', 'bypass', 'critical'],
      },

      // ── 5. System & Preferences ─────────────────────────────────
      {
        id: 'sys-toggle-sidebar',
        label: 'Toggle Sidebar Collapse (Ctrl+B)',
        description: 'Expand or collapse the desktop navigation mini-rail',
        category: 'System & Preferences',
        icon: PanelLeft,
        action: () => {
          if (onToggleSidebar) {
            onToggleSidebar();
          }
        },
        badge: { text: 'Ctrl+B', variant: 'slate' },
        keywords: ['sidebar', 'collapse', 'expand', 'mini', 'menu'],
      },
      {
        id: 'sys-refresh-data',
        label: 'Reload Overview Telemetry',
        description: 'Force a full background sync of dashboard counters and active health',
        category: 'System & Preferences',
        icon: RefreshCw,
        action: () => {
          navigate('/');
          window.location.reload();
        },
        keywords: ['refresh', 'reload', 'sync', 'data'],
      },
      {
        id: 'sys-logout',
        label: 'Sign Out of Control Plane',
        description: 'Revoke active platform session and return to secure authentication gateway',
        category: 'System & Preferences',
        icon: LogOut,
        action: () => {
          logout();
        },
        badge: { text: 'Auth', variant: 'slate' },
        keywords: ['logout', 'signout', 'exit', 'disconnect'],
      },
    ];
  }, [navigate, logout, onOpenDiagnosticModal, onOpenOnboardModal, onToggleSidebar]);

  // Filter accessible commands by RBAC permissions & role
  const accessibleCommands = useMemo(() => {
    return catalog.filter((item) => {
      if (item.permission && !hasPermission(item.permission)) {
        return false;
      }
      if (item.roles && role && !item.roles.includes(role)) {
        return false;
      }
      return true;
    });
  }, [catalog, hasPermission, role]);

  // Search filter
  const filteredItems = useMemo(() => {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return accessibleCommands;

    return accessibleCommands.filter((item) => {
      const matchLabel = item.label.toLowerCase().includes(cleanQuery);
      const matchDesc = item.description?.toLowerCase().includes(cleanQuery);
      const matchCategory = item.category.toLowerCase().includes(cleanQuery);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(cleanQuery));
      return matchLabel || matchDesc || matchCategory || matchKeywords;
    });
  }, [accessibleCommands, query]);

  // Reset selectedIndex when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input and reset state on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      isKeyboardNavigatingRef.current = false;
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Auto-scroll selected element into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>('[aria-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Execute selected command
  const executeCommand = useCallback(
    (item: CommandItem) => {
      onClose();
      if (item.action) {
        item.action();
      } else if (item.path) {
        navigate(item.path);
      }
    },
    [navigate, onClose]
  );

  // Keyboard navigation inside Combobox
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (filteredItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        isKeyboardNavigatingRef.current = true;
        setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        isKeyboardNavigatingRef.current = true;
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        isKeyboardNavigatingRef.current = true;
        setSelectedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        isKeyboardNavigatingRef.current = true;
        setSelectedIndex(filteredItems.length - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          executeCommand(selected);
        }
      }
    },
    [filteredItems, selectedIndex, executeCommand, onClose]
  );

  const selectedItem = filteredItems[selectedIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 no-print select-none"
          role="presentation"
        >
          {/* Backdrop with lightweight blur */}
          <motion.div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog Container */}
          <motion.div
            className="relative w-full max-w-2xl bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden z-10 flex flex-col max-h-[75vh]"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity' }}
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar (Combobox Pattern) */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-800/80 gap-3 bg-slate-900/90">
              <Search className="w-5 h-5 text-sky-400 shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isOpen}
                aria-controls="command-palette-list"
                aria-activedescendant={selectedItem ? `command-item-${selectedItem.id}` : undefined}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands, navigate pages, or execute operations... (Ctrl+K)"
                className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-sm sm:text-base focus:outline-none"
                aria-label="Platform Control Plane Command Search"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                  aria-label="Clear query"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/80 rounded">
                  ESC
                </kbd>
              )}
            </div>

            {/* Screen-reader Live Region for Results Count */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {filteredItems.length === 0
                ? 'No matching commands found'
                : `${filteredItems.length} commands available. Use arrow keys to navigate.`}
            </div>

            {/* Results Listbox */}
            <div
              id="command-palette-list"
              ref={listRef}
              role="listbox"
              aria-label="Command suggestions"
              onMouseMove={() => {
                isKeyboardNavigatingRef.current = false;
              }}
              className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[160px] max-h-[420px]"
            >
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm font-medium">No results found for &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Try searching for Tenants, Subscriptions, Audit, or Diagnostic sessions
                  </p>
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.id}
                      id={`command-item-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => executeCommand(item)}
                      onMouseEnter={() => {
                        if (isKeyboardNavigatingRef.current) return;
                        setSelectedIndex(index);
                      }}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-500/15 text-white border border-sky-500/40 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-100">{item.label}</span>
                            <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
                              in {item.category}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-400 truncate mt-0.5 font-normal">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {item.badge && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                              BADGE_VARIANTS[item.badge.variant] || BADGE_VARIANTS.slate
                            }`}
                          >
                            {item.badge.text}
                          </span>
                        )}
                        {isSelected && (
                          <div className="flex items-center gap-1 text-xs text-sky-400">
                            <span className="hidden sm:inline text-[11px]">Execute</span>
                            <CornerDownLeft className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Shortcut Guide */}
            <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700/80 rounded font-mono text-slate-300">
                    ↑
                  </kbd>
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700/80 rounded font-mono text-slate-300">
                    ↓
                  </kbd>
                  <span>navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700/80 rounded font-mono text-slate-300">
                    ↵
                  </kbd>
                  <span>select</span>
                </span>
              </div>
              <span className="text-slate-400 flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700/80 rounded font-mono text-slate-300">
                  Esc
                </kbd>
                <span>close</span>
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
