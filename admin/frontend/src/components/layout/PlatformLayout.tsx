/**
 * Bharat Enterprise Billing System — Platform Control Plane Main Layout
 * High-density layout shell: Top navbar + Collapsible/Rail Sidebar + Active Support Banner + Command Palette + Content Outlet.
 *
 * Guarantees:
 *   - Synchronous Frame-0 pre-seeding of sidebar collapse state from localStorage ('platform_sidebar_collapsed')
 *   - Dynamic content margin offset (md:ml-[68px] vs md:ml-64) with smooth transition
 *   - Global Command Palette (Ctrl+K / ⌘K) and hotkey dispatch via useKeyboardShortcuts
 *   - Max-width expansion to max-w-[1600px] mx-auto for enterprise monitors
 *   - GPU-accelerated page transitions on <Outlet />
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import Sidebar from './Sidebar';
import PlatformHeader from './PlatformHeader';
import ActiveSupportBanner from './ActiveSupportBanner';
import { CommandPalette } from '../common/CommandPalette';
import { PageTransition } from '../common/PageTransition';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import {
  PLATFORM_FORBIDDEN_EVENT,
  type PlatformForbiddenDetail,
} from '../../services/api';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'platform_sidebar_collapsed';

export const PlatformLayout: React.FC = () => {
  const location = useLocation();

  // Synchronous Frame-0 pre-seeding of sidebar collapse from localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [forbiddenToast, setForbiddenToast] = useState<PlatformForbiddenDetail | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggle desktop sidebar collapse and persist to localStorage
  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage exceptions in sandboxed environments
      }
      return next;
    });
  }, []);

  // Listen to centralized keyboard shortcuts (Ctrl+K, Ctrl+B, Escape)
  useKeyboardShortcuts({
    onOpenCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    onToggleSidebar: toggleSidebarCollapse,
    onEscape: () => {
      if (commandPaletteOpen) {
        setCommandPaletteOpen(false);
        return true;
      }
      if (sidebarOpen) {
        setSidebarOpen(false);
        return true;
      }
    },
    escapePriority: 10,
  });

  // Listen to decoupled 403 Forbidden events dispatched by Axios interceptor
  useEffect(() => {
    const handleForbidden = (event: Event) => {
      const customEvent = event as CustomEvent<PlatformForbiddenDetail>;
      setForbiddenToast(customEvent.detail);

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = setTimeout(() => {
        setForbiddenToast(null);
      }, 6000);
    };

    window.addEventListener(PLATFORM_FORBIDDEN_EVENT, handleForbidden);
    return () => {
      window.removeEventListener(PLATFORM_FORBIDDEN_EVENT, handleForbidden);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* ── Mobile Backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs md:hidden animate-in fade-in duration-150"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Navigation Sidebar (Collapsible Desktop Rail + Mobile Sheet Drawer) ── */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* ── Main Content Column (Offset dynamically by md:ml-[68px] or md:ml-64) ── */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-screen transition-[margin-left] duration-300 ease-in-out ${
          isSidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-64'
        }`}
      >
        {/* 1. Zero-CLS Active Support Diagnostic Banner */}
        <ActiveSupportBanner />

        {/* 2. Platform Main Header with Breadcrumbs, Fiscal Calendar, and Profile Dropdown */}
        <PlatformHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={toggleSidebarCollapse}
          onOpenMobileSidebar={() => setSidebarOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        {/* 3. Non-intrusive 403 Forbidden Toast */}
        {forbiddenToast && (
          <div className="fixed top-16 right-4 z-50 max-w-md w-full animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3 bg-amber-950/95 border border-amber-600/80 rounded-lg shadow-xl shadow-black/60 flex items-start gap-3 text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <span className="font-semibold block text-amber-300">Action Not Permitted</span>
                <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                  {forbiddenToast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForbiddenToast(null)}
                className="text-amber-400 hover:text-amber-200 p-1 -mr-1 -mt-1 cursor-pointer"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 4. High-Density Scrollable Main Content Pane */}
        <main className="flex-1 p-3 sm:p-5 lg:p-7 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      {/* ── Global Command Palette (Ctrl+K / ⌘K) ── */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onToggleSidebar={toggleSidebarCollapse}
      />
    </div>
  );
};

export default PlatformLayout;
