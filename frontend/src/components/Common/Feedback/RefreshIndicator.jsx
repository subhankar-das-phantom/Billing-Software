import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

/**
 * Subtle refresh indicator that shows when data is being updated in the background.
 * Non-intrusive - appears as a small animated icon.
 */
export default function RefreshIndicator({ 
  isRefreshing, 
  className = '',
  size = 'sm',
  showText = false 
}) {
  const sizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5'
  };

  return (
    <AnimatePresence>
      {isRefreshing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className={`inline-flex items-center gap-1.5 text-slate-400 ${className}`}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw className={sizes[size] || sizes.sm} />
          </motion.div>
          {showText && (
            <span className="text-xs font-medium">Refreshing...</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Inline refresh indicator - a subtle pulsing dot
 */
export function RefreshDot({ isRefreshing, className = '' }) {
  return (
    <AnimatePresence>
      {isRefreshing && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0.5, 1, 0.5],
            scale: 1
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ 
            opacity: { duration: 1.5, repeat: Infinity },
            scale: { duration: 0.2 }
          }}
          className={`w-2 h-2 rounded-full bg-blue-400 ${className}`}
        />
      )}
    </AnimatePresence>
  );
}
