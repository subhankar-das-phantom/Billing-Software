import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

const THEME_STORAGE_KEY = 'bharat-enterprise-theme';

const ThemeContext = createContext({
  theme: 'dark',
  themeMode: 'dark',
  setThemeMode: () => {},
  toggleTheme: () => {},
  isDark: true,
  chartColors: {
    gridStroke: '#334155',
    axisStroke: '#94a3b8',
    tooltipBg: '#1e293b',
    tooltipBorder: '#334155',
    tooltipText: '#f8fafc',
    cursorFill: '#1e293b'
  }
});

export function ThemeProvider({ children }) {
  // Theme mode: 'dark' | 'light' | 'system' (defaults to 'dark' per platform architecture)
  const [themeMode, setThemeModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // localStorage unavailable or security blocked
    }
    return 'dark';
  });

  // Track system preference for 'system' mode
  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Listen to OS system color scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Compute active effective theme: 'dark' or 'light'
  const theme = useMemo(() => {
    if (themeMode === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemIsDark]);

  const isDark = theme === 'dark';

  // Apply class to document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [theme]);

  // Persist preference to localStorage
  const setThemeMode = useCallback((mode) => {
    if (mode !== 'dark' && mode !== 'light' && mode !== 'system') return;
    setThemeModeState(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.error('[ThemeContext] Failed to persist theme', err);
    }
  }, []);

  // Quick 2-state toggle (Dark <-> Light)
  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (err) {
        console.warn('[ThemeContext] toggleTheme storage failed', err);
      }
      return next;
    });
  }, []);

  // Memoized theme-aware chart colors for Recharts & SVG visualizations
  const chartColors = useMemo(() => {
    return isDark
      ? {
          gridStroke: '#334155',
          axisStroke: '#94a3b8',
          tooltipBg: '#1e293b',
          tooltipBorder: '#334155',
          tooltipText: '#f8fafc',
          cursorFill: '#1e293b'
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
