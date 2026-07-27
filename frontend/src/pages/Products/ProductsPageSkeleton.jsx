import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Products Page Skeleton
   Full-page shimmer skeleton mirroring the real ProductsPage layout:
   1. Stats cards  (4-col)
   2. Filter panel (title + search + stock filter buttons)
   3. Desktop table / Mobile cards
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ── Stat Card ─── */
const StatCardSkeleton = () => (
  <div className="glass-card p-6">
    <div className="flex items-center justify-between">
      <div>
        <ShimmerBone className="h-3.5 w-24 mb-3" />
        <ShimmerBone className="h-8 w-14" />
      </div>
      <ShimmerBone className="w-12 h-12 rounded-xl" />
    </div>
  </div>
);

/* ── Filter Panel ─── */
const FilterPanelSkeleton = () => (
  <div className="glass-card p-6">
    {/* Title bar */}
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
      <div className="flex items-center gap-3">
        <ShimmerBone className="w-9 h-9 rounded-lg" />
        <div>
          <ShimmerBone className="h-5 w-28 mb-2" />
          <ShimmerBone className="h-3.5 w-44" />
        </div>
      </div>
      <ShimmerBone className="h-10 w-32 rounded-xl" />
    </div>

    {/* Search + stock filter row */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Search bar + button */}
      <div className="flex gap-2">
        <ShimmerBone className="h-10 flex-1 rounded-lg" />
        <ShimmerBone className="h-10 w-10 rounded-lg" />
      </div>
      {/* Stock filter buttons */}
      <div className="flex gap-2">
        <ShimmerBone className="h-10 flex-1 rounded-lg" />
        <ShimmerBone className="h-10 flex-1 rounded-lg" />
        <ShimmerBone className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  </div>
);

/* ── Desktop Table ───
   7 columns: Product Name | HSN | MRP | Rate | GST | Stock | Actions
   ─────────────────────────────────────────────────────────────────── */
const DesktopTableSkeleton = ({ rows = 8 }) => (
  <div className="glass-card overflow-hidden hidden md:block">
    {/* Header */}
    <div className="grid grid-cols-[minmax(260px,2fr)_120px_180px_120px_100px_150px_130px] items-center px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
      <ShimmerBone className="h-3 w-24" />
      <div className="flex justify-center"><ShimmerBone className="h-3 w-10" /></div>
      <div className="flex justify-end"><ShimmerBone className="h-3 w-10" /></div>
      <div className="flex justify-end"><ShimmerBone className="h-3 w-10" /></div>
      <div className="flex justify-center"><ShimmerBone className="h-3 w-10" /></div>
      <div className="flex justify-center"><ShimmerBone className="h-3 w-12" /></div>
      <div className="flex justify-center"><ShimmerBone className="h-3 w-14" /></div>
    </div>

    {/* Rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="grid grid-cols-[minmax(260px,2fr)_120px_180px_120px_100px_150px_130px] items-center px-4 py-3 border-b border-slate-700/50"
      >
        {/* Product Name + Manufacturer */}
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-8 h-8 rounded-lg shrink-0" />
          <div>
            <ShimmerBone className="h-4 w-36 mb-1.5" />
            <ShimmerBone className="h-2.5 w-24" />
          </div>
        </div>
        {/* HSN */}
        <div className="flex items-center justify-center gap-2">
          <ShimmerBone className="w-4 h-4 rounded" />
          <ShimmerBone className="h-3.5 w-12" />
        </div>
        {/* MRP */}
        <div className="flex justify-end">
          <ShimmerBone className="h-4 w-20" />
        </div>
        {/* Rate */}
        <div className="flex justify-end">
          <ShimmerBone className="h-4 w-16" />
        </div>
        {/* GST */}
        <div className="flex justify-center">
          <ShimmerBone className="h-6 w-12 rounded" />
        </div>
        {/* Stock badge */}
        <div className="flex justify-center">
          <ShimmerBone className="h-6 w-20 rounded-full" />
        </div>
        {/* Actions */}
        <div className="flex justify-center gap-2">
          <ShimmerBone className="w-9 h-9 rounded-lg" />
          <ShimmerBone className="w-9 h-9 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

/* ── Mobile Card ─── */
const MobileCardSkeleton = () => (
  <div className="glass-card p-4 flex flex-col gap-4">
    {/* Header: icon + product name + manufacturer/HSN */}
    <div className="flex justify-between items-start gap-3">
      <div className="flex gap-3 flex-1">
        <ShimmerBone className="w-10 h-10 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <ShimmerBone className="h-5 w-40 mb-2" />
          <div className="flex items-center gap-3">
            <ShimmerBone className="h-3 w-24" />
            <ShimmerBone className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>

    {/* Pricing + Stock grid */}
    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/50 bg-slate-800/30 -mx-4 px-4 pb-1">
      {/* Price Details */}
      <div className="space-y-1.5">
        <ShimmerBone className="h-2.5 w-20" />
        <ShimmerBone className="h-4 w-16 mb-1" />
        <ShimmerBone className="h-3 w-24" />
        <ShimmerBone className="h-5 w-16 rounded mt-1" />
      </div>
      {/* Stock Status */}
      <div className="space-y-1.5 flex flex-col items-end">
        <ShimmerBone className="h-2.5 w-20" />
        <ShimmerBone className="h-7 w-24 rounded-full" />
      </div>
    </div>

    {/* Action buttons row */}
    <div className="flex gap-2 pt-1 border-t border-slate-700/50 mt-1">
      <ShimmerBone className="flex-1 h-10 rounded-lg" />
      <ShimmerBone className="flex-1 h-10 rounded-lg" />
    </div>
  </div>
);

const MobileCardsSkeleton = ({ count = 5 }) => (
  <div className="md:hidden space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <MobileCardSkeleton key={i} />
    ))}
  </div>
);

/* ── Full Page Skeleton ─── */
export const ProductsPageSkeleton = () => (
  <div className="space-y-6">
    {/* Stats Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>

    {/* Filter Panel */}
    <FilterPanelSkeleton />

    {/* Table (desktop) / Cards (mobile) */}
    <DesktopTableSkeleton rows={8} />
    <MobileCardsSkeleton count={5} />
  </div>
);

export default ProductsPageSkeleton;
