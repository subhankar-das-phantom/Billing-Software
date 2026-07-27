import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Credits Page Skeleton
   Shimmer skeleton mirroring CreditsPage:
   1. Header (icon + title)
   2. Stat cards (4-col)
   3. Tab bar + tab content skeletons
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ── Header ─── */
const HeaderSkeleton = () => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <ShimmerBone className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl" />
      <div>
        <ShimmerBone className="h-6 sm:h-7 w-40 sm:w-48 mb-2" />
        <ShimmerBone className="h-3.5 w-44 sm:w-52" />
      </div>
    </div>
  </div>
);

/* ── Stat Card ─── */
const StatCardSkeleton = () => (
  <div className="glass-card p-3 sm:p-5 border border-slate-700/50">
    <div className="flex items-center justify-between mb-2 sm:mb-3">
      <ShimmerBone className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg" />
    </div>
    <ShimmerBone className="h-6 sm:h-7 w-24 sm:w-28 mb-1" />
  </div>
);

/* ── Tab Bar ─── */
const TabBarSkeleton = () => (
  <div className="flex border-b border-slate-700">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex-1 px-2 sm:px-4 py-2.5 sm:py-3 flex items-center justify-center gap-1.5 sm:gap-2">
        <ShimmerBone className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded" />
        <ShimmerBone className="h-4 w-16 sm:w-24" />
      </div>
    ))}
  </div>
);

/* ── Outstanding Tab Content ───
   Customer rows: avatar + name/phone + amount + chevron
   ─────────────────────────────────────────────────────────────────── */
export const OutstandingTabSkeleton = ({ rows = 6 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="p-3 sm:p-4 bg-slate-800/50 rounded-xl border border-slate-700/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-4">
            <ShimmerBone className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg shrink-0" />
            <div>
              <ShimmerBone className="h-4 w-28 sm:w-36 mb-2" />
              <ShimmerBone className="h-3 w-20 sm:w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right">
              <ShimmerBone className="h-5 w-20 sm:w-24 mb-1.5 ml-auto" />
              <ShimmerBone className="h-3 w-16 ml-auto" />
            </div>
            <ShimmerBone className="w-4 h-4 sm:w-5 sm:h-5 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/* ── Ageing Tab Content ───
   4 bucket cards + invoice list rows
   ─────────────────────────────────────────────────────────────────── */
export const AgeingTabSkeleton = () => (
  <div className="space-y-4">
    {/* Bucket summary cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="p-4 rounded-xl border border-slate-700/50">
          <ShimmerBone className="h-3.5 w-16 mb-2" />
          <ShimmerBone className="h-6 w-24 mb-1" />
          <ShimmerBone className="h-3 w-16" />
        </div>
      ))}
    </div>

    {/* Invoice list */}
    <div className="mt-6">
      <ShimmerBone className="h-4 w-36 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3 bg-slate-800/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShimmerBone className="w-4 h-4 rounded" />
                <div>
                  <ShimmerBone className="h-4 w-20 inline-block" />
                  <ShimmerBone className="h-4 w-28 inline-block ml-2" />
                </div>
              </div>
              <div className="text-right">
                <ShimmerBone className="h-4 w-20 mb-1 ml-auto" />
                <ShimmerBone className="h-3 w-16 ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Payments Tab Content ───
   Payment rows: icon + customer/details + amount/date
   ─────────────────────────────────────────────────────────────────── */
export const PaymentsTabSkeleton = ({ rows = 6 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="p-3 sm:p-4 bg-slate-800/50 rounded-xl border border-slate-700/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <ShimmerBone className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0" />
            <div className="min-w-0">
              <ShimmerBone className="h-4 w-32 sm:w-40 mb-2" />
              <div className="flex items-center gap-2">
                <ShimmerBone className="h-3 w-16" />
                <ShimmerBone className="h-3 w-12" />
              </div>
            </div>
          </div>
          <div className="text-right">
            <ShimmerBone className="h-5 w-20 sm:w-24 mb-1.5 ml-auto" />
            <ShimmerBone className="h-3 w-20 ml-auto" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/* ── Full Page Skeleton ─── */
export const CreditsPageSkeleton = () => (
  <div className="space-y-6">
    <HeaderSkeleton />

    {/* Stat Cards */}
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>

    {/* Tabs + Content */}
    <div className="glass-card overflow-hidden">
      <TabBarSkeleton />
      <div className="p-3 sm:p-5">
        <OutstandingTabSkeleton />
      </div>
    </div>
  </div>
);

export default CreditsPageSkeleton;
