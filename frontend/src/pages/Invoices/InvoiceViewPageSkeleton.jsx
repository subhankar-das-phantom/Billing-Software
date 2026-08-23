import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Invoice View / Details Page Skeleton
   Mirrors the structure of InvoiceViewPage:
   1. Action Bar (Back, Print, Download, Status badge, etc.)
   2. Payment Summary Card
   3. Copy Mode Control Card
   4. Invoice Print Preview Area (White paper mockup with table skeleton)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const InvoiceViewPageSkeleton = () => {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl border border-white/5 p-4 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <ShimmerBone className="h-10 w-24 rounded-xl" /> {/* Back button */}
          <ShimmerBone className="h-10 w-20 rounded-xl hidden sm:block" /> {/* Edit button */}
          <ShimmerBone className="h-10 w-32 rounded-xl hidden sm:block" /> {/* Create Return */}
          <ShimmerBone className="h-10 w-36 rounded-xl" /> {/* Record Payment */}
          <ShimmerBone className="h-10 w-20 rounded-xl" /> {/* Print */}
          <ShimmerBone className="h-10 w-28 rounded-xl hidden md:block" /> {/* Single/Double Copy */}
          <ShimmerBone className="h-10 w-28 rounded-xl hidden md:block" /> {/* Download */}
        </div>
        <ShimmerBone className="h-8 w-24 rounded-full ml-auto" /> {/* Status Badge */}
      </div>

      {/* Customise Columns Button */}
      <div>
        <ShimmerBone className="h-10 w-44 rounded-xl" />
      </div>

      {/* Payment Summary Card */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <ShimmerBone className="w-9 h-9 rounded-lg" />
          <ShimmerBone className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-2">
              <ShimmerBone className="h-3 w-20" />
              <ShimmerBone className="h-6 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Copy Mode Control Card */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1.5">
            <ShimmerBone className="h-4 w-28" />
            <ShimmerBone className="h-3 w-72" />
          </div>
          <ShimmerBone className="h-10 w-40 rounded-lg" />
        </div>
      </div>

      {/* Invoice Print Preview Area (Paper mockup) */}
      <div className="flex justify-center">
        <div className="bg-white/90 rounded-xl shadow-2xl p-6 sm:p-10 w-full max-w-[850px] space-y-6">
          {/* Paper Header */}
          <div className="grid grid-cols-2 gap-4 border-b-2 border-slate-300 pb-4">
            <div className="space-y-2">
              <ShimmerBone className="h-6 w-48 !bg-slate-300" />
              <ShimmerBone className="h-3 w-64 !bg-slate-200" />
              <ShimmerBone className="h-3 w-40 !bg-slate-200" />
            </div>
            <div className="flex flex-col items-end space-y-2">
              <ShimmerBone className="h-4 w-36 !bg-slate-300" />
              <ShimmerBone className="h-3 w-48 !bg-slate-200" />
              <ShimmerBone className="h-3 w-32 !bg-slate-200" />
            </div>
          </div>

          {/* Buyer & Invoice Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2">
            <div className="space-y-1.5">
              <ShimmerBone className="h-4 w-32 !bg-slate-300" />
              <ShimmerBone className="h-3 w-44 !bg-slate-200" />
              <ShimmerBone className="h-3 w-36 !bg-slate-200" />
            </div>
            <div className="space-y-1.5 sm:border-l sm:border-slate-300 sm:pl-4">
              <ShimmerBone className="h-3 w-32 !bg-slate-200" />
              <ShimmerBone className="h-3 w-28 !bg-slate-200" />
            </div>
            <div className="space-y-1.5 sm:text-right">
              <ShimmerBone className="h-4 w-36 ml-auto !bg-slate-300" />
              <ShimmerBone className="h-3 w-28 ml-auto !bg-slate-200" />
              <ShimmerBone className="h-3 w-24 ml-auto !bg-slate-200" />
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-200 p-3 flex justify-between">
              <ShimmerBone className="h-3 w-12 !bg-slate-300" />
              <ShimmerBone className="h-3 w-32 !bg-slate-300" />
              <ShimmerBone className="h-3 w-16 !bg-slate-300" />
              <ShimmerBone className="h-3 w-20 !bg-slate-300" />
            </div>
            <div className="divide-y divide-slate-200 p-3 space-y-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="flex justify-between items-center pt-2 first:pt-0">
                  <ShimmerBone className="h-3 w-8 !bg-slate-200" />
                  <ShimmerBone className="h-3 w-48 !bg-slate-200" />
                  <ShimmerBone className="h-3 w-12 !bg-slate-200" />
                  <ShimmerBone className="h-3 w-16 !bg-slate-200" />
                </div>
              ))}
            </div>
          </div>

          {/* Footer Summary */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-slate-300">
            <div className="space-y-2">
              <ShimmerBone className="h-4 w-40 !bg-slate-300" />
              <ShimmerBone className="h-3 w-56 !bg-slate-200" />
            </div>
            <div className="space-y-2 flex flex-col items-end">
              <ShimmerBone className="h-3 w-40 !bg-slate-200" />
              <ShimmerBone className="h-3 w-32 !bg-slate-200" />
              <ShimmerBone className="h-5 w-48 !bg-slate-300 mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceViewPageSkeleton;
