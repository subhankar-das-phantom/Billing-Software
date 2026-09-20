import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
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
  const navigationType = useNavigationType();
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

  // Dynamic Scroll-to-Top state & direction tracking
  const [showScrollTop, setShowScrollTop] = useState(false);
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
    setShowScrollTop(false);
    lastScrollTopRef.current = 0;

    // Reset scroll position on fresh/forward navigation; preserve browser scroll restoration on back/forward (POP)
    if (navigationType !== 'POP' && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, navigationType]);

  // Track window scroll position to display Scroll-to-Top button
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
          const lastScrollTop = lastScrollTopRef.current;

          // Direction & threshold logic:
          // If scrolled less than 250px from the top, always hide.
          if (currentScrollTop < 250) {
            setShowScrollTop(false);
          } else if (currentScrollTop < lastScrollTop - 6) {
            // Scrolling UP: user is moving back upwards, reveal the button
            setShowScrollTop(true);
          } else if (currentScrollTop > lastScrollTop + 6) {
            // Scrolling DOWN: user is exploring or reading downwards, hide the button
            setShowScrollTop(false);
          }

          lastScrollTopRef.current = currentScrollTop;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  const handleScrollToTop = useCallback(() => {
    // Immediately hide button and reset direction tracking to prevent flicker
    setShowScrollTop(false);
    lastScrollTopRef.current = 0;

    const currentScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (currentScrollTop > 1200) {
      // Clamp & Glide: Instantly cut to a near-top buffer (350px) then glide smoothly to 0
      window.scrollTo({ top: 350, behavior: 'auto' });
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      // Direct native smooth scroll
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-100 antialiased">
      {/* ─── 1. Desktop & Tablet Persistent Sidebar Rail ──────────────── */}
      {!isMobile && (
        <div className="shrink-0 z-20 sticky top-0 h-screen flex flex-col no-print">
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
              role="dialog"
              aria-modal="true"
              aria-label="Navigation Menu"
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
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Header (Non-scrolling flex item, strictly outside main) */}
        <div className="no-print shrink-0 w-full z-30 sticky top-0">
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
          className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10 bg-slate-950"
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

      {/* Dynamic Scroll to top button (lightweight GPU-composited CSS transition) */}
      <button
        type="button"
        onClick={handleScrollToTop}
        aria-label="Scroll to top"
        title="Scroll to top"
        aria-hidden={!showScrollTop}
        tabIndex={showScrollTop ? 0 : -1}
        className={`fixed right-6 bottom-6 sm:bottom-8 p-2.5 sm:p-3 rounded-full z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 no-print bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-xl shadow-slate-950/60 flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-150 ease-out will-change-transform ${
          showScrollTop
            ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
            : 'opacity-0 translate-y-3 pointer-events-none scale-90'
        }`}
      >
        <ArrowUp className="w-5 h-5 text-emerald-400" />
      </button>

      {/* Calculator Widget */}
      <Suspense fallback={null}>
        {user?.preferences?.showCalculator !== false && <CalculatorWidget />}
      </Suspense>
    </div>
  );
}
