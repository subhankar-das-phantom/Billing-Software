import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

export const SupplierDetailsPageSkeleton = () => (
  <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <ShimmerBone className="h-6 w-36 rounded" />

    {/* Supplier Header Info Card */}
    <div className="glass-card p-6 space-y-6">
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <ShimmerBone className="w-20 h-20 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-4 w-full">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="space-y-2">
              <ShimmerBone className="h-7 w-48" />
              <ShimmerBone className="h-4 w-28" />
            </div>
            <div className="flex gap-2">
              <ShimmerBone className="h-9 w-28 rounded-lg" />
              <ShimmerBone className="h-9 w-20 rounded-lg" />
              <ShimmerBone className="h-9 w-20 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
            <ShimmerBone className="h-4 w-full" />
            <ShimmerBone className="h-4 w-full" />
            <ShimmerBone className="h-4 w-full" />
            <ShimmerBone className="h-4 w-full" />
          </div>
        </div>
      </div>
    </div>

    {/* 4 Stats Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass-card p-5 space-y-3">
          <div className="flex justify-between">
            <ShimmerBone className="h-3.5 w-24" />
            <ShimmerBone className="w-10 h-10 rounded-xl" />
          </div>
          <ShimmerBone className="h-7 w-32" />
        </div>
      ))}
    </div>

    {/* Tabs and Content */}
    <div className="glass-card p-6 space-y-4">
      <div className="flex gap-2 border-b border-slate-700/50 pb-2">
        <ShimmerBone className="h-9 w-32 rounded-t-lg" />
        <ShimmerBone className="h-9 w-36 rounded-t-lg" />
        <ShimmerBone className="h-9 w-32 rounded-t-lg" />
      </div>
      <div className="space-y-3 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3 flex justify-between items-center border-b border-slate-700/40">
            <ShimmerBone className="h-4 w-32" />
            <ShimmerBone className="h-4 w-24" />
            <ShimmerBone className="h-4 w-20" />
            <ShimmerBone className="h-4 w-24" />
            <ShimmerBone className="h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SupplierDetailsPageSkeleton;
