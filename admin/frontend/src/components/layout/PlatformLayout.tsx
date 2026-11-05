/**
 * Bharat Enterprise Billing System — Platform Control Plane Main Layout
 * High-density layout shell: Top navbar + Sidebar + Active Support Banner + Content Outlet.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Shield, AlertTriangle, X } from 'lucide-react';
import Sidebar from './Sidebar';
import ActiveSupportBanner from './ActiveSupportBanner';
import { usePlatformAuth } from '../../contexts/PlatformAuthContext';
import {
  PLATFORM_FORBIDDEN_EVENT,
  type PlatformForbiddenDetail,
} from '../../services/api';

export const PlatformLayout: React.FC = () => {
  const { user } = usePlatformAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [forbiddenToast, setForbiddenToast] = useState<PlatformForbiddenDetail | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (fixed w-64 on desktop) */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Column (offset by md:ml-64 to clear fixed desktop sidebar) */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0 min-h-screen">
        {/* 1. Zero-CLS Active Support Banner */}
        <ActiveSupportBanner />

        {/* 2. Platform Top Navbar */}
        <header className="h-14 min-h-[56px] border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-xs sticky top-0 z-20 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger menu toggle */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-slate-800 text-cyan-400 border border-slate-700/80">
                <Shield className="w-3.5 h-3.5" />
                <span>Production Control Plane</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-slate-200">{user?.fullName}</div>
              <div className="text-[10px] text-slate-400 font-mono">{user?.role}</div>
            </div>
          </div>
        </header>

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
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 4. Scrollable Main Content Pane */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default PlatformLayout;
