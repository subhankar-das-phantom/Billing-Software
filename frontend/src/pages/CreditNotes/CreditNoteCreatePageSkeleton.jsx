import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Credit Note Create Page Skeleton
   Mirrors the structure of CreditNoteCreatePage:
   1. Header & Back link
   2. Invoice Info Bar
   3. Select Items to Return Table
   4. Credit Note Summary Box
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const CreditNoteCreatePageSkeleton = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Back link + Header */}
      <div className="space-y-4">
        <ShimmerBone className="h-4 w-32" />
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-14 h-14 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <ShimmerBone className="h-7 w-56 rounded-lg" />
            <ShimmerBone className="h-4 w-72" />
          </div>
        </div>
      </div>

      {/* Invoice Info Bar */}
      <div className="glass-card p-4 bg-slate-800/50">
        <div className="flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2">
            <ShimmerBone className="h-4 w-20" />
            <ShimmerBone className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <ShimmerBone className="h-4 w-14" />
            <ShimmerBone className="h-4 w-20" />
          </div>
          <div className="flex items-center gap-2">
            <ShimmerBone className="h-4 w-16" />
            <ShimmerBone className="h-4 w-16" />
          </div>
        </div>
      </div>

      {/* Select Items to Return Table Card */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <ShimmerBone className="w-5 h-5 rounded-full" />
          <ShimmerBone className="h-6 w-48" />
        </div>
        <div className="border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="bg-slate-800/60 p-3 grid grid-cols-6 gap-4 items-center">
            <ShimmerBone className="h-3 w-32 col-span-2" />
            <ShimmerBone className="h-3 w-16 mx-auto" />
            <ShimmerBone className="h-3 w-24 mx-auto" />
            <ShimmerBone className="h-3 w-20 mx-auto" />
            <ShimmerBone className="h-3 w-20 ml-auto" />
          </div>
          <div className="divide-y divide-slate-700/40 p-3 space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="grid grid-cols-6 gap-4 items-center pt-2 first:pt-0">
                <ShimmerBone className="h-4 w-48 col-span-2" />
                <ShimmerBone className="h-4 w-12 mx-auto" />
                <ShimmerBone className="h-4 w-12 mx-auto" />
                <ShimmerBone className="h-8 w-24 rounded-lg mx-auto" />
                <ShimmerBone className="h-4 w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Credit Note Summary Card */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <ShimmerBone className="w-5 h-5 rounded-full" />
          <ShimmerBone className="h-6 w-44" />
        </div>
        <div className="space-y-2">
          <ShimmerBone className="h-4 w-32" />
          <ShimmerBone className="h-10 w-full rounded-xl" />
        </div>
        <div className="bg-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <ShimmerBone className="h-4 w-28" />
            <ShimmerBone className="h-4 w-24" />
          </div>
          <div className="flex justify-between items-center">
            <ShimmerBone className="h-4 w-16" />
            <ShimmerBone className="h-4 w-20" />
          </div>
          <div className="flex justify-between items-center">
            <ShimmerBone className="h-4 w-16" />
            <ShimmerBone className="h-4 w-20" />
          </div>
          <div className="border-t border-slate-700/60 pt-3 flex justify-between items-center">
            <ShimmerBone className="h-6 w-36" />
            <ShimmerBone className="h-7 w-32" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <ShimmerBone className="h-11 w-44 rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export default CreditNoteCreatePageSkeleton;
