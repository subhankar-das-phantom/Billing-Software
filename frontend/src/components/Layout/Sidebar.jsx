import { useState, useMemo, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { invoiceService } from '../../services/invoices/invoiceService';
import { useSWR } from '../../hooks';
import {
  getFilteredNavigation,
  isRouteActive,
} from './navigationConfig';

/**
 * Collapsed Tooltip Component
 * Displays label, section category, and badge details on hover
 */
const NavItemTooltip = memo(({ label, sectionTitle, badge }) => (
  <div className="fixed left-[72px] z-50 pointer-events-none px-3 py-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-xl shadow-black/50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-white">{label}</span>
      {badge && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            badge.color || 'bg-blue-500/20 text-blue-300'
          }`}
        >
          {badge.text}
        </span>
      )}
    </div>
    <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">
      {sectionTitle}
    </div>
  </div>
));
NavItemTooltip.displayName = 'NavItemTooltip';

/**
 * Individual Navigation Item
 */
const SidebarNavItem = memo(
  ({
    item,
    sectionTitle,
    isCollapsed,
    isMobile,
    currentPath,
    onClose,
    hoveredItem,
    setHoveredItem,
  }) => {
    const isActive = isRouteActive(item.path, currentPath);
    const Icon = item.icon;
    const isHovered = hoveredItem === item.path;

    return (
      <li className="relative">
        <Link
          to={item.path}
          onClick={onClose}
          aria-label={item.label}
          aria-current={isActive ? 'page' : undefined}
          onMouseEnter={() => setHoveredItem(item.path)}
          onMouseLeave={() => setHoveredItem(null)}
          className={`group relative flex items-center gap-3 rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            isCollapsed && !isMobile
              ? 'justify-center p-3 my-1'
              : 'px-3.5 py-2.5 my-0.5'
          } ${
            isActive
              ? 'bg-gradient-to-r from-blue-600/20 to-accent-600/20 border border-blue-500/30 text-blue-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          {/* Active Accent Bar on Left */}
          {isActive && (
            <motion.div
              layoutId={isMobile ? undefined : 'sidebarActiveIndicator'}
              className="absolute left-0 w-1 h-5 bg-gradient-to-b from-blue-400 to-accent-400 rounded-r-full"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}

          {/* Icon with potential notification/badge dot in collapsed mode */}
          <div className="relative flex items-center justify-center shrink-0">
            <Icon
              size={isCollapsed && !isMobile ? 22 : 19}
              strokeWidth={isActive ? 2.5 : 2}
              className={`transition-colors duration-150 ${
                isActive
                  ? 'text-blue-400'
                  : 'text-slate-400 group-hover:text-slate-200'
              }`}
            />
            {/* Subtle indicator dot when collapsed and item has a badge */}
            {isCollapsed && !isMobile && item.badge && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-slate-900" />
            )}
          </div>

          {/* Label and Badge (Expanded or Mobile mode) */}
          {(!isCollapsed || isMobile) && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="truncate text-sm font-medium">{item.label}</span>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ml-2 ${
                    item.badge.color ||
                    'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {item.badge.text}
                </span>
              )}
            </div>
          )}
        </Link>

        {/* Rich Floating Tooltip in Collapsed Rail Mode */}
        {isCollapsed && !isMobile && isHovered && (
          <NavItemTooltip
            label={item.label}
            sectionTitle={sectionTitle}
            badge={item.badge}
          />
        )}
      </li>
    );
  }
);
SidebarNavItem.displayName = 'SidebarNavItem';

