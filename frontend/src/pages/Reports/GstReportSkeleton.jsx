import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ─── GST Report Page Skeleton ──────────────────────────────────────
   Full-page skeleton for GstReportPage, covering:
   1. Header card (icon + title)
   2. Filters panel (date pickers + search + generate button)
   3. Summary cards (4-col grid)
   4. GST Slab table (desktop) / Cards (mobile)
   ─────────────────────────────────────────────────────────────────── */

/* ── Header Skeleton ─── */
const GstHeaderSkeleton = () => (
  <div className="glass-card p-5 sm:p-8 bg-gradient-to-br from-accent2-500/5 via-accent-500/5 to-transparent border-accent2-500/20 relative overflow-hidden">
    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3">
        <ShimmerBone className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl" />
        <div>
          <ShimmerBone className="h-7 w-36 sm:w-44 mb-2" />
          <ShimmerBone className="h-3.5 w-40 sm:w-48" />
        </div>
      </div>
    </div>
  </div>
);

/* ── Filters Panel Skeleton ─── */
const GstFiltersSkeleton = () => (
  <div className="glass-card p-4 sm:p-6">
    {/* Section title */}
    <div className="flex items-center gap-3 mb-4 sm:mb-5">
      <ShimmerBone className="w-9 h-9 rounded-lg" />
      <ShimmerBone className="h-5 w-28" />
    </div>

    {/* Date pickers row */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
      <div>
        <ShimmerBone className="h-3.5 w-16 mb-1.5" />
        <ShimmerBone className="h-10 w-full rounded-lg" />
      </div>
      <div>
        <ShimmerBone className="h-3.5 w-16 mb-1.5" />
        <ShimmerBone className="h-10 w-full rounded-lg" />
      </div>
    </div>

    {/* Product search */}
    <div className="mb-4 sm:mb-5">
      <ShimmerBone className="h-3.5 w-40 mb-1.5" />
      <ShimmerBone className="h-10 w-full rounded-lg" />
    </div>

    {/* Generate button + toggle */}
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <ShimmerBone className="h-11 w-full sm:w-44 rounded-xl" />
      <ShimmerBone className="h-4 w-36" />
    </div>
  </div>
);

/* ── Summary Cards Skeleton ─── */
const GstSummaryCardSkeleton = () => (
  <div className="glass-card p-4 sm:p-6 relative overflow-hidden">
    <div className="flex items-center justify-between mb-2 sm:mb-3">
      <ShimmerBone className="h-3.5 w-20" />
      <ShimmerBone className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg" />
    </div>
    <ShimmerBone className="h-7 sm:h-9 w-32 sm:w-40" />
    <ShimmerBone className="h-3 w-28 mt-1.5" />
  </div>
);

const GstSummaryGridSkeleton = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
    {/* First card spans 2 cols on small */}
    <div className="col-span-2 sm:col-span-1">
      <GstSummaryCardSkeleton />
    </div>
    <GstSummaryCardSkeleton />
    <GstSummaryCardSkeleton />
    <GstSummaryCardSkeleton />
  </div>
);

/* ── GST Slab Table Skeleton (Desktop) ─── */
const GstTableSkeleton = () => (
  <div className="glass-card overflow-hidden">
    {/* Table header bar */}
    <div className="p-4 sm:p-6 border-b border-slate-700/50 bg-slate-800/30 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ShimmerBone className="w-9 h-9 rounded-lg" />
        <ShimmerBone className="h-5 w-40" />
      </div>
      <ShimmerBone className="h-4 w-36 hidden sm:block" />
    </div>

    {/* Desktop Table */}
    <div className="hidden sm:block">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700/30">
            <th className="text-left px-6 py-4">
              <ShimmerBone className="h-3 w-16" />
            </th>
            <th className="text-left px-6 py-4">
              <ShimmerBone className="h-3 w-28" />
            </th>
            <th className="text-right px-6 py-4">
              <ShimmerBone className="h-3 w-20 ml-auto" />
            </th>
            <th className="text-right px-6 py-4">
              <ShimmerBone className="h-3 w-12 ml-auto" />
            </th>
          </tr>
        </thead>
        <tbody>
          {[0, 5, 12, 18, 28].map((slab, idx) => (
            <tr key={slab} className="border-b border-slate-700/20">
              <td className="px-6 py-4">
                <ShimmerBone className="h-8 w-16 rounded-lg" />
              </td>
              <td className="px-6 py-4">
                <ShimmerBone
                  className="h-2.5 rounded-full"
                  style={{ width: `${85 - idx * 15}%` }}
                />
              </td>
              <td className="px-6 py-4 text-right">
                <ShimmerBone className="h-4 w-24 ml-auto" />
              </td>
              <td className="px-6 py-4 text-right">
                <ShimmerBone className="h-4 w-12 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-800/40">
            <td className="px-6 py-4">
              <ShimmerBone className="h-4 w-12" />
            </td>
            <td className="px-6 py-4" />
            <td className="px-6 py-4 text-right">
              <ShimmerBone className="h-5 w-28 ml-auto" />
            </td>
            <td className="px-6 py-4 text-right">
              <ShimmerBone className="h-4 w-10 ml-auto" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    {/* Mobile Cards */}
    <div className="sm:hidden p-3 space-y-3">
      {[0, 1, 2, 3, 4].map(idx => (
        <div
          key={idx}
          className="p-3.5 rounded-xl border border-slate-700/30 bg-slate-800/20"
        >
          <div className="flex items-center justify-between mb-2">
            <ShimmerBone className="h-4 w-16" />
            <ShimmerBone className="h-3.5 w-10" />
          </div>
          <ShimmerBone
            className="h-2 rounded-full mb-2"
            style={{ width: `${90 - idx * 15}%` }}
          />
          <ShimmerBone className="h-5 w-28" />
        </div>
      ))}

      {/* Total card */}
      <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
        <div className="flex items-center justify-between">
          <ShimmerBone className="h-4 w-20" />
          <ShimmerBone className="h-5 w-28" />
        </div>
      </div>
    </div>
  </div>
);

/* ── Full Page Skeleton ─── */
export const GstReportSkeleton = () => (
  <div className="space-y-6 sm:space-y-8">
    <GstHeaderSkeleton />
    <GstFiltersSkeleton />
    <GstSummaryGridSkeleton />
    <GstTableSkeleton />
  </div>
);

export default GstReportSkeleton;
