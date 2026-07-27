import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ─── App Shell Skeleton ─────────────────────────────────────────────
   A premium layout skeleton shown during initial authentication checks.
   Mimics the DashboardLayout (Navbar on Desktop, Header on Mobile).
   Ensures a seamless transition when the app fully loads.
   ─────────────────────────────────────────────────────────────────── */

const DesktopNavbarSkeleton = () => (
  <div className="hidden lg:block fixed top-0 left-0 right-0 z-50 glass-card border-b border-slate-700/50 backdrop-blur-xl bg-slate-900/95">
    <div className="max-w-[1600px] mx-auto px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo Area */}
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-10 h-10 rounded-xl" />
          <div>
            <ShimmerBone className="h-5 w-20 mb-1" />
            <ShimmerBone className="h-3 w-16" />
          </div>
        </div>

        {/* Nav Links Area */}
        <div className="flex items-center gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ShimmerBone key={i} className="h-9 w-24 rounded-lg" />
          ))}
          <ShimmerBone className="h-9 w-32 rounded-lg ml-2" />
        </div>

        {/* User Profile Area */}
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-10 h-10 rounded-full" />
          <ShimmerBone className="w-10 h-10 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

const MobileHeaderSkeleton = () => (
  <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-white/10 px-4 py-4">
    <div className="flex items-center justify-between">
      <ShimmerBone className="w-10 h-10 rounded-xl" />
      <ShimmerBone className="h-6 w-32" />
      <ShimmerBone className="w-10 h-10 rounded-full" />
    </div>
  </div>
);

const ContentSkeleton = () => (
  <div className="flex-1 p-6 lg:p-8 pt-24 lg:pt-32 max-w-[1600px] mx-auto w-full space-y-6">
    <div className="mb-8">
      <ShimmerBone className="h-8 w-48 mb-2" />
      <ShimmerBone className="h-4 w-64" />
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="glass-card p-5">
          <div className="flex justify-between items-start mb-4">
            <ShimmerBone className="h-4 w-24" />
            <ShimmerBone className="w-8 h-8 rounded-lg" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <ShimmerBone className="h-7 w-28" />
          </div>
          <div className="mt-3">
            <ShimmerBone className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
      <div className="lg:col-span-2 glass-card p-6 min-h-[400px]">
        <ShimmerBone className="h-6 w-40 mb-6" />
        <ShimmerBone className="h-[300px] w-full rounded-xl" />
      </div>
      <div className="glass-card p-6 min-h-[400px]">
        <ShimmerBone className="h-6 w-40 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <ShimmerBone key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const AppShellSkeleton = () => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 overflow-hidden relative">
      <DesktopNavbarSkeleton />
      <MobileHeaderSkeleton />
      
      {/* Decorative animated background to match DashboardLayout */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)'
          }}
        />
      </div>

      <ContentSkeleton />
    </div>
  );
};

export default AppShellSkeleton;
