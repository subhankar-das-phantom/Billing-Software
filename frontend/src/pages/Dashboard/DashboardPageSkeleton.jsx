import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Dashboard Page Skeleton
   Full-page shimmer skeleton mirroring DashboardPage:
   1. Welcome banner
   2. Stats grid (4-col)
   3. Quick stats row (3-col)
   4. Recent Invoices + Low Stock (2-col)
   5. Quick Actions (4-col)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ── Welcome Banner ─── */
const WelcomeBannerSkeleton = () => (
  <div className="glass-card p-8 bg-gradient-to-br from-blue-500/10 via-accent-500/10 to-transparent border-blue-500/20 relative overflow-hidden">
    <div className="relative z-10 flex items-center justify-between">
      <div>
        <ShimmerBone className="h-8 w-52 mb-3" />
        <ShimmerBone className="h-4 w-80" />
      </div>
      <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
        <ShimmerBone className="w-5 h-5 rounded" />
        <ShimmerBone className="h-4 w-24" />
      </div>
    </div>
  </div>
);

/* ── Stat Card (4 main stats) ─── */
const StatCardSkeleton = () => (
  <div className="glass-card p-6">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <ShimmerBone className="h-3.5 w-24 mb-3" />
        <ShimmerBone className="h-8 w-20" />
      </div>
      <ShimmerBone className="w-12 h-12 rounded-xl" />
    </div>
    {/* Trend indicator */}
    <div className="mt-5 pt-3 border-t border-slate-700/30 flex items-center gap-2">
      <ShimmerBone className="w-3 h-3 rounded" />
      <ShimmerBone className="h-3 w-10" />
      <ShimmerBone className="h-3 w-20" />
    </div>
  </div>
);

/* ── Quick Stat Card (3 secondary stats) ─── */
const QuickStatSkeleton = ({ hasSelect = false }) => (
  <div className="glass-card p-6">
    {hasSelect && (
      <div className="mb-3">
        <ShimmerBone className="h-7 w-20 rounded-lg" />
      </div>
    )}
    <div className="flex items-center gap-5">
      <ShimmerBone className="w-14 h-14 rounded-xl shrink-0" />
      <div>
        <ShimmerBone className="h-8 w-14 mb-2" />
        <ShimmerBone className="h-4 w-28" />
      </div>
    </div>
  </div>
);

/* ── List Panel (Recent Invoices / Low Stock) ─── */
const ListPanelSkeleton = ({ itemCount = 5 }) => (
  <div className="glass-card overflow-hidden">
    {/* Header */}
    <div className="p-6 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/30">
      <div className="flex items-center gap-4">
        <ShimmerBone className="w-9 h-9 rounded-lg" />
        <ShimmerBone className="h-5 w-36" />
      </div>
      <ShimmerBone className="h-4 w-16" />
    </div>

    {/* List items */}
    <div className="p-6 space-y-4">
      {Array.from({ length: itemCount }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-5 rounded-xl bg-slate-800/50 border border-transparent"
        >
          <div className="flex items-center gap-4">
            <ShimmerBone className="w-10 h-10 rounded-lg" />
            <div>
              <ShimmerBone className="h-4 w-24 mb-2" />
              <ShimmerBone className="h-3.5 w-32" />
            </div>
          </div>
          <div className="text-right">
            <ShimmerBone className="h-4 w-20 mb-2 ml-auto" />
            <ShimmerBone className="h-3 w-16 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ── Quick Actions ─── */
const QuickActionsSkeleton = () => (
  <div className="glass-card p-8">
    {/* Title */}
    <div className="flex items-center gap-4 mb-8">
      <ShimmerBone className="w-9 h-9 rounded-lg" />
      <ShimmerBone className="h-5 w-28" />
    </div>

    {/* Action cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="flex flex-col gap-4 items-center justify-center p-8 rounded-xl bg-slate-800/50 border border-slate-700/50"
        >
          <ShimmerBone className="w-14 h-14 rounded-full mb-4" />
          <ShimmerBone className="h-4 w-20" />
        </div>
      ))}
    </div>
  </div>
);

/* ── Full Dashboard Skeleton ─── */
export const DashboardPageSkeleton = () => (
  <div className="space-y-12">
    {/* Welcome Banner */}
    <WelcomeBannerSkeleton />

    {/* Stats Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>

    {/* Quick Stats Row */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <QuickStatSkeleton hasSelect />
      <QuickStatSkeleton />
      <QuickStatSkeleton />
    </div>

    {/* Recent Invoices + Low Stock */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <ListPanelSkeleton itemCount={5} />
      <ListPanelSkeleton itemCount={4} />
    </div>

    {/* Quick Actions */}
    <QuickActionsSkeleton />
  </div>
);

export default DashboardPageSkeleton;
