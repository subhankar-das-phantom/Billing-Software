import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Customers Page Skeleton
   Full-page shimmer skeleton mirroring the real CustomersPage layout:
   1. Header bar  (search + filter btn + add btn)
   2. Customer card grid (3-col lg / 2-col md / 1-col mobile)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ── Header Bar Skeleton ─── */
const HeaderSkeleton = () => (
  <div className="flex flex-col sm:flex-row gap-4 justify-between mb-2">
    {/* Search form */}
    <div className="flex gap-2 flex-1 max-w-md">
      <ShimmerBone className="h-10 flex-1 rounded-lg" />
      <ShimmerBone className="h-10 w-10 rounded-lg" />
    </div>
    {/* Filter + Add buttons */}
    <div className="flex items-center gap-2">
      <ShimmerBone className="h-10 w-24 rounded-lg" />
      <ShimmerBone className="h-10 w-36 rounded-xl" />
    </div>
  </div>
);

/* ── Customer Card Skeleton ────────────────────────────────────────
   Matches the real CustomerCard layout:
   - Top: avatar + name/phone + edit/delete
   - Middle: address, GSTIN, email lines
   - Bottom: outstanding balance + invoice count/view details
   ─────────────────────────────────────────────────────────────────── */
const CustomerCardSkeleton = () => (
  <div className="glass-card p-5">
    {/* Header: avatar + name + actions */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ShimmerBone className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <ShimmerBone className="h-5 w-36 mb-2" />
          <ShimmerBone className="h-3.5 w-28" />
        </div>
      </div>
      <div className="flex gap-1">
        <ShimmerBone className="w-8 h-8 rounded-lg" />
        <ShimmerBone className="w-8 h-8 rounded-lg" />
      </div>
    </div>

    {/* Info lines: address, GSTIN, email */}
    <div className="space-y-2 mb-4">
      <div className="flex items-start gap-2">
        <ShimmerBone className="w-4 h-4 rounded mt-0.5 shrink-0" />
        <ShimmerBone className="h-3.5 w-full" />
      </div>
      <div className="flex items-center gap-2">
        <ShimmerBone className="w-4 h-4 rounded shrink-0" />
        <ShimmerBone className="h-3.5 w-44" />
      </div>
      <div className="flex items-center gap-2">
        <ShimmerBone className="w-4 h-4 rounded shrink-0" />
        <ShimmerBone className="h-3.5 w-40" />
      </div>
    </div>

    {/* Footer: outstanding + view details */}
    <div className="flex items-center justify-between pt-4 border-t border-slate-700">
      <div className="flex items-center gap-2">
        <ShimmerBone className="w-8 h-8 rounded-lg" />
        <div>
          <ShimmerBone className="h-2.5 w-16 mb-1.5" />
          <ShimmerBone className="h-4 w-20" />
        </div>
      </div>
      <div className="text-right">
        <ShimmerBone className="h-2.5 w-16 mb-2 ml-auto" />
        <ShimmerBone className="h-4 w-24" />
      </div>
    </div>
  </div>
);

/* ── Full Page Skeleton ─── */
export const CustomersPageSkeleton = () => (
  <div className="space-y-12">
    <HeaderSkeleton />

    {/* Customer card grid: 3-col lg, 2-col md, 1-col mobile */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <CustomerCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export default CustomersPageSkeleton;
