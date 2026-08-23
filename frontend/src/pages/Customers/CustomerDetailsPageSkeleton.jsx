import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Customer Details / View Page Skeleton
   Mirrors the structure of CustomerDetailsPage:
   1. Back Button
   2. Customer Info Card (Avatar, Details Grid, Theme picker, Stats Cards)
   3. Tabbed Content Card (Tabs header, Action buttons, Table skeleton)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const CustomerDetailsPageSkeleton = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Back Button */}
      <div>
        <ShimmerBone className="h-6 w-36 rounded-lg" />
      </div>

      {/* Customer Info Card */}
      <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 p-6 rounded-2xl shadow-2xl space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-start gap-6">
          {/* Avatar Skeleton */}
          <ShimmerBone className="w-20 h-20 rounded-2xl flex-shrink-0" />

          {/* Details Column */}
          <div className="flex-1 space-y-4">
            {/* Name and Badge */}
            <div className="flex items-center gap-3">
              <ShimmerBone className="h-8 w-56 rounded-lg" />
              <ShimmerBone className="h-6 w-20 rounded-full" />
            </div>

            {/* Contact Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
              <div className="flex items-center gap-2">
                <ShimmerBone className="w-4 h-4 rounded-full flex-shrink-0" />
                <ShimmerBone className="h-4 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <ShimmerBone className="w-4 h-4 rounded-full flex-shrink-0" />
                <ShimmerBone className="h-4 w-48" />
              </div>
              <div className="flex items-center gap-2">
                <ShimmerBone className="w-4 h-4 rounded-full flex-shrink-0" />
                <ShimmerBone className="h-4 w-36" />
              </div>
              <div className="flex items-center gap-2 md:col-span-2 xl:col-span-3">
                <ShimmerBone className="w-4 h-4 rounded-full flex-shrink-0" />
                <ShimmerBone className="h-4 w-80 max-w-full" />
              </div>
            </div>

            {/* Theme Selector Skeleton */}
            <div className="pt-2 space-y-2">
              <ShimmerBone className="h-3 w-16" />
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <ShimmerBone key={i} className="w-9 h-9 rounded-lg flex-shrink-0" />
                ))}
              </div>
            </div>
          </div>

          {/* Stats Cards Row */}
          <div className="flex flex-wrap lg:flex-nowrap gap-4 w-full xl:w-auto mt-4 xl:mt-0">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-1 xl:w-36 text-center px-5 py-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col items-center justify-center space-y-2"
              >
                <ShimmerBone className="w-10 h-10 rounded-full" />
                <ShimmerBone className="h-7 w-20" />
                <ShimmerBone className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabbed Content Card */}
      <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden">
        {/* Tab Header */}
        <div className="border-b border-slate-700/60 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => (
              <ShimmerBone key={i} className="h-10 w-28 rounded-lg" />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <ShimmerBone className="h-9 w-32 rounded-lg hidden sm:block" />
            <ShimmerBone className="h-9 w-36 rounded-lg hidden sm:block" />
            <ShimmerBone className="h-9 w-32 rounded-lg" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-5 gap-4 px-4 py-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
            <ShimmerBone className="h-4 w-24" />
            <ShimmerBone className="h-4 w-28" />
            <ShimmerBone className="h-4 w-20" />
            <ShimmerBone className="h-4 w-24" />
            <ShimmerBone className="h-4 w-20 ml-auto" />
          </div>

          {/* Table Rows */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div
                key={row}
                className="p-4 bg-slate-800/20 hover:bg-slate-800/40 border border-slate-700/30 rounded-xl flex flex-col sm:grid sm:grid-cols-5 gap-3 sm:items-center"
              >
                <div className="flex justify-between sm:block">
                  <ShimmerBone className="h-4 w-28 mb-1 sm:mb-0" />
                  <ShimmerBone className="h-3 w-16 sm:hidden" />
                </div>
                <ShimmerBone className="h-4 w-32" />
                <ShimmerBone className="h-6 w-20 rounded-full" />
                <ShimmerBone className="h-4 w-24" />
                <div className="flex justify-between sm:justify-end items-center gap-2 pt-2 sm:pt-0 border-t border-slate-700/30 sm:border-t-0">
                  <ShimmerBone className="h-4 w-12 sm:hidden" />
                  <ShimmerBone className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailsPageSkeleton;
