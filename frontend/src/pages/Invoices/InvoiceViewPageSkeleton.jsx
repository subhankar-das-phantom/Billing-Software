import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/**
 * InvoiceViewPageSkeleton
 * Structurally and dimensionally mirrors the real InvoiceViewPage layout:
 * 1. Enterprise 2-Tier Header Card (Identity, CTAs, Copy Mode capsule, Popovers, Export utilities)
 * 2. Payment Summary Card (4 metrics)
 * 3. 190mm Paper Invoice Preview
 * Eliminates layout shifts (CLS) on load.
 */
export const InvoiceViewPageSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* ─── Enterprise 2-Tier Header Card ─────────────────────────── */}
      <div className="glass-card p-4 sm:p-5 space-y-4 no-print border border-slate-800/80 shadow-xl">
        {/* Tier 1: Identity & Primary CTAs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Back Link & Document Identity */}
          <div className="flex flex-wrap items-center gap-3">
            <ShimmerBone className="h-7 w-20 rounded-xl" /> {/* Invoices back link */}
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <ShimmerBone className="h-7 w-32 rounded-lg" /> {/* Invoice Number */}
            <ShimmerBone className="h-6 w-20 rounded-full" /> {/* Status Badge */}
            <ShimmerBone className="h-6 w-28 rounded-full" /> {/* Payment Due Pill */}
          </div>

          {/* Right: High Prominence Primary CTAs */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <ShimmerBone className="h-8 w-32 rounded-lg" /> {/* Record Payment */}
            <ShimmerBone className="h-8 w-28 rounded-lg" /> {/* Print Invoice */}
          </div>
        </div>

        {/* Tier 2: Print & Export Utility Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-800/80">
          {/* Left: Print Configurations */}
          <div className="flex flex-wrap items-center gap-2.5">
            <ShimmerBone className="h-7 w-36 rounded-xl" /> {/* 1x / 2x Segmented Capsule */}
            <ShimmerBone className="h-7 w-28 rounded-lg" /> {/* Columns button */}
          </div>

          {/* Right: Export Utilities & Manage Dropdown */}
          <div className="flex items-center gap-2">
            <ShimmerBone className="h-7 w-24 rounded-lg" /> {/* Download */}
            <ShimmerBone className="h-7 w-20 rounded-lg" /> {/* Share */}
            <ShimmerBone className="h-7 w-24 rounded-lg" /> {/* Manage */}
          </div>
        </div>
      </div>

      {/* ─── Due Amount Summary Card ───────────────────────────────── */}
      <div className="glass-card p-5 no-print">
        <div className="flex items-center gap-3 mb-4">
          <ShimmerBone className="w-9 h-9 rounded-lg" />
          <ShimmerBone className="h-5 w-40 rounded-md" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-2">
              <ShimmerBone className="h-3 w-20 rounded" />
              <ShimmerBone className="h-6 w-28 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* ─── 190mm Paper Invoice Preview Area ───────────────────────── */}
      <div className="w-full overflow-x-auto pb-4 flex justify-start sm:justify-center">
        <div
          className="bg-white border-2 border-slate-300 shadow-lg p-4 space-y-3 shrink-0 my-0 sm:mx-auto"
          style={{ width: '190mm', minHeight: '130mm' }}
        >
          {/* Header Row */}
          <div className="grid grid-cols-2 gap-2 border-b border-slate-300 pb-2">
            <div className="space-y-1.5">
              <ShimmerBone className="h-5 w-44 !bg-slate-300 rounded" />
              <ShimmerBone className="h-3 w-60 !bg-slate-200 rounded" />
              <ShimmerBone className="h-3 w-36 !bg-slate-200 rounded" />
            </div>
            <div className="flex justify-end gap-2">
              <div className="space-y-1 text-right">
                <ShimmerBone className="h-3 w-32 ml-auto !bg-slate-200 rounded" />
                <ShimmerBone className="h-3 w-28 ml-auto !bg-slate-200 rounded" />
                <ShimmerBone className="h-3 w-36 ml-auto !bg-slate-200 rounded" />
              </div>
            </div>
          </div>

          {/* Buyer & Invoice Details (3 cols) */}
          <div className="grid grid-cols-3 gap-2 pb-1">
            <div className="space-y-1">
              <ShimmerBone className="h-3.5 w-32 !bg-slate-300 rounded" />
              <ShimmerBone className="h-2.5 w-40 !bg-slate-200 rounded" />
              <ShimmerBone className="h-2.5 w-24 !bg-slate-200 rounded" />
            </div>
            <div className="border-l border-slate-200 pl-2 space-y-1">
              <ShimmerBone className="h-2.5 w-28 !bg-slate-200 rounded" />
              <ShimmerBone className="h-2.5 w-24 !bg-slate-200 rounded" />
            </div>
            <div className="text-right space-y-1">
              <ShimmerBone className="h-3.5 w-32 ml-auto !bg-slate-300 rounded" />
              <ShimmerBone className="h-2.5 w-24 ml-auto !bg-slate-200 rounded" />
              <ShimmerBone className="h-2.5 w-20 ml-auto !bg-slate-200 rounded" />
            </div>
          </div>

          {/* Products Table Mockup */}
          <div className="border border-slate-300 rounded overflow-hidden">
            <div className="bg-slate-100 p-1.5 flex justify-between border-b border-slate-300">
              <ShimmerBone className="h-3 w-8 !bg-slate-300 rounded" />
              <ShimmerBone className="h-3 w-36 !bg-slate-300 rounded" />
              <ShimmerBone className="h-3 w-14 !bg-slate-300 rounded" />
              <ShimmerBone className="h-3 w-12 !bg-slate-300 rounded" />
              <ShimmerBone className="h-3 w-16 !bg-slate-300 rounded" />
              <ShimmerBone className="h-3 w-20 !bg-slate-300 rounded" />
            </div>
            <div className="divide-y divide-slate-200 p-1.5 space-y-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="flex justify-between items-center pt-1.5 first:pt-0">
                  <ShimmerBone className="h-2.5 w-6 !bg-slate-200 rounded" />
                  <ShimmerBone className="h-2.5 w-44 !bg-slate-200 rounded" />
                  <ShimmerBone className="h-2.5 w-12 !bg-slate-200 rounded" />
                  <ShimmerBone className="h-2.5 w-10 !bg-slate-200 rounded" />
                  <ShimmerBone className="h-2.5 w-14 !bg-slate-200 rounded" />
                  <ShimmerBone className="h-2.5 w-16 !bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Footer Grid */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-300">
            <div className="space-y-1.5">
              <ShimmerBone className="h-3 w-28 !bg-slate-300 rounded" />
              <ShimmerBone className="h-2.5 w-48 !bg-slate-200 rounded" />
            </div>
            <div className="space-y-1 text-right">
              <ShimmerBone className="h-2.5 w-32 ml-auto !bg-slate-200 rounded" />
              <ShimmerBone className="h-2.5 w-28 ml-auto !bg-slate-200 rounded" />
              <ShimmerBone className="h-4 w-40 ml-auto !bg-slate-300 rounded mt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceViewPageSkeleton;
