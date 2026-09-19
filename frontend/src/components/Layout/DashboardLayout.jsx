import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown } from 'lucide-react';
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

  // Bidirectional Scroll Button State ('top' | 'bottom' | null)
  const [scrollButtonDirection, setScrollButtonDirection] = useState(null);
  const [isNearBottom, setIsNearBottom] = useState(false);
  const lastScrollTopRef = useRef(0);

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

  // Close overlays and reset scroll position on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
    setTabletDrawerOpen(false);
    setCommandPaletteOpen(false);
    setScrollButtonDirection(null);
    setIsNearBottom(false);
    lastScrollTopRef.current = 0;

    // Reset scroll position to top of main content container on page navigation
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }

    // Anchor to top after any pending frame/render or route transition completes
    const rafId = window.requestAnimationFrame(() => {
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [location.pathname]);

  // Track scroll direction & bottom proximity in main content area
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!mainEl) return;
          const currentScrollTop = mainEl.scrollTop;
          const scrollHeight = mainEl.scrollHeight;
          const clientHeight = mainEl.clientHeight;
          const lastScrollTop = lastScrollTopRef.current;

          // Check if user is near the bottom (within 90px of bottom edge)
          const nearBottom = scrollHeight - currentScrollTop - clientHeight < 90;
          setIsNearBottom(nearBottom);

          // Bidirectional navigation logic:
          const hasScrollableDepth = scrollHeight > clientHeight + 400;

          if (currentScrollTop < 250 && hasScrollableDepth) {
            // Near top on a long scrollable page: offer "Scroll to bottom"
            setScrollButtonDirection('bottom');
          } else if (currentScrollTop >= 250) {
            // Scrolled down: offer "Scroll to top"
            if (currentScrollTop < lastScrollTop - 6) {
              // Scrolling UP: user moving back upwards, reveal button
              setScrollButtonDirection('top');
            } else if (nearBottom) {
              // At the bottom: keep button visible as 'top' so user can return to top easily
              setScrollButtonDirection('top');
            } else if (currentScrollTop > lastScrollTop + 6) {
              // Scrolling DOWN actively: hide button
              setScrollButtonDirection(null);
            }
          } else {
            setScrollButtonDirection(null);
          }

          lastScrollTopRef.current = currentScrollTop;
          ticking = false;
        });
        ticking = true;
      }
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    // Run an initial check after mounting / route changes
    handleScroll();
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  const handleScrollToTop = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleScrollToBottom = useCallback(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: mainRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

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
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-100 antialiased">
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden relative">
        {/* Top Header (Non-scrolling flex item, strictly outside main) */}
        <div className="no-print shrink-0 w-full z-30">
          <Header
            onToggleSidebar={handleToggleSidebar}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            isSidebarCollapsed={sidebarCollapsed}
            isDesktop={isDesktop}
          />
        </div>

        {/* Main Content Area (Sole vertical scroll container) */}
        <main
          ref={mainRef}
          className="flex-1 min-h-0 min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-950"
        >
          <div className="max-w-[1600px] mx-auto w-full">
            <div className="no-print">
              <SubscriptionBanner />
            </div>
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
      </div>

      {/* ─── 4. Global Utilities ──────────────────────────────────────── */}
      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Dynamic Bidirectional Scroll Button (Scroll to bottom or Scroll to top) */}
      {scrollButtonDirection && (
        <button
          type="button"
          onClick={scrollButtonDirection === 'top' ? handleScrollToTop : handleScrollToBottom}
          aria-label={scrollButtonDirection === 'top' ? 'Scroll to top' : 'Scroll to bottom'}
          title={scrollButtonDirection === 'top' ? 'Scroll to top' : 'Scroll to bottom'}
          className={`fixed right-6 p-2.5 sm:p-3 rounded-full z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 no-print bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-xl shadow-slate-950/60 flex items-center justify-center cursor-pointer transition-all ${
            isNearBottom ? 'bottom-20 sm:bottom-24' : 'bottom-6 sm:bottom-8'
          }`}
        >
          {scrollButtonDirection === 'top' ? (
            <ArrowUp className="w-5 h-5 text-emerald-400" />
          ) : (
            <ArrowDown className="w-5 h-5 text-emerald-400" />
          )}
        </button>
      )}

      {/* Calculator Widget */}
      <Suspense fallback={null}>
        {user?.preferences?.showCalculator !== false && <CalculatorWidget />}
      </Suspense>
    </div>
  );
}
