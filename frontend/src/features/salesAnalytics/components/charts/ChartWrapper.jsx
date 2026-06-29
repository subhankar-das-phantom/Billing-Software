import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ChartSkeleton } from '../SkeletonCards';
import { EmptyState } from '../EmptyState';

export const ChartWrapper = ({ 
  title, 
  subtitle, 
  isLoading, 
  isError, 
  isEmpty, 
  onRetry, 
  children,
  className = ''
}) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
      }}
      className={`glass-card flex flex-col p-5 relative overflow-hidden ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex-1 min-h-[300px] relative w-full h-full">
        {isLoading ? (
          <ChartSkeleton />
        ) : isError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center border border-red-500/20 bg-red-500/5 rounded-xl">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-red-300 font-medium mb-3 text-sm">Failed to load chart data</p>
            {onRetry && (
              <button onClick={onRetry} className="btn btn-secondary flex items-center gap-2 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState message="No data for this chart" />
          </div>
        ) : (
          <div className="absolute inset-0">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
};
