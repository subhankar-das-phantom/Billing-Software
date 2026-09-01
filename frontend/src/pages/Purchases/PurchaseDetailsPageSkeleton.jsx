import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

export const PurchaseDetailsPageSkeleton = () => (
  <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
    <ShimmerBone className="h-6 w-36 rounded" />

    {/* Header */}
    <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div className="flex items-center gap-4">
        <ShimmerBone className="w-14 h-14 rounded-2xl shrink-0" />
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <ShimmerBone className="h-8 w-44" />
            <ShimmerBone className="h-6 w-24 rounded-full" />
          </div>
          <ShimmerBone className="h-4 w-36" />
        </div>
      </div>
      <div className="flex gap-2">
        <ShimmerBone className="h-10 w-24 rounded-xl" />
        <ShimmerBone className="h-10 w-44 rounded-xl" />
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Supplier Info */}
        <div className="glass-card p-6 space-y-4">
          <ShimmerBone className="h-5 w-36" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ShimmerBone className="h-10 w-full rounded" />
            <ShimmerBone className="h-10 w-full rounded" />
            <ShimmerBone className="h-10 w-full rounded" />
            <ShimmerBone className="h-10 w-full rounded" />
          </div>
        </div>

        {/* Items Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex justify-between">
            <ShimmerBone className="h-5 w-32" />
          </div>
          <div className="divide-y divide-slate-700/40 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 flex justify-between items-center gap-4">
                <ShimmerBone className="h-4 w-40 flex-1" />
                <ShimmerBone className="h-4 w-12" />
                <ShimmerBone className="h-4 w-16" />
                <ShimmerBone className="h-4 w-20" />
                <ShimmerBone className="h-4 w-24 text-right" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar Payment Summary */}
      <div className="glass-card p-6 space-y-4">
        <ShimmerBone className="h-5 w-36" />
        <div className="space-y-3 pt-2">
          <div className="flex justify-between"><ShimmerBone className="h-4 w-20" /><ShimmerBone className="h-4 w-24" /></div>
          <div className="flex justify-between"><ShimmerBone className="h-4 w-24" /><ShimmerBone className="h-4 w-24" /></div>
          <div className="flex justify-between"><ShimmerBone className="h-4 w-16" /><ShimmerBone className="h-4 w-20" /></div>
          <div className="flex justify-between"><ShimmerBone className="h-4 w-16" /><ShimmerBone className="h-4 w-20" /></div>
          <div className="pt-4 border-t border-slate-700/50 flex justify-between">
            <ShimmerBone className="h-5 w-24" />
            <ShimmerBone className="h-7 w-32" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default PurchaseDetailsPageSkeleton;
