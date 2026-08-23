import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Credit Note View Page Skeleton
   Mirrors the structure of CreditNoteViewPage:
   1. Actions Bar
   2. 3 Summary Cards (Credit Note Info, Customer, Credit Amount)
   3. Returned Items Table
   4. Print Preview Paper Area
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const CreditNoteViewPageSkeleton = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl border border-white/5 p-4 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <ShimmerBone className="h-10 w-36 rounded-xl" /> {/* Back to Invoice */}
          <ShimmerBone className="h-10 w-24 rounded-xl" /> {/* Print */}
          <ShimmerBone className="h-10 w-32 rounded-xl hidden sm:block" /> {/* Download */}
        </div>
        <ShimmerBone className="h-8 w-28 rounded-full ml-auto" /> {/* Badge */}
      </div>

      {/* 3 Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <ShimmerBone className="w-10 h-10 rounded-lg flex-shrink-0" />
              <div className="space-y-1">
                <ShimmerBone className="h-3 w-20" />
                <ShimmerBone className="h-5 w-32" />
              </div>
            </div>
            <div className="space-y-1.5 pt-1 border-t border-slate-700/50">
              <div className="flex justify-between">
                <ShimmerBone className="h-3 w-24" />
                <ShimmerBone className="h-3 w-20" />
              </div>
              <div className="flex justify-between">
                <ShimmerBone className="h-3 w-16" />
                <ShimmerBone className="h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Returned Items Table Card */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <ShimmerBone className="w-5 h-5 rounded-full" />
          <ShimmerBone className="h-6 w-36" />
        </div>
        <div className="border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="bg-slate-800/60 p-3 grid grid-cols-5 gap-4">
            <ShimmerBone className="h-3 w-12" />
            <ShimmerBone className="h-3 w-40 col-span-2" />
            <ShimmerBone className="h-3 w-16" />
            <ShimmerBone className="h-3 w-20 ml-auto" />
          </div>
          <div className="divide-y divide-slate-700/40 p-3 space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="grid grid-cols-5 gap-4 items-center pt-2 first:pt-0">
                <ShimmerBone className="h-3 w-6" />
                <ShimmerBone className="h-4 w-48 col-span-2" />
                <ShimmerBone className="h-3 w-12" />
                <ShimmerBone className="h-4 w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Print Preview Paper Mockup Area */}
      <div className="flex justify-center pt-4">
        <div className="bg-white/90 rounded-xl shadow-2xl p-6 sm:p-10 w-full max-w-[750px] space-y-6">
          <div className="grid grid-cols-2 gap-4 border-b-2 border-slate-300 pb-4">
            <div className="space-y-2">
              <ShimmerBone className="h-5 w-48 !bg-slate-300" />
              <ShimmerBone className="h-3 w-56 !bg-slate-200" />
            </div>
            <div className="flex flex-col items-end space-y-2">
              <ShimmerBone className="h-4 w-32 !bg-slate-300" />
              <ShimmerBone className="h-3 w-28 !bg-slate-200" />
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <ShimmerBone key={i} className="h-8 w-full !bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditNoteViewPageSkeleton;
