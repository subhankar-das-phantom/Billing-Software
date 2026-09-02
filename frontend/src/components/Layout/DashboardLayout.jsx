import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import SubscriptionBanner from '../Subscription/SubscriptionBanner';
import CommandPalette from './CommandPalette';
import { RouteTransition } from '../Common/Motion/PageTransition';
import { useMotionConfig } from '../../hooks';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';

const CalculatorWidget = lazy(() => import('../../features/calculator/CalculatorWidget'));

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'bharat-enterprise-sidebar-collapsed';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const motionConfig = useMotionConfig();
  const { user } = useAuth();
  const mainRef = useRef(null);

  // Responsive Breakpoint checks
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Desktop sidebar collapsed state (persisted in localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Mobile and Tablet drawer open states
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);

  // Command Palette open state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Save desktop collapsed state to localStorage
  const handleToggleDesktopCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save sidebar state', err);
      }
      return next;
    });
  }, []);

  // Universal toggle triggered by Header button
  const handleToggleSidebar = useCallback(() => {
    if (isDesktop) {
      handleToggleDesktopCollapse();
    } else if (isTablet) {
      setTabletDrawerOpen((prev) => !prev);
    } else {
      setMobileDrawerOpen((prev) => !prev);
    }
  }, [isDesktop, isTablet, handleToggleDesktopCollapse]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt+N / Option+N -> Create New Invoice
      if (e.altKey && (e.key.toLowerCase() === 'n' || e.code === 'KeyN')) {
        e.preventDefault();
        navigate('/invoices/create');
        return;
      }

      // Ctrl+K / Cmd+K -> Toggle Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl+B / Cmd+B -> Toggle Desktop Sidebar Collapse
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        if (isDesktop) {
          e.preventDefault();
          handleToggleDesktopCollapse();
        }
        return;
      }

      // Escape key closes mobile/tablet drawers
      if (e.key === 'Escape') {
        if (mobileDrawerOpen) setMobileDrawerOpen(false);
        if (tabletDrawerOpen) setTabletDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktop, mobileDrawerOpen, tabletDrawerOpen, handleToggleDesktopCollapse, navigate]);

  // Touch / Swipe gesture handling for Sidebar (open by right swipe, close by left swipe)
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isTracking = false;
    let isVerticalScroll = false;

    const handleTouchStart = (e) => {
      // Only track single touch
      if (!e.touches || e.touches.length !== 1) {
        isTracking = false;
        return;
      }

      // Ignore touches starting on interactive elements (inputs, textareas, selects, sliders)
      const target = e.target;
      if (
        target?.closest &&
        target.closest('input, textarea, select, [contenteditable="true"], [role="slider"], .no-swipe')
      ) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      isTracking = true;
      isVerticalScroll = false;
    };

    const handleTouchMove = (e) => {
      if (!isTracking || isVerticalScroll || !e.touches || e.touches.length === 0) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // If user has moved noticeably vertical before horizontal, it's a page scroll
      if (absY > 35 && absY > absX * 1.5) {
        isVerticalScroll = true;
      }
    };

    const handleTouchEnd = (e) => {
      if (!isTracking || isVerticalScroll) {
        isTracking = false;
        return;
      }
      isTracking = false;

      if (!e.changedTouches || e.changedTouches.length === 0) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const elapsedTime = Date.now() - touchStartTime;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Must be primarily horizontal gesture and within 1 second
      if (absX < 35 || absX < absY * 1.2 || elapsedTime > 1000) {
        return;
      }

      const isDrawerCurrentlyOpen = mobileDrawerOpen || tabletDrawerOpen;

      // ─── Case 1: Drawer is OPEN -> Left swipe closes it ───
      if (isDrawerCurrentlyOpen) {
        if (deltaX < -35) {
          setMobileDrawerOpen(false);
          setTabletDrawerOpen(false);
        }
        return;
      }

      // ─── Case 2: Drawer / Sidebar is CLOSED -> Right swipe opens it ───
      if (deltaX > 35) {
        // Expanded touch zone: allow swipe right starting anywhere across the left half of the screen or header
        const isFromLeftZone = touchStartX <= Math.max(180, window.innerWidth * 0.50);
        const isFromHeader = touchStartY <= 80;

        if (isFromLeftZone || isFromHeader) {
          if (isDesktop) {
            // On desktop touch screen: if collapsed, right swipe expands
            if (sidebarCollapsed) {
              setSidebarCollapsed(false);
              try {
                localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, JSON.stringify(false));
              } catch {}
            }
          } else if (isTablet) {
            setTabletDrawerOpen(true);
          } else {
            setMobileDrawerOpen(true);
          }
        }
      } else if (isDesktop && !sidebarCollapsed && deltaX < -50 && touchStartX <= 280) {
        // On desktop touch screen: left swipe on expanded sidebar collapses it
        setSidebarCollapsed(true);
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, JSON.stringify(true));
        } catch {}
      }
    };

    const handleTouchCancel = () => {
      isTracking = false;
      isVerticalScroll = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [mobileDrawerOpen, tabletDrawerOpen, isDesktop, isTablet, sidebarCollapsed]);

  // Close overlays on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
    setTabletDrawerOpen(false);
    setCommandPaletteOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile or tablet drawer is open
  const isDrawerOpen = mobileDrawerOpen || tabletDrawerOpen;
  useEffect(() => {
    if (isDrawerOpen) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const originalOverflow = document.body.style.overflow;
      const scrollY = window.scrollY;

      if (isIOS) {
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
      } else {
        document.body.style.overflow = 'hidden';
      }

      return () => {
        if (isIOS) {
          document.body.style.position = '';
          document.body.style.top = '';
          document.body.style.width = '';
          window.scrollTo(0, Math.abs(parseInt(scrollY || '0', 10)));
        } else {
          document.body.style.overflow = originalOverflow;
        }
      };
    }
  }, [isDrawerOpen]);

  const drawerTransition = motionConfig.isMobile
    ? { type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] }
    : { type: 'spring', stiffness: 350, damping: 32 };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 text-slate-100 antialiased">
      {/* ─── 1. Desktop & Tablet Persistent Sidebar Rail ──────────────── */}
      {!isMobile && (
        <div className="shrink-0 z-40 h-full flex flex-col no-print">
          <Sidebar
            isCollapsed={isTablet ? true : sidebarCollapsed}
            onToggleCollapse={isDesktop ? handleToggleDesktopCollapse : () => setTabletDrawerOpen(true)}
            isMobile={false}
          />
        </div>
      )}

      {/* ─── 2. Mobile Off-Canvas Drawer & Tablet Temporary Drawer ───── */}
      <AnimatePresence>
        {(mobileDrawerOpen || tabletDrawerOpen) && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 touch-none no-print"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setMobileDrawerOpen(false);
                setTabletDrawerOpen(false);
              }}
            />

            {/* Slide-out Panel */}
            <motion.div
              key="drawer-panel"
              className="fixed inset-y-0 left-0 z-50 max-w-[82vw] w-72 shadow-2xl shadow-black no-print"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={drawerTransition}
            >
              <Sidebar
                isCollapsed={false}
                isMobile={true}
                onClose={() => {
                  setMobileDrawerOpen(false);
                  setTabletDrawerOpen(false);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── 3. Main Application Column ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Header */}
        <div className="no-print">
          <Header
            onToggleSidebar={handleToggleSidebar}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            isSidebarCollapsed={sidebarCollapsed}
            isDesktop={isDesktop}
          />
        </div>

        {/* Main Content Area */}
        <main
          ref={mainRef}
          className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-w-0"
        >
          <div className="max-w-[1600px] mx-auto w-full">
            <SubscriptionBanner />
            <RouteTransition
              location={location}
              variant="fadeUp"
              transition="smooth"
            >
              <div className="h-full">
                <Outlet />
              </div>
            </RouteTransition>
          </div>
        </main>

        {/* Animated background gradient - Desktop only */}
        {motionConfig.shouldInfiniteAnimate && (
          <motion.div
            className="fixed inset-0 pointer-events-none opacity-20 z-0 no-print"
            animate={{
              background: [
                'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
                'radial-gradient(circle at 80% 50%, rgba(20, 184, 166, 0.08) 0%, transparent 50%)',
                'radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
                'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
              ],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}
      </div>

      {/* ─── 4. Global Utilities ──────────────────────────────────────── */}
      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Scroll to top button */}
      <motion.button
        className="fixed bottom-6 right-6 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-600/30 z-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={motionConfig.shouldHover ? { scale: 1.1 } : undefined}
        whileTap={{ scale: 0.9 }}
        transition={motionConfig.spring.normal}
        onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
      >
        <ChevronRight className="w-5 h-5 -rotate-90" />
      </motion.button>

      {/* Calculator Widget */}
      <Suspense fallback={null}>
        {user?.preferences?.showCalculator !== false && <CalculatorWidget />}
      </Suspense>
    </div>
  );
}
