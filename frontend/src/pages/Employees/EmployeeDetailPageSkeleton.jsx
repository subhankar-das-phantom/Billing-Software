import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Employee Detail Page Skeleton
   Mirrors the structure of EmployeeDetailPage:
   1. Header (Back button, avatar, name/status, Activity Log link)
   2. Employee Info Grid (Email, Phone, Address, Gov ID, DOB, Joined, Last Login)
   3. Stats Cards (4-col: Invoices, Sales, Payments, Today's Session)
   4. Permissions Box placeholder
   5. Session Statistics Panel (3-col: Today, Week, Month)
   6. Recent Activity Panels (Invoices & Payments)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const EmployeeDetailPageSkeleton = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <ShimmerBone className="w-10 h-10 rounded-lg shrink-0" />
          <ShimmerBone className="w-14 h-14 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <ShimmerBone className="h-6 w-40 rounded" />
              <ShimmerBone className="h-5 w-16 rounded-full" />
            </div>
            <ShimmerBone className="h-4 w-48 rounded" />
          </div>
        </div>
        <ShimmerBone className="h-10 w-44 rounded-lg shrink-0" />
      </div>

      {/* Employee Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 bg-slate-800/50 rounded-xl border border-slate-700/80 p-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <ShimmerBone className="w-5 h-5 rounded shrink-0" />
            <div className="space-y-1.5 flex-1">
              <ShimmerBone className="h-3 w-12 rounded" />
              <ShimmerBone className="h-4 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700/80 p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <ShimmerBone className="h-3 w-24 rounded" />
                <ShimmerBone className="h-6 w-20 rounded" />
              </div>
              <ShimmerBone className="w-10 h-10 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Session Stats Panel */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/80 p-5">
        <ShimmerBone className="h-5 w-44 mb-5 rounded" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center space-y-2">
              <ShimmerBone className="h-4 w-16 rounded" />
              <ShimmerBone className="h-7 w-12 rounded" />
              <ShimmerBone className="h-3 w-14 rounded" />
              <ShimmerBone className="h-4 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((col) => (
          <div key={col} className="bg-slate-800/50 rounded-xl border border-slate-700/80 p-5 space-y-3">
            <ShimmerBone className="h-5 w-40 mb-3 rounded" />
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-800/60">
                <div className="space-y-1.5">
                  <ShimmerBone className="h-4 w-28 rounded" />
                  <ShimmerBone className="h-3 w-20 rounded" />
                </div>
                <div className="space-y-1.5 flex flex-col items-end">
                  <ShimmerBone className="h-4 w-16 rounded" />
                  <ShimmerBone className="h-3 w-12 rounded" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeDetailPageSkeleton;
