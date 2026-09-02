import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Employees Page Skeleton
   1. Header (title + "Add Employee" button)
   2. Stats row (3-col)
   3. Filter bar (search + status select)
   4. Employee card grid (1/2/3-col)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const HeaderSkeleton = () => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <ShimmerBone className="h-7 w-52 mb-2" />
      <ShimmerBone className="h-4 w-72" />
    </div>
    <ShimmerBone className="h-10 w-36 rounded-xl" />
  </div>
);

const StatCardSkeleton = () => (
  <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
    <div className="flex items-center justify-between">
      <div>
        <ShimmerBone className="h-3.5 w-24 mb-2" />
        <ShimmerBone className="h-7 w-16" />
      </div>
      <ShimmerBone className="w-12 h-12 rounded-xl" />
    </div>
  </div>
);

const FilterBarSkeleton = () => (
  <div className="flex flex-col sm:flex-row gap-4">
    <ShimmerBone className="h-10 flex-1 rounded-xl" />
    <ShimmerBone className="h-10 w-36 rounded-xl" />
  </div>
);

/* Employee Card: avatar + name/email + status + 4 metrics + 4 action buttons */
const EmployeeCardSkeleton = () => (
  <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
    {/* Header: avatar + name + status */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <ShimmerBone className="w-12 h-12 rounded-full shrink-0" />
        <div>
          <ShimmerBone className="h-5 w-28 mb-2" />
          <ShimmerBone className="h-3.5 w-36" />
        </div>
      </div>
      <ShimmerBone className="h-6 w-16 rounded-full" />
    </div>

    {/* Metrics grid */}
    <div className="grid grid-cols-2 gap-3 mb-4">
      {['Invoices', 'Sales', 'Payments', 'Last Active'].map(label => (
        <div key={label} className="bg-slate-900/50 rounded-lg p-3">
          <ShimmerBone className="h-2.5 w-14 mb-2" />
          <ShimmerBone className="h-5 w-16" />
        </div>
      ))}
    </div>

    {/* Action buttons */}
    <div className="flex items-center gap-2 pt-3 border-t border-slate-700">
      <ShimmerBone className="flex-1 h-9 rounded-lg" />
      <ShimmerBone className="flex-1 h-9 rounded-lg" />
      <ShimmerBone className="flex-1 h-9 rounded-lg" />
      <ShimmerBone className="flex-1 h-9 rounded-lg" />
    </div>
  </div>
);

export const EmployeesPageSkeleton = () => (
  <div className="space-y-6">
    <HeaderSkeleton />

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>

    <FilterBarSkeleton />

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <EmployeeCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Employee Analytics Page Skeleton
   1. Header (icon + title + buttons)
   2. Overview stats (6-col on lg, 4 on md, 2 on mobile)
   3. Session Activity panel (4 metric boxes)
   4. Leaderboards (3-col)
   5. Performance Comparison (rows with progress bars)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const AnalyticsHeaderSkeleton = () => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
    <div>
      <div className="flex items-center gap-3 mb-2">
        <ShimmerBone className="w-8 h-8 rounded-lg" />
        <ShimmerBone className="h-8 w-48" />
      </div>
      <ShimmerBone className="h-4 w-64" />
    </div>
    <div className="flex items-center gap-3">
      <ShimmerBone className="h-10 w-40 rounded-xl" />
      <ShimmerBone className="w-10 h-10 rounded-xl" />
    </div>
  </div>
);

const AnalyticsStatSkeleton = () => (
  <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
    <div className="flex items-start justify-between">
      <div>
        <ShimmerBone className="h-3.5 w-20 mb-2" />
        <ShimmerBone className="h-7 w-14 mb-1" />
        <ShimmerBone className="h-3 w-16" />
      </div>
      <ShimmerBone className="w-11 h-11 rounded-xl" />
    </div>
  </div>
);

const SessionPanelSkeleton = () => (
  <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 mb-8">
    <div className="flex items-center gap-2 mb-4">
      <ShimmerBone className="w-5 h-5 rounded" />
      <ShimmerBone className="h-5 w-32" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="text-center p-4 bg-slate-900/50 rounded-xl">
          <ShimmerBone className="h-8 w-12 mx-auto mb-2" />
          <ShimmerBone className="h-3.5 w-20 mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

const LeaderboardSkeleton = () => (
  <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
    <div className="flex items-center gap-2 mb-4">
      <ShimmerBone className="w-5 h-5 rounded" />
      <ShimmerBone className="h-5 w-36" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <ShimmerBone className="w-6 h-6 rounded-full" />
          <ShimmerBone className="h-4 flex-1" />
          <ShimmerBone className="h-4 w-16" />
        </div>
      ))}
    </div>
  </div>
);

const ComparisonRowSkeleton = () => (
  <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
    <div className="flex flex-col md:flex-row md:items-center gap-4">
      {/* Avatar + name */}
      <div className="flex items-center gap-3 md:w-48">
        <ShimmerBone className="w-10 h-10 rounded-full shrink-0" />
        <div className="min-w-0">
          <ShimmerBone className="h-4 w-24 mb-1" />
          <ShimmerBone className="h-3 w-16" />
        </div>
      </div>
      {/* Progress bar */}
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <ShimmerBone className="h-3 w-24" />
          <ShimmerBone className="h-3.5 w-20" />
        </div>
        <ShimmerBone className="h-2 w-full rounded-full" />
      </div>
      {/* 3-col metrics */}
      <div className="grid grid-cols-3 gap-4 md:w-72 text-center">
        {[1, 2, 3].map(i => (
          <div key={i}>
            <ShimmerBone className="h-3 w-12 mx-auto mb-1" />
            <ShimmerBone className="h-4 w-8 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const EmployeeAnalyticsPageSkeleton = () => (
  <div className="px-3.5 py-4 sm:px-6 sm:py-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
    <AnalyticsHeaderSkeleton />

    {/* Overview stats */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 md:gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <AnalyticsStatSkeleton key={i} />
      ))}
    </div>

    <SessionPanelSkeleton />

    {/* Leaderboards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
      <LeaderboardSkeleton />
      <LeaderboardSkeleton />
      <LeaderboardSkeleton />
    </div>

    {/* Performance Comparison */}
    <div className="bg-slate-800/50 rounded-xl p-4 sm:p-5 md:p-6 border border-slate-700/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <ShimmerBone className="w-5 h-5 rounded" />
          <ShimmerBone className="h-5 w-44" />
        </div>
        <ShimmerBone className="h-8 w-32 rounded-lg" />
      </div>
      <div className="space-y-2.5 sm:space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ComparisonRowSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
);

export default EmployeesPageSkeleton;
