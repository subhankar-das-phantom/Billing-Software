import { memo } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

export const ThemeToggle = memo(function ThemeToggle({ className = '', showLabel = false }) {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <Motion.div
              key="moon"
              initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="text-amber-300"
            >
              <Moon className="w-5 h-5" />
            </Motion.div>
          ) : (
            <Motion.div
              key="sun"
              initial={{ rotate: 90, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="text-amber-500"
            >
              <Sun className="w-5 h-5" />
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {showLabel && (
        <span className="ml-2 text-xs font-medium text-slate-300">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  );
});

export default ThemeToggle;
