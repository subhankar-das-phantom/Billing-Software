import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveBreadcrumbs } from './navigationConfig';

export default function Header({
  onToggleSidebar,
  onOpenCommandPalette,
  isSidebarCollapsed = false,
  isDesktop = false,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, user, isAdmin, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Derive dynamic breadcrumbs and title from current route
  const { title, crumbs } = resolveBreadcrumbs(location.pathname);

  // Close profile dropdown on outside click or ESC
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target)
      ) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
      }
    };

    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [profileOpen]);

  // User identity strings
  const displayName = isAdmin
    ? admin?.firmName || 'Admin'
    : user?.name || 'Employee';
  const displayEmail = isAdmin
    ? admin?.email || 'admin@bharat.com'
    : user?.email || 'employee';
  const userInitial = displayName.charAt(0).toUpperCase() || 'U';

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 transition-colors no-print">
      <div className="flex items-center justify-between px-4 sm:px-6 h-16 gap-3">
        {/* ─── Left: Navigation Toggle & Breadcrumbs ───────────────────── */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Sidebar Toggle Button (44x44px touch target) */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 active:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0"
            aria-label={
              isDesktop
                ? isSidebarCollapsed
                  ? 'Expand sidebar (Ctrl+B)'
                  : 'Collapse sidebar (Ctrl+B)'
                : 'Open navigation menu'
            }
            title={
              isDesktop
                ? isSidebarCollapsed
                  ? 'Expand sidebar (Ctrl+B)'
                  : 'Collapse sidebar (Ctrl+B)'
                : 'Menu'
            }
          >
            {isDesktop ? (
              isSidebarCollapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )
            ) : (
              <Menu size={22} />
            )}
          </button>

          {/* Breadcrumbs & Page Title */}
          <div className="flex flex-col min-w-0">
            {/* Breadcrumb Hierarchy (Hidden on small mobile screens) */}
            <nav
              aria-label="Breadcrumbs"
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium overflow-hidden whitespace-nowrap"
            >
              <Link
                to="/"
                className="hover:text-blue-400 transition-colors shrink-0"
              >
                Home
              </Link>
              {crumbs?.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-1.5 shrink-0">
                  <ChevronRight size={12} className="text-slate-400 shrink-0" />
                  {crumb.path && idx < crumbs.length - 1 ? (
                    <Link
                      to={crumb.path}
                      className="hover:text-blue-400 transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-300 font-medium">
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>

            {/* Current Page Title */}
            <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate leading-tight">
              {title}
            </h1>
          </div>
        </div>

        {/* ─── Center/Right: Command Palette, Date, User Profile ───────── */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Command Palette Trigger Bar */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 text-slate-400 hover:text-slate-200 transition-all text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group"
            title="Search navigation and actions (Ctrl+K)"
            aria-label="Search navigation and actions"
          >
            <Search size={15} className="text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="hidden md:inline font-medium">Search navigation...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded shadow-xs">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </button>

          {/* Current Date Badge */}
          <div className="hidden lg:flex items-center px-3 py-1.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs font-medium text-slate-400">
            {formattedDate}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 hover:border-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-expanded={profileOpen}
              aria-label="User menu"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md text-white font-semibold text-xs shrink-0 ${
                  isAdmin
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                    : 'bg-gradient-to-br from-blue-500 to-accent-600 shadow-blue-500/20'
                }`}
              >
                {userInitial}
              </div>

              <div className="hidden xl:block text-left min-w-0 max-w-[130px]">
                <p className="text-xs font-medium text-white truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {isAdmin ? 'Administrator' : 'Employee'}
                </p>
              </div>

              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-200 hidden sm:block ${
                  profileOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Card */}
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50 p-1.5"
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                >
                  {/* Profile Header */}
                  <div className="p-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-white truncate">
                        {displayName}
                      </p>
                      {isAdmin && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {displayEmail}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="p-1 space-y-0.5">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          navigate('/settings');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          location.pathname === '/settings'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Settings size={15} />
                        <span>Settings</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      <LogOut size={15} />
                      <span>Logout</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
