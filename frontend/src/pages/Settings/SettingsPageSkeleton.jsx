import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Settings Page Skeleton
   Mirrors the structure of SettingsPage:
   1. Page Header
   2. Sidebar (Tabs)
   3. Content Area (General Tab Form)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const SettingsSidebarSkeleton = () => (
  <div className="lg:w-72 flex-shrink-0">
    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-3 shadow-xl">
      <div className="flex flex-col gap-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 rounded-xl w-full">
            <ShimmerBone className="w-10 h-10 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <ShimmerBone className="h-4 w-24" />
              <ShimmerBone className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SettingsContentSkeleton = () => (
  <div className="flex-1 min-w-0 space-y-6">
    <div className="mb-6">
      <ShimmerBone className="h-6 w-48 mb-2" />
      <ShimmerBone className="h-4 w-64" />
    </div>

    <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 lg:p-8 shadow-2xl">
      <div className="space-y-6">
        <div className="space-y-5">
          {/* Email */}
          <div>
            <ShimmerBone className="h-3 w-24 mb-2" />
            <ShimmerBone className="h-12 w-full rounded-xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Firm Name */}
            <div>
              <ShimmerBone className="h-3 w-24 mb-2" />
              <ShimmerBone className="h-12 w-full rounded-xl" />
            </div>
            {/* Firm Phone */}
            <div>
              <ShimmerBone className="h-3 w-24 mb-2" />
              <ShimmerBone className="h-12 w-full rounded-xl" />
            </div>
          </div>

          {/* Firm GSTIN */}
          <div>
            <ShimmerBone className="h-3 w-24 mb-2" />
            <ShimmerBone className="h-12 w-full rounded-xl" />
          </div>

          {/* Firm Address */}
          <div>
            <ShimmerBone className="h-3 w-24 mb-2" />
            <ShimmerBone className="h-28 w-full rounded-xl" />
          </div>
        </div>

        {/* Payment Information Section */}
        <div className="pt-6 border-t border-white/5 space-y-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <ShimmerBone className="h-4 w-32 mb-2" />
              <ShimmerBone className="h-3 w-48" />
            </div>
            <ShimmerBone className="h-6 w-10 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <ShimmerBone className="h-3 w-20 mb-2" />
                <ShimmerBone className="h-12 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 flex justify-end">
          <ShimmerBone className="h-12 w-36 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

export const SettingsPageSkeleton = () => (
  <div className="max-w-[1400px] mx-auto min-h-[calc(100vh-8rem)] flex flex-col">
    {/* Page Header */}
    <div className="mb-8">
      <ShimmerBone className="h-10 w-40 mb-2" />
      <ShimmerBone className="h-5 w-72" />
    </div>

    <div className="flex flex-col lg:flex-row gap-8 flex-1">
      <SettingsSidebarSkeleton />
      <SettingsContentSkeleton />
    </div>
  </div>
);

export default SettingsPageSkeleton;
