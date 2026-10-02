import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ─── Purchases Page Skeleton ──────────────────────────────────────
   Full-page shimmer skeleton mirroring PurchasesPage:
   1. 4 Metric KPI stat cards
   2. Search & filter bar
   3. Purchases table / card list
   ─────────────────────────────────────────────────────────────────── */

export const PurchasesPageSkeleton = () => (
  <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
    {/* 4 Summary Stats Cards - compact 2x2 grid on mobile */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass-card p-3 sm:p-5 lg:p-6 space-y-2 sm:space-y-3">
          <div className="flex justify-between items-start">
            <ShimmerBone className="h-3 sm:h-3.5 w-16 sm:w-24" />
            <ShimmerBone className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl shrink-0" />
          </div>
          <ShimmerBone className="h-6 sm:h-7 w-20 sm:w-32" />
        </div>
      ))}
    </div>

    {/* Header & Filter Card */}
    <div className="glass-card p-3.5 sm:p-6">
      <div className="flex flex-row justify-between items-center mb-3 sm:mb-6 gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-1">
          <ShimmerBone className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg shrink-0" />
          <div className="space-y-1">
            <ShimmerBone className="h-4 sm:h-6 w-24 sm:w-36" />
            <ShimmerBone className="h-3 sm:h-3.5 w-28 sm:w-48" />
          </div>
        </div>
        <ShimmerBone className="h-8 sm:h-10 w-20 sm:w-36 rounded-xl shrink-0" />
      </div>

      {/* Mobile 1-row search & action skeleton */}
      <div className="flex items-center gap-2 sm:hidden">
        <ShimmerBone className="h-9 flex-1 rounded-xl" />
        <ShimmerBone className="h-9 w-9 rounded-xl shrink-0" />
        <ShimmerBone className="h-9 w-9 rounded-xl shrink-0" />
      </div>

      {/* Desktop Search and Filters */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-6">
        <ShimmerBone className="h-10 rounded-lg" />
        <ShimmerBone className="h-10 rounded-lg" />
        <ShimmerBone className="h-10 rounded-lg" />
        <ShimmerBone className="h-10 rounded-lg" />
        <ShimmerBone className="h-10 rounded-lg" />
      </div>
    </div>

    {/* Purchases Table Skeleton */}
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex justify-between">
        <ShimmerBone className="h-4 w-28" />
        <ShimmerBone className="h-4 w-20" />
      </div>
      <div className="divide-y divide-slate-700/40 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <ShimmerBone className="w-8 h-8 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1">
                <ShimmerBone className="h-4 w-40" />
                <ShimmerBone className="h-3 w-28" />
              </div>
            </div>
            <ShimmerBone className="h-4 w-24 hidden md:block" />
            <ShimmerBone className="h-6 w-20 rounded-full" />
            <ShimmerBone className="h-6 w-20 rounded-full" />
            <ShimmerBone className="h-5 w-24 text-right" />
            <ShimmerBone className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default PurchasesPageSkeleton;
