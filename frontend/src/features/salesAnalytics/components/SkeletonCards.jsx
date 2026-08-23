import React from 'react';

/* ─── Shimmer Wave Base ─────────────────────────────────────────────
   A single rectangular "bone" with a left-to-right shimmer sweep.
   Uses a CSS background gradient that slides via the animate-shimmer
   keyframe already defined in index.css.
   ─────────────────────────────────────────────────────────────────── */
export const ShimmerBone = ({ className = '', style = {} }) => (
  <div
    className={`rounded bg-slate-700/40 relative overflow-hidden ${className}`}
    style={style}
  >
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, rgba(148,163,184,0.08) 40%, rgba(148,163,184,0.14) 50%, rgba(148,163,184,0.08) 60%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer-wave 2.4s ease-in-out infinite',
      }}
    />
  </div>
);

/* ─── KPI Card Skeleton ─────────────────────────────────────────────
   Matches the real KPICard layout:
   - Top row: label (left) + icon badge (right)
   - Big value row
   - Growth badge row
   ─────────────────────────────────────────────────────────────────── */
export const KPICardSkeleton = () => (
  <div className="glass-card p-5 relative overflow-hidden">
    {/* Title row */}
    <div className="flex justify-between items-start mb-4">
      <ShimmerBone className="h-4 w-24" />
      <ShimmerBone className="w-8 h-8 rounded-lg" />
    </div>
    {/* Value */}
    <div className="flex items-baseline gap-1.5">
      <ShimmerBone className="h-4 w-5" />
      <ShimmerBone className="h-7 w-28" />
    </div>
    {/* Growth badge */}
    <div className="mt-3">
      <ShimmerBone className="h-6 w-32 rounded-md" />
    </div>
  </div>
);

/* ─── Chart Skeleton ────────────────────────────────────────────────
   Shown inside ChartWrapper for the 300px chart area.
   Mimics bar-chart-like shapes at the bottom.
   ─────────────────────────────────────────────────────────────────── */
const BAR_HEIGHTS = [45, 70, 55, 85, 40, 65, 75, 50, 60, 80];

export const ChartSkeleton = () => (
  <div className="w-full h-full min-h-[300px] flex flex-col justify-between p-4">
    {/* Y-axis labels */}
    <div className="flex flex-col justify-between h-full pr-2" style={{ width: 40 }}>
      {[0, 1, 2, 3].map(i => (
        <ShimmerBone key={i} className="h-2.5 w-8" />
      ))}
    </div>

    {/* Chart area */}
    <div className="flex-1 flex items-end gap-2 pl-10 pb-2">
      {BAR_HEIGHTS.map((h, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end">
          <ShimmerBone
            className="w-full rounded-t-sm"
            style={{ height: `${h}%` }}
          />
        </div>
      ))}
    </div>

    {/* X-axis labels */}
    <div className="flex gap-2 pl-10 pt-2">
      {BAR_HEIGHTS.map((_, i) => (
        <ShimmerBone key={i} className="flex-1 h-2.5" />
      ))}
    </div>
  </div>
);

/* ─── Chart Card Skeleton ───────────────────────────────────────────
   A full chart card (title + subtitle + chart area) matching
   the ChartWrapper glass-card structure.
   ─────────────────────────────────────────────────────────────────── */
export const ChartCardSkeleton = () => (
  <div className="glass-card flex flex-col p-5 relative overflow-hidden">
    {/* Header */}
    <div className="mb-4">
      <ShimmerBone className="h-5 w-40 mb-2" />
      <ShimmerBone className="h-3.5 w-56" />
    </div>
    {/* Chart area */}
    <div className="flex-1 min-h-[300px] relative w-full">
      <ChartSkeleton />
    </div>
  </div>
);

/* ─── Date Filter Skeleton ──────────────────────────────────────────
   Matches the DateFilter pill on the right side.
   ─────────────────────────────────────────────────────────────────── */
export const DateFilterSkeleton = () => (
  <div className="flex justify-end">
    <div className="flex items-center gap-2 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
      <ShimmerBone className="w-4 h-4 rounded" />
      <ShimmerBone className="h-4 w-28" />
    </div>
  </div>
);

/* ─── Sales Analytics Page Skeleton ────────────────────────────────
   Full-page skeleton for the SalesAnalyticsSection:
   1. Date filter (right-aligned)
   2. 6 KPI cards (3-col grid on lg, 2-col on sm, 1-col on mobile)
   3. 4 chart grids (2×2 on lg, stacked on mobile)
   ─────────────────────────────────────────────────────────────────── */
export const SalesAnalyticsSkeleton = () => (
  <div className="space-y-6 sm:space-y-8 pb-10">
    {/* Date filter */}
    <DateFilterSkeleton />

    {/* KPI Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <KPICardSkeleton key={i} />
      ))}
    </div>

    {/* Main Trends Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCardSkeleton />
      <ChartCardSkeleton />
    </div>

    {/* Secondary Trends Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCardSkeleton />
      <ChartCardSkeleton />
    </div>

    {/* Top Performers Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCardSkeleton />
      <ChartCardSkeleton />
    </div>

    {/* Distributions Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCardSkeleton />
      <ChartCardSkeleton />
    </div>
  </div>
);
