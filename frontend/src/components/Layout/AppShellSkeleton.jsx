import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ─── App Shell Skeleton ─────────────────────────────────────────────
   A premium layout skeleton shown during initial authentication checks.
   Mirrors the new DashboardLayout:
   - Sidebar on Desktop (256px)
   - Sticky Header on top
   - Content area skeleton
   Ensures zero layout shift or jarring flashes when the app loads.
   ─────────────────────────────────────────────────────────────────── */

const SidebarSkeleton = () => (
  <div className="hidden lg:flex w-64 h-screen bg-slate-900/95 border-r border-slate-800/80 flex-col p-4 shrink-0">
    {/* Logo & Brand Skeleton */}
    <div className="flex items-center gap-3 pb-6 border-b border-slate-800/80">
      <ShimmerBone className="w-9 h-9 rounded-xl shrink-0" />
      <div className="flex-1">
        <ShimmerBone className="h-4 w-20 mb-1.5" />
        <ShimmerBone className="h-3 w-16" />
      </div>
    </div>

    {/* Nav Sections Skeleton */}
    <div className="flex-1 py-4 space-y-6">
      <div>
        <ShimmerBone className="h-3 w-16 mb-3" />
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <ShimmerBone key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </div>

      <div>
        <ShimmerBone className="h-3 w-16 mb-3" />
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map((i) => (
            <ShimmerBone key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </div>

      <div>
        <ShimmerBone className="h-3 w-20 mb-3" />
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <ShimmerBone key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>

    {/* Footer User Skeleton */}
    <div className="pt-4 border-t border-slate-800/80 space-y-2">
      <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/40">
        <ShimmerBone className="w-8 h-8 rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          <ShimmerBone className="h-3.5 w-24 mb-1" />
          <ShimmerBone className="h-2.5 w-28" />
        </div>
      </div>
    </div>
  </div>
);

const HeaderSkeleton = () => (
  <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 h-16 flex items-center justify-between px-4 sm:px-6">
    <div className="flex items-center gap-3">
      <ShimmerBone className="w-8 h-8 rounded-lg lg:hidden" />
      <div>
        <ShimmerBone className="h-3 w-28 mb-1 hidden sm:block" />
        <ShimmerBone className="h-5 w-36" />
      </div>
    </div>

    <div className="flex items-center gap-3">
      <ShimmerBone className="h-9 w-36 sm:w-48 rounded-xl" />
      <ShimmerBone className="h-8 w-8 rounded-full" />
    </div>
  </header>
);

const ContentSkeleton = () => (
  <div className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto w-full space-y-6">
    <div className="mb-6">
      <ShimmerBone className="h-7 w-48 mb-2" />
      <ShimmerBone className="h-4 w-64" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="glass-card p-5">
          <div className="flex justify-between items-start mb-3">
            <ShimmerBone className="h-4 w-24" />
            <ShimmerBone className="w-8 h-8 rounded-lg" />
          </div>
          <ShimmerBone className="h-7 w-28 mb-2" />
          <ShimmerBone className="h-3.5 w-32" />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      <div className="lg:col-span-2 glass-card p-6 min-h-[360px]">
        <ShimmerBone className="h-5 w-40 mb-6" />
        <ShimmerBone className="h-[260px] w-full rounded-xl" />
      </div>
      <div className="glass-card p-6 min-h-[360px]">
        <ShimmerBone className="h-5 w-40 mb-6" />
        <div className="space-y-3.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <ShimmerBone key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const AppShellSkeleton = () => {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased overflow-hidden relative">
      <SidebarSkeleton />
      <div className="flex-1 flex flex-col min-w-0">
        <HeaderSkeleton />
        <main className="flex-1 overflow-y-auto">
          <ContentSkeleton />
        </main>
      </div>
    </div>
  );
};

export default AppShellSkeleton;
