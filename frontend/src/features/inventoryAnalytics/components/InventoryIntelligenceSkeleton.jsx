import React from 'react';
import { ShimmerBone } from '../../salesAnalytics/components/SkeletonCards';

export const InventoryIntelligenceSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* ─── Top Executive Controls & Summary Skeleton ─── */}
      <div className="glass-card p-5 border border-slate-800/80 bg-slate-900/60">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <ShimmerBone className="w-10 h-10 rounded-lg" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShimmerBone className="h-5 w-44 rounded" />
                <ShimmerBone className="h-4 w-20 rounded" />
              </div>
              <ShimmerBone className="h-3 w-64 rounded" />
            </div>
          </div>

          {/* Date Filter & Action Skeletons */}
          <div className="flex flex-wrap items-center gap-2">
            <ShimmerBone className="h-9 w-64 rounded-lg" />
            <ShimmerBone className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        {/* 4 Top KPI Skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <ShimmerBone className="h-3 w-20 rounded" />
                <ShimmerBone className="w-4 h-4 rounded" />
              </div>
              <ShimmerBone className="h-7 w-28 rounded mb-1.5" />
              <ShimmerBone className="h-2.5 w-36 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Sub-Tab Switcher Skeleton ─── */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/80 border border-slate-800 rounded-xl">
        {[1, 2, 3, 4].map(i => (
          <ShimmerBone key={i} className="h-9 w-36 rounded-lg" />
        ))}
      </div>

      {/* ─── 3 Metric Cards Skeleton ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between mb-2">
              <ShimmerBone className="h-3.5 w-24 rounded" />
              <ShimmerBone className="w-7 h-7 rounded-full" />
            </div>
            <ShimmerBone className="h-8 w-20 rounded mb-1" />
            <ShimmerBone className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* ─── Table Skeleton ─── */}
      <div className="glass-card overflow-hidden border border-slate-800/80 bg-slate-900/60">
        <div className="p-3.5 bg-slate-950/40 border-b border-slate-800 flex justify-between items-center">
          <ShimmerBone className="h-4 w-48 rounded" />
          <ShimmerBone className="h-8 w-60 rounded-lg" />
        </div>

        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/40">
              <div className="flex items-center gap-3">
                <ShimmerBone className="w-8 h-8 rounded-lg" />
                <div className="space-y-1">
                  <ShimmerBone className="h-3.5 w-36 rounded" />
                  <ShimmerBone className="h-2.5 w-24 rounded" />
                </div>
              </div>
              <ShimmerBone className="h-3.5 w-20 rounded" />
              <ShimmerBone className="h-3.5 w-28 rounded" />
              <ShimmerBone className="h-4 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InventoryIntelligenceSkeleton;
