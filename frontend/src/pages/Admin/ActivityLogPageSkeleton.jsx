import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Activity Log Page Skeleton
   Mirrors the structure of ActivityLogPage:
   1. Header (Title, subtitle, Refresh button)
   2. Filters Bar (Time range pills, search input)
   3. Summary Stats Grid (Sessions, Invoices, Payments, Total Sales)
   4. Session Cards List (Avatar, duration badge, timestamps, stat pills)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const SessionCardSkeleton = () => (
  <div className="bg-slate-800/50 rounded-xl border border-slate-700/80 p-4">
    {/* Top row: Employee avatar + name/email + Duration badge */}
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <ShimmerBone className="w-10 h-10 rounded-full shrink-0" />
        <div className="space-y-1.5">
          <ShimmerBone className="h-4 w-28 rounded" />
          <ShimmerBone className="h-3 w-40 rounded" />
        </div>
      </div>
      <ShimmerBone className="h-8 w-24 rounded-lg" />
    </div>

    {/* Time row */}
    <div className="flex items-center gap-4 mb-3 pl-1">
      <ShimmerBone className="h-3.5 w-36 rounded" />
      <ShimmerBone className="h-3.5 w-24 rounded" />
    </div>

    {/* Quick Summary - Stats row */}
    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-700/50">
      <ShimmerBone className="h-6 w-14 rounded-lg" />
      <ShimmerBone className="h-6 w-14 rounded-lg" />
      <ShimmerBone className="h-6 w-14 rounded-lg" />
      <div className="ml-auto flex items-center gap-2">
        <ShimmerBone className="h-6 w-24 rounded-lg" />
        <ShimmerBone className="w-6 h-6 rounded" />
      </div>
    </div>
  </div>
);

export const ActivityLogPageSkeleton = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-11 h-11 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <ShimmerBone className="h-7 w-44 rounded-lg" />
            <ShimmerBone className="h-4 w-60 rounded" />
          </div>
        </div>
        <ShimmerBone className="h-10 w-28 rounded-xl" />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
          <ShimmerBone className="w-5 h-5 rounded shrink-0" />
          <ShimmerBone className="h-10 w-72 rounded-xl" />
        </div>
        <ShimmerBone className="h-10 flex-1 max-w-md rounded-xl" />
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/80">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <ShimmerBone className="h-3 w-16 rounded" />
                <ShimmerBone className="h-6 w-20 rounded" />
              </div>
              <ShimmerBone className="w-6 h-6 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Session Cards List */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <SessionCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
};

export default ActivityLogPageSkeleton;
