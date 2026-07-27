import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Invoices Page Skeleton
   Full-page shimmer skeleton that mirrors the real InvoicesPage layout:
   1. Stats cards  (3-col)
   2. Filter panel (title + 5-col filters row)
   3. Desktop table / Mobile cards
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ── Stat Card Skeleton ─────────────────────────────────────────────
   Layout: label (top-left) + big number (bottom-left) + icon (right)
   ─────────────────────────────────────────────────────────────────── */
const StatCardSkeleton = () => (
  <div className="glass-card p-6">
    <div className="flex items-center justify-between">
      <div>
        <ShimmerBone className="h-3.5 w-24 mb-3" />
        <ShimmerBone className="h-8 w-16" />
      </div>
      <ShimmerBone className="w-12 h-12 rounded-xl" />
    </div>
  </div>
);

/* ── Filter Panel Skeleton ──────────────────────────────────────────
   Header: icon-badge + title/subtitle (left) + button (right)
   Filter row: search + status + date from + date to + export (5-col lg)
   ─────────────────────────────────────────────────────────────────── */
const FilterPanelSkeleton = () => (
  <div className="glass-card p-6">
    {/* Title bar */}
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
      <div className="flex items-center gap-3">
        <ShimmerBone className="w-9 h-9 rounded-lg" />
        <div>
          <ShimmerBone className="h-5 w-28 mb-2" />
          <ShimmerBone className="h-3.5 w-48" />
        </div>
      </div>
      <ShimmerBone className="h-10 w-32 rounded-xl" />
    </div>

    {/* Filter inputs row */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
      <ShimmerBone className="h-10 w-full rounded-lg" />
      <ShimmerBone className="h-10 w-full rounded-lg" />
      <ShimmerBone className="h-10 w-full rounded-lg" />
      <ShimmerBone className="h-10 w-full rounded-lg" />
      <ShimmerBone className="h-10 w-full rounded-lg" />
    </div>
  </div>
);

/* ── Desktop Table Skeleton ─────────────────────────────────────────
   9-column grid matching the real table layout:
   Invoice # | Date | Customer | Items | Amount | Payment | Status | Printed | Action
   ─────────────────────────────────────────────────────────────────── */
const DesktopTableSkeleton = ({ rows = 8 }) => (
  <div className="glass-card overflow-hidden hidden md:block">
    {/* Header row */}
    <div className="grid grid-cols-[120px_125px_minmax(210px,1.5fr)_100px_120px_115px_120px_90px_100px] items-center px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
      <ShimmerBone className="h-3 w-16" />
      <ShimmerBone className="h-3 w-10" />
      <ShimmerBone className="h-3 w-16" />
      <ShimmerBone className="h-3 w-10" />
      <ShimmerBone className="h-3 w-14" />
      <ShimmerBone className="h-3 w-14" />
      <ShimmerBone className="h-3 w-12" />
      <div className="flex justify-center">
        <ShimmerBone className="h-3 w-12" />
      </div>
      <ShimmerBone className="h-3 w-12" />
    </div>

    {/* Data rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="grid grid-cols-[120px_125px_minmax(210px,1.5fr)_100px_120px_115px_120px_90px_100px] items-center px-4 py-3 border-b border-slate-700/50"
      >
        {/* Invoice # */}
        <div className="flex items-center gap-2">
          <ShimmerBone className="w-4 h-4 rounded" />
          <ShimmerBone className="h-4 w-16" />
        </div>
        {/* Date */}
        <div className="flex items-center gap-2">
          <ShimmerBone className="w-4 h-4 rounded" />
          <ShimmerBone className="h-3.5 w-20" />
        </div>
        {/* Customer */}
        <div className="flex items-center gap-2">
          <ShimmerBone className="w-8 h-8 rounded-lg" />
          <div>
            <ShimmerBone className="h-3.5 w-28 mb-1.5" />
            <ShimmerBone className="h-2.5 w-20" />
          </div>
        </div>
        {/* Items */}
        <div className="flex items-center gap-2">
          <ShimmerBone className="w-4 h-4 rounded" />
          <ShimmerBone className="h-3.5 w-14" />
        </div>
        {/* Amount */}
        <ShimmerBone className="h-4 w-20" />
        {/* Payment badge */}
        <ShimmerBone className="h-6 w-16 rounded-full" />
        {/* Status badge */}
        <ShimmerBone className="h-6 w-18 rounded-full" style={{ width: 72 }} />
        {/* Printed toggle */}
        <div className="flex justify-center">
          <ShimmerBone className="w-10 h-5 rounded-full" />
        </div>
        {/* Action button */}
        <ShimmerBone className="h-8 w-16 rounded-lg" />
      </div>
    ))}
  </div>
);

/* ── Mobile Card Skeleton ───────────────────────────────────────────
   Matches the mobile card layout:
   - Header: icon + invoice #/date/items + status badge
   - Grid: customer (left) + amount/payment (right)
   - Footer: printed toggle row
   ─────────────────────────────────────────────────────────────────── */
const MobileCardSkeleton = () => (
  <div className="glass-card p-4 flex flex-col gap-4">
    {/* Header */}
    <div className="flex justify-between items-start gap-3">
      <div className="flex gap-3 flex-1">
        <ShimmerBone className="w-10 h-10 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <ShimmerBone className="h-5 w-28 mb-2" />
          <div className="flex items-center gap-3">
            <ShimmerBone className="h-3 w-20" />
            <ShimmerBone className="h-3 w-14" />
          </div>
        </div>
      </div>
      <ShimmerBone className="h-6 w-16 rounded-full shrink-0" />
    </div>

    {/* Customer + Amount grid */}
    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/50 bg-slate-800/30 -mx-4 px-4 pb-1">
      {/* Customer */}
      <div className="space-y-1.5">
        <ShimmerBone className="h-2.5 w-14" />
        <div className="flex items-center gap-2">
          <ShimmerBone className="w-7 h-7 rounded-lg" />
          <div>
            <ShimmerBone className="h-3.5 w-24 mb-1" />
            <ShimmerBone className="h-2.5 w-16" />
          </div>
        </div>
      </div>
      {/* Amount */}
      <div className="space-y-1.5 flex flex-col items-end">
        <ShimmerBone className="h-2.5 w-12" />
        <ShimmerBone className="h-4 w-20" />
        <ShimmerBone className="h-5 w-14 rounded-full" />
      </div>
    </div>

    {/* Printed toggle row */}
    <div className="flex items-center justify-between pt-1 border-t border-slate-700/50 mt-1">
      <ShimmerBone className="h-3 w-24" />
      <ShimmerBone className="w-10 h-5 rounded-full" />
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

/* ── Full Invoices Page Skeleton ────────────────────────────────────
   Combines all sections into a complete page skeleton.
   Shows desktop table OR mobile cards based on CSS breakpoints.
   ─────────────────────────────────────────────────────────────────── */
export const InvoicesPageSkeleton = () => (
  <div className="space-y-12">
    {/* Stats Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

/* ── Table-only Skeleton (for use inside the table area) ───────────
   Used when stats + filters are already rendered
   but table data is still loading.
   ─────────────────────────────────────────────────────────────────── */
export const InvoicesTableSkeleton = () => (
  <>
    <DesktopTableSkeleton rows={8} />
    <MobileCardsSkeleton count={5} />
  </>
);

export default InvoicesPageSkeleton;