export default function Sidebar({
  isCollapsed = false,
  onToggleCollapse,
  isMobile = false,
  onClose,
}) {
  const location = useLocation();
  const { admin, user, isAdmin, hasPermission, logout } = useAuth();
  const [hoveredItem, setHoveredItem] = useState(null);

  // Cached Invoice count query for dynamic badge
  const { data: invoiceCount = 0 } = useSWR(
    'invoices-count-sidebar',
    async () => {
      try {
        const data = await invoiceService.getInvoices({ limit: 1 });
        return data.total || 0;
      } catch {
        return 0;
      }
    },
    { ttl: 60 * 1000 }
  );

  // Filter accessible navigation categories & items
  const filteredNavigation = useMemo(() => {
    return getFilteredNavigation({
      isAdmin,
      hasPermission,
      dynamicData: { invoiceCount },
    });
  }, [isAdmin, hasPermission, invoiceCount]);

  // User identity details
  const displayName = isAdmin
    ? admin?.firmName || 'Bharat Enterprise'
    : user?.name || 'Employee';
  const displayEmail = isAdmin
    ? admin?.email || 'admin@bharat.com'
    : user?.email || 'employee';
  const userInitial = displayName.charAt(0).toUpperCase() || 'B';

  return (
    <aside
      className={`h-full bg-slate-900/95 border-r border-slate-800/80 flex flex-col backdrop-blur-xl transition-all duration-300 select-none ${
        isMobile ? 'w-full' : isCollapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      {/* ─── Header: Brand & Collapse Toggle ────────────────────────────── */}
      <div
        className={`shrink-0 flex items-center border-b border-slate-800/80 h-16 ${
          isCollapsed && !isMobile
            ? 'justify-center px-2'
            : 'justify-between px-4'
        }`}
      >
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-3 group focus-visible:outline-none"
          title="Bharat Enterprise"
        >
          {/* Logo Badge */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-accent-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform duration-200">
            <span className="text-white font-bold text-base">B</span>
          </div>

          {/* Brand Name (Expanded/Mobile) */}
          {(!isCollapsed || isMobile) && (
            <div className="min-w-0">
              <h1 className="font-bold text-base text-white tracking-tight leading-none truncate">
                Bharat
              </h1>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">
                Enterprise
              </p>
            </div>
          )}
        </Link>

        {/* Mobile Close Button (44x44px touch target) */}
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        )}

        {/* Desktop / Tablet Collapse Toggle Button */}
        {!isMobile && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 active:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isCollapsed ? 'hidden' : 'block'
            }`}
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
      </div>

      {/* ─── Expand button for Collapsed Rail Header ─────────────────── */}
      {!isMobile && isCollapsed && onToggleCollapse && (
        <div className="px-2 pt-2 flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-full py-1.5 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Expand sidebar (Ctrl+B)"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ─── Navigation Scroll Area ───────────────────────────────────── */}
      <nav className="flex-1 p-2.5 overflow-y-auto custom-scrollbar space-y-4">
        {filteredNavigation.map((section, sectionIdx) => (
          <div key={section.id} className="space-y-1">
            {/* Section Header */}
            {(!isCollapsed || isMobile) ? (
              <div className="text-[11px] font-semibold text-slate-400/90 tracking-wider uppercase px-3 py-1 mt-1">
                {section.title}
              </div>
            ) : (
              sectionIdx > 0 && <div className="border-t border-slate-800/70 my-2 mx-2" />
            )}

            {/* Section Items */}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  sectionTitle={section.title}
                  isCollapsed={isCollapsed}
                  isMobile={isMobile}
                  currentPath={location.pathname}
                  onClose={isMobile ? onClose : undefined}
                  hoveredItem={hoveredItem}
                  setHoveredItem={setHoveredItem}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* ─── Fixed Sticky Footer: User & Logout ───────────────────────── */}
      <div className="shrink-0 p-3 border-t border-slate-800/80 bg-slate-950/40">
        {(!isCollapsed || isMobile) ? (
          <div className="space-y-2.5">
            {/* User Profile Card */}
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md shrink-0 text-white font-semibold text-sm ${
                  isAdmin
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                    : 'bg-gradient-to-br from-blue-500 to-accent-600 shadow-blue-500/20'
                }`}
              >
                {userInitial}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-white truncate">
                    {displayName}
                  </p>
                  {isAdmin && (
                    <span className="text-[9px] px-1.5 py-0.2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded font-medium shrink-0">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {displayEmail}
                </p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 transition-all text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          /* Collapsed Rail Footer Mode */
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md text-white font-semibold text-sm cursor-default ${
                isAdmin
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                  : 'bg-gradient-to-br from-blue-500 to-accent-600'
              }`}
              title={`${displayName} (${displayEmail})`}
            >
              {userInitial}
            </div>

            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
