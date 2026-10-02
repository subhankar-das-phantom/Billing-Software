import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ─── Suppliers Page Skeleton ──────────────────────────────────────
   Full-page shimmer skeleton mirroring SuppliersPage:
   1. 4 Metric KPI stat cards
   2. Search & status filter bar
   3. 3-column supplier card grid
   ─────────────────────────────────────────────────────────────────── */

const SupplierCardSkeleton = () => (
  <div className="glass-card p-5 space-y-4">
    {/* Header: avatar + name + actions */}
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ShimmerBone className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <ShimmerBone className="h-5 w-36" />
          <ShimmerBone className="h-3.5 w-28" />
        </div>
      </div>
      <div className="flex gap-1">
        <ShimmerBone className="w-8 h-8 rounded-lg" />
        <ShimmerBone className="w-8 h-8 rounded-lg" />
      </div>
    </div>

    {/* Info lines: contact, GSTIN, email, address */}
    <div className="space-y-2">
      <ShimmerBone className="h-3.5 w-32" />
      <ShimmerBone className="h-3.5 w-44" />
      <ShimmerBone className="h-3.5 w-40" />
      <ShimmerBone className="h-3.5 w-full" />
    </div>

    {/* Footer: Opening balance + view details */}
    <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
      <div className="flex items-center gap-2">
        <ShimmerBone className="w-7 h-7 rounded-lg" />
        <div className="space-y-1">
          <ShimmerBone className="h-2.5 w-16" />
          <ShimmerBone className="h-4 w-20" />
        </div>
      </div>
      <ShimmerBone className="h-4 w-20" />
    </div>
  </div>
);

export const SuppliersPageSkeleton = () => (
  <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
    {/* 4 Summary Stats Cards - compact 2x2 grid on mobile */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass-card p-3 sm:p-5 lg:p-6 space-y-2 sm:space-y-3">
          <div className="flex justify-between items-start">
            <ShimmerBone className="h-3 sm:h-4 w-16 sm:w-28" />
            <ShimmerBone className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl shrink-0" />
          </div>
          <ShimmerBone className="h-6 sm:h-8 w-20 sm:w-32" />
        </div>
      ))}
    </div>

    {/* Header with Search and Actions */}
    <div className="glass-card p-3.5 sm:p-6">
      <div className="flex flex-row justify-between items-center mb-3 sm:mb-6 gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-1">
          <ShimmerBone className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shrink-0" />
          <div className="space-y-1">
            <ShimmerBone className="h-4 sm:h-5 w-24 sm:w-36" />
            <ShimmerBone className="h-3 sm:h-3.5 w-28 sm:w-48" />
          </div>
        </div>
        <ShimmerBone className="h-8 sm:h-10 w-20 sm:w-36 rounded-xl shrink-0" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <ShimmerBone className="h-9 sm:h-10 sm:col-span-2 rounded-lg" />
        <ShimmerBone className="h-9 sm:h-10 rounded-xl" />
      </div>
    </div>

    {/* 3-column supplier card grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SupplierCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export default SuppliersPageSkeleton;
