import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Enterprise Collections Page Skeleton
   1. Executive Header (title, subtitle, action buttons)
   2. 4-Col KPI Strip (Total, Cash, Non-Cash, Avg Receipt)
   3. Channel Allocation Strip & Filter Pills
   4. Search & Date Presets Filter Bar
   5. Dense Table (desktop) / Cards (mobile)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const HeaderSkeleton = () => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <div className="flex items-center gap-3">
        <ShimmerBone className="w-10 h-10 rounded-xl" />
        <div>
          <ShimmerBone className="h-6 w-36" />
          <ShimmerBone className="h-3.5 w-60 mt-1.5" />
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
      <ShimmerBone className="h-9 w-28 rounded-xl" />
      <ShimmerBone className="h-9 w-36 rounded-xl" />
      <ShimmerBone className="h-9 w-32 rounded-xl" />
    </div>
  </div>
);

const KPIGridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <ShimmerBone className="h-3.5 w-24" />
          <ShimmerBone className="w-7 h-7 rounded-lg" />
        </div>
        <ShimmerBone className="h-8 w-32" />
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
          <ShimmerBone className="h-3 w-16" />
          <ShimmerBone className="h-3 w-12" />
        </div>
      </div>
    ))}
  </div>
);

const ChannelStripSkeleton = () => (
  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
    <div className="flex items-center justify-between">
      <ShimmerBone className="h-4 w-44" />
      <ShimmerBone className="h-3.5 w-28" />
    </div>
    <ShimmerBone className="h-2.5 w-full rounded-full" />
    <div className="flex items-center gap-2 pt-1 overflow-x-auto">
      {Array.from({ length: 6 }).map((_, i) => (
        <ShimmerBone key={i} className="h-7 w-24 rounded-lg shrink-0" />
      ))}
    </div>
  </div>
);

const FilterBarSkeleton = () => (
  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBone key={i} className="h-8 w-20 rounded-lg shrink-0" />
        ))}
      </div>
      <div className="flex items-center gap-2 flex-1 lg:max-w-md">
        <ShimmerBone className="h-9 w-full rounded-lg" />
      </div>
    </div>
  </div>
);

/* Desktop table */
const DesktopTableSkeleton = ({ rows = 8 }) => (
  <div className="hidden md:block overflow-hidden">
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {['Time & Date', 'Customer', 'Invoice / Allocation', 'Channel', 'UTR / Ref No', 'Amount', 'Recorded By', 'Actions'].map((h) => (
              <th key={h} className="text-slate-400">
                <ShimmerBone className="h-3 w-16 inline-block" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td>
                <div className="space-y-1">
                  <ShimmerBone className="h-3.5 w-16" />
                  <ShimmerBone className="h-2.5 w-20" />
                </div>
              </td>
              <td>
                <div className="space-y-1">
                  <ShimmerBone className="h-4 w-28" />
                  <ShimmerBone className="h-3 w-20" />
                </div>
              </td>
              <td>
                <ShimmerBone className="h-5 w-24 rounded" />
              </td>
              <td>
                <ShimmerBone className="h-6 w-20 rounded-full" />
              </td>
              <td>
                <ShimmerBone className="h-4 w-24" />
              </td>
              <td className="text-right">
                <ShimmerBone className="h-4 w-20 ml-auto" />
              </td>
              <td>
                <ShimmerBone className="h-3.5 w-16" />
              </td>
              <td className="text-right">
                <ShimmerBone className="h-7 w-16 rounded-lg ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* Mobile cards */
const MobileCardsSkeleton = ({ count = 5 }) => (
  <div className="md:hidden p-3 space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <ShimmerBone className="h-4 w-32" />
            <ShimmerBone className="h-3 w-20" />
          </div>
          <ShimmerBone className="h-5 w-24" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <ShimmerBone className="h-5 w-20 rounded-full" />
          <ShimmerBone className="h-7 w-20 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

export const CollectionsTableSkeleton = () => (
  <>
    <DesktopTableSkeleton rows={8} />
    <MobileCardsSkeleton count={5} />
  </>
);

export const CollectionsPageSkeleton = () => (
  <div className="space-y-6">
    <HeaderSkeleton />
    <KPIGridSkeleton />
    <ChannelStripSkeleton />
    <FilterBarSkeleton />
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <ShimmerBone className="h-5 w-36" />
        <ShimmerBone className="h-4 w-24" />
      </div>
      <CollectionsTableSkeleton />
    </div>
  </div>
);

export default CollectionsPageSkeleton;
