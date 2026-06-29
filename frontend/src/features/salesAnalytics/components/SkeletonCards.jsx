import React from 'react';

export const KPICardSkeleton = () => (
  <div className="glass-card p-6 animate-pulse">
    <div className="flex justify-between items-center mb-4">
      <div className="h-4 bg-slate-700/50 rounded w-24"></div>
      <div className="w-8 h-8 bg-slate-700/50 rounded-lg"></div>
    </div>
    <div className="h-8 bg-slate-700/50 rounded w-32 mb-2"></div>
    <div className="h-3 bg-slate-700/50 rounded w-40 mt-3"></div>
  </div>
);

export const ChartSkeleton = () => (
  <div className="w-full h-full min-h-[300px] flex items-center justify-center animate-pulse bg-slate-800/20 rounded-xl">
    <div className="w-full h-full flex items-end gap-2 p-4">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="flex-1 bg-slate-700/30 rounded-t-sm" style={{ height: `${Math.max(20, Math.random() * 100)}%` }}></div>
      ))}
    </div>
  </div>
);
