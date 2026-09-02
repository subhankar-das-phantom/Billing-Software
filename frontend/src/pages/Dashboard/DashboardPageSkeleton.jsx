import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Enhanced Bento-Grid Dashboard Skeleton
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const HeroSkeleton = () => (
  <div className="glass-card p-6 md:p-8 bg-slate-900/80 border border-slate-700/60 rounded-2xl relative overflow-hidden">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShimmerBone className="h-5 w-24 rounded-full" />
          <ShimmerBone className="h-5 w-36 rounded-full" />
        </div>
        <ShimmerBone className="h-9 w-64 rounded-lg" />
        <ShimmerBone className="h-4 w-96 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <ShimmerBone className="h-10 w-64 rounded-xl" />
        <ShimmerBone className="h-10 w-36 rounded-xl" />
      </div>
    </div>
  </div>
);

const KPIGridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="glass-card p-5 bg-slate-900/80 border border-slate-700/60 rounded-2xl space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <ShimmerBone className="h-3 w-20" />
            <ShimmerBone className="h-7 w-28" />
          </div>
          <ShimmerBone className="w-10 h-10 rounded-xl" />
        </div>
        <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
          <ShimmerBone className="h-3 w-16" />
          <ShimmerBone className="h-4 w-20 rounded-md" />
        </div>
      </div>
    ))}
  </div>
);

const ChartsSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 glass-card p-6 bg-slate-900/80 border border-slate-700/60 rounded-2xl space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-9 h-9 rounded-xl" />
          <div>
            <ShimmerBone className="h-4 w-44 mb-1" />
            <ShimmerBone className="h-3 w-60" />
          </div>
        </div>
        <ShimmerBone className="h-8 w-28 rounded-lg" />
      </div>
      <ShimmerBone className="h-[280px] w-full rounded-xl" />
    </div>

    <div className="glass-card p-6 bg-slate-900/80 border border-slate-700/60 rounded-2xl space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <ShimmerBone className="w-9 h-9 rounded-xl" />
        <div>
          <ShimmerBone className="h-4 w-32 mb-1" />
          <ShimmerBone className="h-3 w-40" />
        </div>
      </div>
      <div className="flex items-center justify-center h-[200px]">
        <ShimmerBone className="w-36 h-36 rounded-full" />
      </div>
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <ShimmerBone className="h-3 w-full" />
        <ShimmerBone className="h-3 w-full" />
      </div>
    </div>
  </div>
);

const FeedsSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 glass-card p-6 bg-slate-900/80 border border-slate-700/60 rounded-2xl space-y-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <ShimmerBone className="h-8 w-60 rounded-xl" />
        <ShimmerBone className="h-4 w-16" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3.5 rounded-xl bg-slate-800/40 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <ShimmerBone className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <ShimmerBone className="h-4 w-28" />
                <ShimmerBone className="h-3 w-36" />
              </div>
            </div>
            <div className="space-y-1.5 text-right">
              <ShimmerBone className="h-4 w-20 ml-auto" />
              <ShimmerBone className="h-3 w-14 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-6">
      <div className="glass-card p-5 bg-slate-900/80 border border-slate-700/60 rounded-2xl space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <ShimmerBone className="h-4 w-32" />
          <ShimmerBone className="h-3 w-16" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-800/40 space-y-2">
            <div className="flex justify-between items-center">
              <ShimmerBone className="h-3.5 w-24" />
              <ShimmerBone className="h-5 w-16 rounded" />
            </div>
            <ShimmerBone className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const QuickActionsSkeleton = () => (
  <div className="glass-card p-6 bg-slate-900/80 border border-slate-700/60 rounded-2xl space-y-4">
    <div className="flex items-center gap-3 mb-2">
      <ShimmerBone className="w-8 h-8 rounded-xl" />
      <div>
        <ShimmerBone className="h-4 w-32 mb-1" />
        <ShimmerBone className="h-3 w-48" />
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="p-4 rounded-xl bg-slate-800/40 space-y-3">
          <ShimmerBone className="w-9 h-9 rounded-xl" />
          <ShimmerBone className="h-4 w-20" />
          <ShimmerBone className="h-3 w-28" />
        </div>
      ))}
    </div>
  </div>
);

export const DashboardPageSkeleton = () => (
  <div className="space-y-6 sm:space-y-8 pb-10">
    <HeroSkeleton />
    <KPIGridSkeleton />
    <ChartsSkeleton />
    <FeedsSkeleton />
    <QuickActionsSkeleton />
  </div>
);

export default DashboardPageSkeleton;
