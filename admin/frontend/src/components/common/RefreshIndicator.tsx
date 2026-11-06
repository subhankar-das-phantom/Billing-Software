/**
 * Bharat Enterprise Billing System — Platform Control Plane Refresh Indicator
 * Subtle, non-intrusive revalidation indicator showing background data synchronization.
 * Supports spinning icon during sync and emerald pulse dot for live state.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export interface RefreshIndicatorProps {
  isRefreshing?: boolean;
  size?: 'xs' | 'sm' | 'md';
  showText?: boolean;
  className?: string;
  refreshingText?: string;
  liveText?: string;
  showLiveState?: boolean;
}

const SIZES = {
  xs: { icon: 'w-3 h-3', text: 'text-[10px]', dot: 'w-1.5 h-1.5' },
  sm: { icon: 'w-3.5 h-3.5', text: 'text-xs', dot: 'w-2 h-2' },
  md: { icon: 'w-4 h-4', text: 'text-xs', dot: 'w-2.5 h-2.5' },
};

export const RefreshIndicator: React.FC<RefreshIndicatorProps> = ({
  isRefreshing = false,
  size = 'sm',
  showText = false,
  className = '',
  refreshingText = 'Syncing...',
  liveText = 'Live',
  showLiveState = false,
}) => {
  const sizeConfig = SIZES[size] || SIZES.sm;

  return (
    <div
      className={`inline-flex items-center gap-1.5 no-print select-none ${className}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        {isRefreshing ? (
          <motion.div
            key="syncing"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-1.5 text-sky-400"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="flex items-center justify-center shrink-0"
              style={{ willChange: 'transform' }}
            >
              <RefreshCw className={sizeConfig.icon} />
            </motion.div>
            {showText && (
              <span className={`${sizeConfig.text} font-medium tracking-wide font-mono`}>
                {refreshingText}
              </span>
            )}
          </motion.div>
        ) : showLiveState ? (
          <motion.div
            key="live"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-1.5 text-emerald-400"
          >
            <span className="relative flex shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 ${sizeConfig.dot}`} />
              <span className={`relative inline-flex rounded-full bg-emerald-500 ${sizeConfig.dot}`} />
            </span>
            {showText && (
              <span className={`${sizeConfig.text} font-medium tracking-wide text-emerald-400/90 font-mono`}>
                {liveText}
              </span>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export const RefreshDot: React.FC<{ isRefreshing: boolean; className?: string }> = ({
  isRefreshing,
  className = '',
}) => {
  return (
    <AnimatePresence>
      {isRefreshing && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0.4, 1, 0.4],
            scale: 1,
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{
            opacity: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
            scale: { duration: 0.15 },
          }}
          className={`w-2 h-2 rounded-full bg-sky-400 no-print ${className}`}
          style={{ willChange: 'opacity, transform' }}
        />
      )}
    </AnimatePresence>
  );
};

export default RefreshIndicator;
