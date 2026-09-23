import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/**
 * Enterprise Subscription & Plans Page Skeleton
 * Fully responsive across mobile (360px+), tablet, and desktop viewports.
 * Mirrors exact layout of SubscriptionPage.jsx to achieve zero CLS:
 * 1. Centered Header (Title & Subtitle)
 * 2. Support Contact Box (Headphones icon, text, copy/email buttons)
 * 3. Current Account Status Card (Plan badge, status description, support link)
 * 4. Duration Selector Switcher (1 Mo, 3 Mo, 6 Mo, 1 Yr tabs)
 * 5. 3-Card Plan Grid (Starter, Business, Professional with prices, CTAs, and feature checklists)
 */

export const SubscriptionHeaderSkeleton = () => (
  <div className="text-center space-y-2">
    <ShimmerBone className="h-8 w-52 sm:w-72 mx-auto rounded-lg" />
    <ShimmerBone className="h-4 w-full max-w-xs sm:max-w-md mx-auto rounded mt-1.5" />
  </div>
);

export const SupportBannerSkeleton = () => (
  <div className="glass-card border border-slate-800 bg-slate-900/60 rounded-2xl p-5 sm:p-6 shadow-sm">
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <ShimmerBone className="w-12 h-12 rounded-xl shrink-0" />
        <div className="space-y-1.5">
          <ShimmerBone className="h-4 w-44 rounded" />
          <ShimmerBone className="h-3.5 w-56 sm:w-80 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-2 w-full md:w-auto">
        <ShimmerBone className="h-9 flex-1 md:w-28 rounded-xl" />
        <ShimmerBone className="h-9 flex-1 md:w-32 rounded-xl" />
      </div>
    </div>
  </div>
);

export const CurrentStatusCardSkeleton = () => (
  <div className="glass-card border border-slate-800 bg-slate-900/70 rounded-2xl p-5 sm:p-6">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ShimmerBone className="h-3.5 w-32 rounded" />
          <ShimmerBone className="h-5 w-24 rounded-full" />
        </div>
        <ShimmerBone className="h-3.5 w-48 sm:w-64 rounded" />
      </div>
      <ShimmerBone className="h-3.5 w-48 rounded" />
    </div>
  </div>
);

export const DurationSelectorSkeleton = () => (
  <div className="flex justify-center">
    <div className="bg-slate-900/80 p-1 rounded-xl flex items-center gap-1 border border-slate-800 max-w-full overflow-x-auto">
      {['1 Month', '3 Months', '6 Months', '1 Year'].map((_, idx) => (
        <ShimmerBone key={idx} className="h-7 w-20 sm:w-28 rounded-lg shrink-0" />
      ))}
    </div>
  </div>
);

export const PlanCardsGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {[1, 2, 3].map((cardIdx) => (
      <div
        key={cardIdx}
        className="relative bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 p-6 flex flex-col justify-between space-y-6"
      >
        <div>
          {/* Plan Name & Description */}
          <div className="mb-4 space-y-2">
            <ShimmerBone className="h-6 w-32 rounded-md" />
            <ShimmerBone className="h-3.5 w-full rounded" />
            <ShimmerBone className="h-3.5 w-3/4 rounded" />
          </div>

          {/* Pricing */}
          <div className="mb-5 space-y-1.5">
            <div className="flex items-end gap-1">
              <ShimmerBone className="h-8 w-28 rounded-lg" />
              <ShimmerBone className="h-3.5 w-8 rounded mb-1" />
            </div>
            <ShimmerBone className="h-3 w-36 rounded" />
          </div>

          {/* CTA Button */}
          <ShimmerBone className="h-10 w-full rounded-xl mb-6" />

          {/* Feature Checklist */}
          <div className="space-y-2.5 pt-4 border-t border-slate-800/60">
            <ShimmerBone className="h-3 w-28 rounded mb-3" />
            {[1, 2, 3, 4, 5, 6].map((featIdx) => (
              <div key={featIdx} className="flex items-center gap-2.5">
                <ShimmerBone className="w-3.5 h-3.5 rounded-full shrink-0" />
                <ShimmerBone className="h-3 w-40 sm:w-48 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const SubscriptionPageSkeleton = () => (
  <div className="max-w-6xl mx-auto pb-12 space-y-8">
    <SubscriptionHeaderSkeleton />
    <SupportBannerSkeleton />
    <CurrentStatusCardSkeleton />
    <DurationSelectorSkeleton />
    <PlanCardsGridSkeleton />
  </div>
);

export default SubscriptionPageSkeleton;
