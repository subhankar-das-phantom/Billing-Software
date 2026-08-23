import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Product Details / View Page Skeleton
   Mirrors the structure of ProductDetailsPage:
   1. Action Bar (Back to Products, Adjust Stock button)
   2. Product Info Card (Icon, Name, Manufacturer, HSN)
   3. 5-Column Stats Grid (MRP, Rate, GST, Unit, Current Stock)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const ProductDetailsPageSkeleton = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Top Action Bar */}
      <div className="flex justify-between items-center mb-4">
        <ShimmerBone className="h-6 w-36 rounded-lg" />
        <ShimmerBone className="h-10 w-32 rounded-xl" />
      </div>

      {/* Product Info Card */}
      <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 p-6 rounded-2xl shadow-2xl space-y-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Package Icon Box Skeleton */}
            <ShimmerBone className="w-14 h-14 rounded-xl flex-shrink-0" />
            
            {/* Product Title and Meta Skeleton */}
            <div className="space-y-2">
              <ShimmerBone className="h-7 w-64 rounded-lg" />
              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <ShimmerBone className="w-3.5 h-3.5 rounded-full flex-shrink-0" />
                  <ShimmerBone className="h-3 w-32" />
                </div>
                <div className="flex items-center gap-1.5">
                  <ShimmerBone className="w-3.5 h-3.5 rounded-full flex-shrink-0" />
                  <ShimmerBone className="h-3 w-28" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5-Column Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2"
            >
              <div className="flex items-center gap-2">
                <ShimmerBone className="w-4 h-4 rounded-full flex-shrink-0" />
                <ShimmerBone className="h-3 w-16" />
              </div>
              <ShimmerBone className="h-6 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsPageSkeleton;
