import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ─── Purchases Page Skeleton ──────────────────────────────────────
   Full-page shimmer skeleton mirroring PurchasesPage:
   1. 4 Metric KPI stat cards
   2. Search & filter bar
   3. Purchases table / card list
   ─────────────────────────────────────────────────────────────────── */

export const PurchasesPageSkeleton = () => (
  <div className="p-6 max-w-7xl mx-auto space-y-6">
    {/* 4 Summary Stats Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass-card p-5 space-y-3">
          <div className="flex justify-between items-start">
            <ShimmerBone className="h-3.5 w-24" />
            <ShimmerBone className="w-10 h-10 rounded-xl" />
          </div>
          <ShimmerBone className="h-7 w-32" />
        </div>
      ))}
    </div>

    {/* Header & Filter Card */}
    <div className="glass-card p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <ShimmerBone className="h-6 w-36" />
            <ShimmerBone className="h-3.5 w-48" />
          </div>
        </div>
        <div className="flex gap-2">
          <ShimmerBone className="h-10 w-24 rounded-lg" />
          <ShimmerBone className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <ShimmerBone className="h-10 lg:col-span-2 rounded-lg" />
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
