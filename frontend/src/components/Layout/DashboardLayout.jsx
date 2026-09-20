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

  // Touch / Swipe gesture handling for Sidebar with velocity & acceleration physics
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isTracking = false;
    let isVerticalScroll = false;
    let recentSamples = []; // [{ x, y, time }]

    const handleTouchStart = (e) => {
      // Only track single touch
      if (!e.touches || e.touches.length !== 1) {
        isTracking = false;
        return;
      }

      // Visual Viewport Zoom Immunity: If user is pinch-zoomed in on mobile (including desktop site view),
      // all 1-finger gestures belong to native viewport panning and must not be hijacked.
      if (window.visualViewport && window.visualViewport.scale > 1.05) {
        isTracking = false;
        return;
      }

      // If page is already scrolled horizontally, horizontal swipe is for panning content back
      const isHorizontallyScrolled =
        window.scrollX > 5 ||
        document.documentElement.scrollLeft > 5 ||
        (window.visualViewport && window.visualViewport.pageLeft > 5);

      const isDrawerCurrentlyOpen = mobileDrawerOpen || tabletDrawerOpen;

      if (!isDrawerCurrentlyOpen && isHorizontallyScrolled) {
        isTracking = false;
        return;
      }

      // Ignore touches starting on interactive elements or horizontally scrollable containers
      const target = e.target;
      if (
        target?.closest &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="slider"], .no-swipe, [data-horizontal-table-scroll="true"], [role="tablist"], .overflow-x-auto, table'
        )
      ) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      recentSamples = [{ x: touch.clientX, y: touch.clientY, time: touchStartTime }];
      isTracking = true;
      isVerticalScroll = false;
    };

    const handleTouchMove = (e) => {
      if (!isTracking || isVerticalScroll || !e.touches || e.touches.length === 0) return;

      // Check zoom during move in case user initiated a pinch gesture
      if (window.visualViewport && window.visualViewport.scale > 1.05) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // If user has moved noticeably vertical before horizontal, it's a page scroll
      if (absY > 30 && absY > absX * 1.4) {
        isVerticalScroll = true;
        return;
      }

      const now = Date.now();
      recentSamples.push({ x: touch.clientX, y: touch.clientY, time: now });
      // Retain samples within the last 120ms to measure release velocity & acceleration
      recentSamples = recentSamples.filter((s) => now - s.time <= 120);
    };

    const handleTouchEnd = (e) => {
      if (!isTracking || isVerticalScroll) {
        isTracking = false;
        return;
      }
      isTracking = false;

      // Abort if zoomed in
      if (window.visualViewport && window.visualViewport.scale > 1.05) {
        return;
      }

      if (!e.changedTouches || e.changedTouches.length === 0) return;

      const touch = e.changedTouches[0];
      const now = Date.now();
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const totalElapsedTime = Math.max(1, now - touchStartTime);

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Must be primarily horizontal and within 800ms
      if (absX < 30 || absX < absY * 1.3 || totalElapsedTime > 800) {
        return;
      }

      // Compute release velocity and acceleration using recent samples
      const firstSample = recentSamples[0] || { x: touchStartX, y: touchStartY, time: touchStartTime };
      const sampleDt = Math.max(1, now - firstSample.time);
      const sampleDx = touch.clientX - firstSample.x;
      const releaseVelocityX = sampleDx / sampleDt; // px/ms
      const avgVelocityX = deltaX / totalElapsedTime; // px/ms

      const isDrawerCurrentlyOpen = mobileDrawerOpen || tabletDrawerOpen;

      // ─── Case 1: Drawer is OPEN -> Left swipe closes it ───
      if (isDrawerCurrentlyOpen) {
        // Close on negative velocity flick or sufficient leftward distance
        if (deltaX < -35 && (releaseVelocityX <= -0.25 || deltaX < -70)) {
          setMobileDrawerOpen(false);
          setTabletDrawerOpen(false);
        }
        return;
      }

      // ─── Case 2: Drawer is CLOSED -> Right swipe opens it ───
      // Only active on mobile and tablet viewport tiers (not desktop docked rail)
      if (!isDesktop && deltaX > 0) {
        // True screen edge (<= 28px) or top header bar near hamburger menu button
        const isFromLeftEdge = touchStartX <= 28;
        const isFromHeaderBar = touchStartY <= 64 && touchStartX <= 80;

        if (!isFromLeftEdge && !isFromHeaderBar) {
          return;
        }

        // Kinematic decision: High-velocity flick (acceleration) OR deliberate sustained drag
        const isQuickFlick = deltaX >= 40 && releaseVelocityX >= 0.38;
        const isSustainedDrag = deltaX >= 80 && avgVelocityX >= 0.18;

        if (isQuickFlick || isSustainedDrag) {
          if (isTablet) {
            setTabletDrawerOpen(true);
          } else {
            setMobileDrawerOpen(true);
          }
        }
      }
    };

    const handleTouchCancel = () => {
      isTracking = false;
      isVerticalScroll = false;
      recentSamples = [];
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
  }, [mobileDrawerOpen, tabletDrawerOpen, isDesktop, isTablet]);

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
