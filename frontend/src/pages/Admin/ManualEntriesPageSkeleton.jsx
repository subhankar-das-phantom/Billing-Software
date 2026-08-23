import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Manual Entries Page Skeleton
   Mirrors the structure of ManualEntriesPage:
   1. Header & Action Buttons
   2. Search & Filters Card
   3. Entries Table Card
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const ManualEntriesPageSkeleton = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="space-y-1.5">
            <ShimmerBone className="h-7 w-48 rounded-lg" />
            <ShimmerBone className="h-4 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShimmerBone className="h-10 w-10 rounded-lg" />
          <ShimmerBone className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Search & Filters Card */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <ShimmerBone className="h-11 flex-1 rounded-lg" />
          <ShimmerBone className="h-11 w-28 rounded-lg" />
        </div>
      </div>

      {/* Entries Table Card */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-slate-700/60 bg-slate-800/40 p-4 grid grid-cols-7 gap-4 items-center">
          <ShimmerBone className="h-4 w-20" />
          <ShimmerBone className="h-4 w-32 col-span-2" />
          <ShimmerBone className="h-4 w-20" />
          <ShimmerBone className="h-4 w-24" />
          <ShimmerBone className="h-4 w-28" />
          <ShimmerBone className="h-4 w-12 ml-auto" />
        </div>
        <div className="divide-y divide-slate-700/40 p-4 space-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <div key={row} className="grid grid-cols-7 gap-4 items-center pt-3 first:pt-0">
              <div className="flex items-center gap-2">
                <ShimmerBone className="w-4 h-4 rounded-full flex-shrink-0" />
                <ShimmerBone className="h-4 w-20" />
              </div>
              <ShimmerBone className="h-4 w-40 col-span-2" />
              <ShimmerBone className="h-6 w-24 rounded-full" />
              <ShimmerBone className="h-4 w-16" />
              <ShimmerBone className="h-4 w-20" />
              <ShimmerBone className="h-8 w-8 rounded-lg ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManualEntriesPageSkeleton;
