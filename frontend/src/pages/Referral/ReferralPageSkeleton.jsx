import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/**
 * Enterprise Referral & Earn Page Skeleton
 * Matches ReferralPage.jsx layout pixel-by-pixel for zero-CLS frame-0 loading:
 * 1. Executive Header (Gift icon, title, subtitle)
 * 2. Top 3-Col Grid:
 *    - Referral Code Share Card (glow background, code box, copy button, link input)
 *    - 3 KPI Stat Cards (Total Signups, Pending Rewards, Days Earned)
 * 3. Bottom 3-Col Grid:
 *    - Left: How It Works 3-step timeline + Apply Code form
 *    - Right: Reward Progress Table with table headers and rows
 */

export const ReferralHeaderSkeleton = () => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
      <div className="flex items-center gap-3">
        <ShimmerBone className="w-8 h-8 rounded-lg" />
        <ShimmerBone className="h-8 w-64 rounded-lg" />
      </div>
      <ShimmerBone className="h-4 w-80 sm:w-96 rounded mt-2" />
    </div>
  </div>
);

export const ReferralTopGridSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Share Card Skeleton */}
    <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between shadow-xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ShimmerBone className="w-5 h-5 rounded" />
          <ShimmerBone className="h-5 w-40 rounded" />
        </div>
        <div className="bg-slate-900/80 border border-slate-700/40 rounded-xl p-4 flex items-center justify-between">
          <ShimmerBone className="h-8 w-32 rounded-lg" />
          <ShimmerBone className="w-9 h-9 rounded-lg" />
        </div>
      </div>
      <div className="space-y-2">
        <ShimmerBone className="h-3 w-24 rounded" />
        <div className="flex gap-2">
          <ShimmerBone className="h-10 flex-1 rounded-lg" />
          <ShimmerBone className="h-10 w-20 rounded-lg" />
        </div>
      </div>
    </div>

    {/* 3 KPI Stat Cards */}
    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Signups */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-center space-y-3">
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-9 h-9 rounded-lg" />
          <ShimmerBone className="h-4 w-24 rounded" />
        </div>
        <ShimmerBone className="h-9 w-16 rounded-lg" />
      </div>

      {/* Pending */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-center space-y-3">
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-9 h-9 rounded-lg" />
          <ShimmerBone className="h-4 w-28 rounded" />
        </div>
        <ShimmerBone className="h-9 w-16 rounded-lg" />
        <ShimmerBone className="h-3 w-32 rounded" />
      </div>

      {/* Days Earned */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-center space-y-3">
        <div className="flex items-center gap-3">
          <ShimmerBone className="w-9 h-9 rounded-lg" />
          <ShimmerBone className="h-4 w-24 rounded" />
        </div>
        <ShimmerBone className="h-9 w-20 rounded-lg" />
        <ShimmerBone className="h-3 w-36 rounded" />
      </div>
    </div>
  </div>
);

export const ReferralBottomGridSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Left Column: How It Works & Apply Code */}
    <div className="lg:col-span-1 space-y-6">
      {/* How it works */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <ShimmerBone className="w-5 h-5 rounded" />
          <ShimmerBone className="h-5 w-32 rounded" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex gap-4 items-start">
              <ShimmerBone className="w-6 h-6 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <ShimmerBone className="h-4 w-32 rounded" />
                <ShimmerBone className="h-3 w-48 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Apply Code Box */}
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 space-y-3">
        <ShimmerBone className="h-5 w-44 rounded" />
        <ShimmerBone className="h-3.5 w-60 rounded" />
        <div className="flex gap-2 pt-2">
          <ShimmerBone className="h-9 flex-1 rounded-lg" />
          <ShimmerBone className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>

    {/* Right Column: Reward Progress History Table */}
    <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden">
      <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
        <ShimmerBone className="h-5 w-36 rounded" />
        <ShimmerBone className="h-6 w-24 rounded-md" />
      </div>
      <div className="p-0 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="px-6 py-4"><ShimmerBone className="h-3 w-20" /></th>
              <th className="px-6 py-4"><ShimmerBone className="h-3 w-16" /></th>
              <th className="px-6 py-4"><ShimmerBone className="h-3 w-28" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <ShimmerBone className="h-4 w-24" />
                </td>
                <td className="px-6 py-4">
                  <ShimmerBone className="h-6 w-20 rounded-md" />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <ShimmerBone className="h-4 w-20" />
                    <ShimmerBone className="h-3 w-3" />
                    <ShimmerBone className="h-4 w-28" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export const ReferralPageSkeleton = () => (
  <div className="flex-1 p-4 lg:p-8 overflow-y-auto bg-slate-900">
    <div className="max-w-6xl mx-auto space-y-6">
      <ReferralHeaderSkeleton />
      <ReferralTopGridSkeleton />
      <ReferralBottomGridSkeleton />
    </div>
  </div>
);

export default ReferralPageSkeleton;
