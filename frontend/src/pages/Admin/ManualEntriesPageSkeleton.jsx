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
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[880px]">
            {/* Table Header Skeleton */}
            <div className="bg-slate-950/50 dark:bg-slate-950/60 border-b border-slate-800 px-4 py-3.5 flex items-center justify-between gap-4">
              <ShimmerBone className="h-3.5 w-16" />
              <ShimmerBone className="h-3.5 w-24" />
              <ShimmerBone className="h-3.5 w-16" />
              <ShimmerBone className="h-3.5 w-20" />
              <ShimmerBone className="h-3.5 w-20 ml-auto" />
              <ShimmerBone className="h-3.5 w-24" />
              <ShimmerBone className="h-3.5 w-16 ml-auto" />
            </div>
            {/* Table Rows Skeleton */}
            <div className="divide-y divide-slate-800/60">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                <div key={row} className="px-4 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <ShimmerBone className="w-3.5 h-3.5 rounded-sm shrink-0" />
                    <ShimmerBone className="h-3.5 w-16" />
                  </div>
                  <div className="flex items-center gap-2.5 min-w-[180px] shrink-0">
                    <ShimmerBone className="w-7 h-7 rounded-lg shrink-0" />
                    <div className="space-y-1">
                      <ShimmerBone className="h-3.5 w-28" />
                      <ShimmerBone className="h-2.5 w-20" />
                    </div>
                  </div>
                  <ShimmerBone className="h-6 w-24 rounded-lg shrink-0" />
                  <ShimmerBone className="h-5 w-16 rounded-md shrink-0" />
                  <div className="text-right ml-auto shrink-0 space-y-1">
                    <ShimmerBone className="h-4 w-20 ml-auto" />
                    <ShimmerBone className="h-3 w-16 ml-auto" />
                  </div>
                  <ShimmerBone className="h-3.5 w-32 shrink-0" />
                  <ShimmerBone className="w-7 h-7 rounded-lg shrink-0 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualEntriesPageSkeleton;
