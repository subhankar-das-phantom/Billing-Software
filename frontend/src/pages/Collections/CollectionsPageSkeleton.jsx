import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Collections Page Skeleton
   1. Header (icon + title + date label)
   2. Stat cards (4-col)
   3. Filter panel
   4. Payment table (desktop) / cards (mobile)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const HeaderSkeleton = () => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <div className="flex items-center gap-3 mb-1">
        <ShimmerBone className="w-10 h-10 rounded-xl" />
        <ShimmerBone className="h-7 w-32" />
      </div>
      <ShimmerBone className="h-3.5 w-56 mt-1 ml-[52px]" />
    </div>
    <div className="flex items-center gap-2">
      <ShimmerBone className="w-4 h-4 rounded" />
      <ShimmerBone className="h-4 w-28" />
    </div>
  </div>
);

const StatCardSkeleton = () => (
  <div className="glass-card p-5">
    <div className="flex items-center justify-between mb-3">
      <ShimmerBone className="w-10 h-10 rounded-xl" />
    </div>
    <ShimmerBone className="h-8 w-28 mb-1" />
    <ShimmerBone className="h-3.5 w-24 mt-1" />
  </div>
);

const FilterPanelSkeleton = () => (
  <div className="glass-card p-4">
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <ShimmerBone className="w-4 h-4 rounded" />
        <ShimmerBone className="h-4 w-12" />
      </div>
      <ShimmerBone className="h-8 w-36 rounded-lg" />
      <ShimmerBone className="h-8 w-32 rounded-lg" />
    </div>
  </div>
);

/* Desktop table: Time | Customer | Invoice | Amount | Method */
const DesktopTableSkeleton = ({ rows = 8 }) => (
  <div className="hidden md:block">
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {['Time', 'Customer', 'Invoice', 'Amount', 'Method'].map(h => (
              <th key={h}><ShimmerBone className="h-3 w-14 inline-block" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td>
                <div className="flex items-center gap-1.5">
                  <ShimmerBone className="w-3.5 h-3.5 rounded" />
                  <ShimmerBone className="h-4 w-16" />
                </div>
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <ShimmerBone className="w-4 h-4 rounded" />
                  <ShimmerBone className="h-4 w-28" />
                </div>
              </td>
              <td>
                <ShimmerBone className="h-4 w-20" />
              </td>
              <td>
                <ShimmerBone className="h-4 w-20" />
              </td>
              <td>
                <ShimmerBone className="h-6 w-24 rounded-full" />
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
      <div key={i} className="bg-slate-800/80 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ShimmerBone className="w-9 h-9 rounded-lg shrink-0" />
            <div className="min-w-0">
              <ShimmerBone className="h-4 w-28 mb-1.5" />
              <ShimmerBone className="h-3 w-16" />
            </div>
          </div>
          <ShimmerBone className="h-5 w-20 shrink-0" />
        </div>
        <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/30 flex items-center justify-between">
          <ShimmerBone className="h-4 w-20" />
          <ShimmerBone className="h-6 w-16 rounded-full" />
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

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>

    <FilterPanelSkeleton />

    <div className="glass-card overflow-hidden">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ShimmerBone className="w-5 h-5 rounded" />
          <ShimmerBone className="h-5 w-32" />
        </div>
      </div>
      <CollectionsTableSkeleton />
    </div>
  </div>
);

export default CollectionsPageSkeleton;
