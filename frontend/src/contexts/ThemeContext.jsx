import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const APP_THEME_STORAGE_KEY = 'bharat-enterprise-theme';
const LANDING_THEME_STORAGE_KEY = 'bharat-enterprise-landing-theme';

const ThemeContext = createContext({
  theme: 'dark',
  themeMode: 'dark',
  setThemeMode: () => {},
  toggleTheme: () => {},
  isDark: true,
  chartColors: {
    gridStroke: '#2a2b32',
    axisStroke: '#71717a',
    tooltipBg: '#121215',
    tooltipBorder: '#2a2b32',
    tooltipText: '#f8fafc',
    cursorFill: '#1c1d22'
  }
});

export function ThemeProvider({ children }) {
  const location = useLocation();

  // Detect public marketing, onboarding, legal, and authentication pages
  const isPublicRoute = useMemo(() => {
    const p = location.pathname;
    return (
      p === '/' ||
      p === '/landing' ||
      p === '/login' ||
      p === '/register' ||
      p === '/privacy-policy' ||
      p === '/terms' ||
      p.startsWith('/forgot-password') ||
      p.startsWith('/reset-password')
    );
  }, [location.pathname]);

  // Main application theme mode: 'dark' | 'light' | 'system' (defaults to 'dark' per platform architecture)
  const [appThemeMode, setAppThemeModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(APP_THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
      const landingSaved = localStorage.getItem(LANDING_THEME_STORAGE_KEY);
      if (landingSaved === 'light' || landingSaved === 'dark' || landingSaved === 'system') {
        return landingSaved;
      }
    } catch {
      // localStorage unavailable or security blocked
    }
    return 'dark';
  });

  // Landing / public theme mode: defaults to system or previously saved preference
  const [landingThemeMode, setLandingThemeModeState] = useState(() => {
    try {
      const landingSaved = localStorage.getItem(LANDING_THEME_STORAGE_KEY);
      if (landingSaved === 'light' || landingSaved === 'dark' || landingSaved === 'system') {
        return landingSaved;
      }
      const appSaved = localStorage.getItem(APP_THEME_STORAGE_KEY);
      if (appSaved === 'light' || appSaved === 'dark' || appSaved === 'system') {
        return appSaved;
      }
    } catch {
      // localStorage unavailable or security blocked
    }
    return 'system';
  });

  // Track OS system preference for 'system' mode
  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Listen to OS system color scheme changes in real-time
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Determine active theme mode based on current route context
  const themeMode = isPublicRoute ? (landingThemeMode || appThemeMode) : appThemeMode;

  // Compute active effective theme: 'dark' or 'light'
  const theme = useMemo(() => {
    if (themeMode === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemIsDark]);

  const isDark = theme === 'dark';

  // Apply class to document.documentElement & synchronize meta theme-color
  useEffect(() => {
    const root = document.documentElement;
    const isLight = theme === 'light';
    if (isLight) {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }

    // Dynamic browser status bar color (Safari / Chrome mobile & desktop PWA)
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isLight ? '#f1f5f9' : '#09090b');
    }
  }, [theme]);

  // Persist preference to localStorage
  const setThemeMode = useCallback(
    (mode) => {
      if (mode !== 'dark' && mode !== 'light' && mode !== 'system') return;
      if (isPublicRoute) {
        setLandingThemeModeState(mode);
        setAppThemeModeState(mode);
        try {
          localStorage.setItem(LANDING_THEME_STORAGE_KEY, mode);
          localStorage.setItem(APP_THEME_STORAGE_KEY, mode);
        } catch (err) {
          console.error('[ThemeContext] Failed to persist public theme', err);
        }
      } else {
        setAppThemeModeState(mode);
        try {
          localStorage.setItem(APP_THEME_STORAGE_KEY, mode);
        } catch (err) {
          console.error('[ThemeContext] Failed to persist app theme', err);
        }
      }
    },
    [isPublicRoute]
  );

  // Quick 2-state toggle (Dark <-> Light), flipping the currently active theme
  const toggleTheme = useCallback(() => {
    if (isPublicRoute) {
      const activeMode = landingThemeMode === 'system' ? (systemIsDark ? 'dark' : 'light') : (landingThemeMode || (systemIsDark ? 'dark' : 'light'));
      const next = activeMode === 'light' ? 'dark' : 'light';
      setLandingThemeModeState(next);
      setAppThemeModeState(next);
      try {
        localStorage.setItem(LANDING_THEME_STORAGE_KEY, next);
        localStorage.setItem(APP_THEME_STORAGE_KEY, next);
      } catch (err) {
        console.warn('[ThemeContext] public toggleTheme storage failed', err);
      }
    } else {
      setAppThemeModeState((prev) => {
        const currentEffective = prev === 'system' ? (systemIsDark ? 'dark' : 'light') : prev;
        const next = currentEffective === 'light' ? 'dark' : 'light';
        try {
          localStorage.setItem(APP_THEME_STORAGE_KEY, next);
        } catch (err) {
          console.warn('[ThemeContext] toggleTheme storage failed', err);
        }
        return next;
      });
    }
  }, [isPublicRoute, landingThemeMode, systemIsDark]);

  // Memoized theme-aware chart colors for Recharts & SVG visualizations
  const chartColors = useMemo(() => {
    return isDark
      ? {
          gridStroke: '#2f303c',
          axisStroke: '#71717a',
          tooltipBg: '#141417',
          tooltipBorder: '#333440',
          tooltipText: '#f4f4f5',
          cursorFill: '#23242c'
        }
      : {
          gridStroke: '#e2e8f0',
          axisStroke: '#64748b',
          tooltipBg: '#ffffff',
          tooltipBorder: '#e2e8f0',
          tooltipText: '#0f172a',
          cursorFill: '#f1f5f9'
        };
  }, [isDark]);

  const value = useMemo(
    () => ({
      theme,
      themeMode,
      setThemeMode,
      toggleTheme,
      isDark,
      chartColors
    }),
    [theme, themeMode, setThemeMode, toggleTheme, isDark, chartColors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
