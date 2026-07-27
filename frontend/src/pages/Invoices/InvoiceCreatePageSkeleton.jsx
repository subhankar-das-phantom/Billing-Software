import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Invoice Create Page Skeleton
   Mirrors the structure of InvoiceCreatePage:
   1. Customer Selection (Search box)
   2. Product Selection (Search box + table placeholder)
   3. Summary Section (Additional Details + Totals)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const CustomerSelectionSkeleton = () => (
  <div className="glass-card p-6 relative z-20">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <ShimmerBone className="w-9 h-9 rounded-lg" />
        <ShimmerBone className="h-6 w-40" />
      </div>
    </div>
    <div className="relative">
      <ShimmerBone className="h-[46px] w-full rounded-xl" />
    </div>
  </div>
);

const ProductSelectionSkeleton = () => (
  <div className="glass-card p-6 relative z-10">
    <div className="flex items-center gap-3 mb-6">
      <ShimmerBone className="w-9 h-9 rounded-lg" />
      <ShimmerBone className="h-6 w-36" />
    </div>
    <div className="relative mb-4">
      <ShimmerBone className="h-[46px] w-full rounded-xl" />
    </div>
    
    {/* Table placeholder */}
    <div className="hidden md:block table-container mt-6">
      <table className="table">
        <thead>
          <tr>
            <th className="w-1/3"><ShimmerBone className="h-3 w-20 inline-block" /></th>
            <th><ShimmerBone className="h-3 w-12 inline-block" /></th>
            <th><ShimmerBone className="h-3 w-12 inline-block" /></th>
            <th><ShimmerBone className="h-3 w-16 inline-block" /></th>
            <th><ShimmerBone className="h-3 w-16 inline-block" /></th>
            <th><ShimmerBone className="h-3 w-16 inline-block" /></th>
            <th><ShimmerBone className="h-3 w-24 inline-block" /></th>
          </tr>
        </thead>
        <tbody>
          {[1, 2].map(i => (
            <tr key={i}>
              <td>
                <ShimmerBone className="h-4 w-32 mb-1" />
                <ShimmerBone className="h-3 w-20" />
              </td>
              <td><ShimmerBone className="h-8 w-16 rounded-lg" /></td>
              <td><ShimmerBone className="h-8 w-16 rounded-lg" /></td>
              <td><ShimmerBone className="h-4 w-16" /></td>
              <td><ShimmerBone className="h-4 w-16" /></td>
              <td><ShimmerBone className="h-4 w-12" /></td>
              <td><ShimmerBone className="h-4 w-24" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const SummarySectionSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Additional Details */}
    <div className="glass-card p-6 lg:col-span-2 relative z-0">
      <div className="flex items-center gap-3 mb-6">
        <ShimmerBone className="w-9 h-9 rounded-lg" />
        <ShimmerBone className="h-6 w-44" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <ShimmerBone className="h-4 w-28 mb-2" />
          <ShimmerBone className="h-[46px] w-full rounded-xl" />
        </div>
        <div className="md:col-span-2 mt-2">
          <ShimmerBone className="h-4 w-32 mb-2" />
          <ShimmerBone className="h-[46px] w-full rounded-xl" />
        </div>
      </div>
    </div>

    {/* Totals */}
    <div className="glass-card p-6 relative z-0">
      <div className="flex items-center gap-3 mb-6">
        <ShimmerBone className="w-9 h-9 rounded-lg" />
        <ShimmerBone className="h-6 w-40" />
      </div>
      <div className="space-y-4">
        <div className="flex justify-between">
          <ShimmerBone className="h-4 w-20" />
          <ShimmerBone className="h-4 w-24" />
        </div>
        <div className="flex justify-between">
          <ShimmerBone className="h-4 w-32" />
          <ShimmerBone className="h-4 w-24" />
        </div>
        <div className="flex justify-between">
          <ShimmerBone className="h-4 w-12" />
          <ShimmerBone className="h-4 w-24" />
        </div>
        <div className="flex justify-between">
          <ShimmerBone className="h-4 w-12" />
          <ShimmerBone className="h-4 w-24" />
        </div>
        <div className="flex justify-between pt-4 border-t border-slate-700">
          <ShimmerBone className="h-5 w-28" />
          <ShimmerBone className="h-6 w-32" />
        </div>
      </div>
      <ShimmerBone className="h-12 w-full rounded-xl mt-6" />
    </div>
  </div>
);

export const InvoiceCreatePageSkeleton = () => (
  <div className="space-y-12">
    <CustomerSelectionSkeleton />
    <ProductSelectionSkeleton />
    <SummarySectionSkeleton />
  </div>
);

export default InvoiceCreatePageSkeleton;
