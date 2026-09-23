import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  X,
  ArrowRight,
  Sun,
  Moon,
  ChevronRight,
  Sparkles,
  Layers,
  Receipt,
  Boxes,
  BookOpen,
  GitMerge,
  BarChart3,
  CreditCard,
  HelpCircle,
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { NAV_LINKS, AUTH_ACTIONS } from '../data/navigation';
import { useTrialDaysQuery } from '../../../features/saas/queries/useSubscriptionPlansQuery';

// Icon map for mobile drawer links
const NAV_ICONS = {
  '#product': Layers,
  '#billing': Receipt,
  '#inventory': Boxes,
  '#ledger': BookOpen,
  '#workflows': GitMerge,
  '#analytics': BarChart3,
  '#pricing': CreditCard,
  '#faq': HelpCircle,
};

export default function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const trialDays = useTrialDaysQuery();

  // Handle scroll state for header elevation
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileMenuOpen]);

  // Close mobile menu on Escape key press or window resize >= 1024px (lg)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 1024 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileMenuOpen]);

  // Smooth scroll handler for anchor links that safely unlocks body overflow first
  const handleNavClick = useCallback((e, href) => {
    setMobileMenuOpen(false);
    if (href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.substring(1);

      // Restore body scroll immediately
      document.body.style.overflow = '';

      requestAnimationFrame(() => {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          const navHeight = window.innerWidth >= 640 ? 80 : 64;
          const targetTop =
            targetEl.getBoundingClientRect().top + window.pageYOffset - navHeight;
          window.scrollTo({
            top: targetTop,
            behavior: 'smooth',
          });
          window.history.pushState(null, '', href);
        }
      });
    }
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md transition-all duration-200 ${
        isScrolled || mobileMenuOpen
          ? 'bg-slate-900/95 border-b border-slate-800/80 shadow-xs'
          : 'bg-slate-900/70 border-b border-slate-800/40'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo & Tagline */}
          <Link
            to="/landing"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-600/30 group-hover:bg-blue-500 transition-colors shrink-0">
              B
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-50 group-hover:text-blue-500 transition-colors">
                Bharat
              </span>
              <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase -mt-1">
                Enterprise
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links (Visible on lg+) */}
          <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="px-3.5 py-2 text-sm font-medium text-slate-400 hover:text-slate-50 hover:bg-slate-800/60 rounded-lg transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions & Theme Toggle (Visible on lg+) */}
          <div className="hidden lg:flex items-center space-x-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-850 rounded-lg transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400 transition-transform duration-200 hover:rotate-45" />
              ) : (
                <Moon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-transform duration-200 hover:-rotate-12" />
              )}
            </button>

            <Link
              to={AUTH_ACTIONS.login.href}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-50 hover:bg-slate-850 rounded-lg transition-colors"
            >
              {AUTH_ACTIONS.login.label}
            </Link>
            <Link
              to={AUTH_ACTIONS.register.href}
              className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs hover:shadow-blue-600/25 transition-all duration-150"
            >
              <span>{AUTH_ACTIONS.register.label}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Mobile & Tablet Controls (Visible below lg) */}
          <div className="flex lg:hidden items-center space-x-2">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-850 border border-transparent hover:border-slate-800 transition-colors focus:outline-hidden"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-400 hover:text-slate-200" />
              )}
            </button>

            {/* Hamburger / Close Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl text-slate-200 bg-slate-850 hover:bg-slate-800 border border-slate-800 shadow-2xs transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-100" />
              ) : (
                <Menu className="w-5 h-5 text-slate-100" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation (Full screen overlay with pinned footer) */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-x-0 top-16 sm:top-20 h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] bg-slate-900 border-t border-slate-800 shadow-2xl flex flex-col z-50 transition-colors"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Drawer"
        >
          {/* Scrollable Navigation Links */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-1">
              Platform Sections
            </p>

            <nav className="space-y-1" aria-label="Mobile Navigation Links">
              {NAV_LINKS.map((link) => {
                const IconComponent = NAV_ICONS[link.href] || Layers;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold text-slate-200 hover:text-slate-50 bg-slate-900 hover:bg-slate-850 border border-transparent hover:border-slate-800 active:bg-slate-800 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-slate-850 border border-slate-800 text-blue-400 group-hover:border-slate-700 transition-colors shrink-0">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className="tracking-tight">{link.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Pinned Bottom Actions Bar */}
          <div className="shrink-0 p-4 sm:p-6 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md space-y-3">
            <Link
              to={AUTH_ACTIONS.login.href}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center py-3 px-4 text-sm font-semibold text-slate-200 hover:text-slate-50 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors active:scale-[0.99]"
            >
              {AUTH_ACTIONS.login.label}
            </Link>

            <Link
              to={AUTH_ACTIONS.register.href}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-[0.99]"
            >
              <Sparkles className="w-4 h-4" />
              <span>{AUTH_ACTIONS.register.label}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <p className="text-center text-[11px] text-slate-400">
              {trialDays}-day full access trial • No credit card required
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
