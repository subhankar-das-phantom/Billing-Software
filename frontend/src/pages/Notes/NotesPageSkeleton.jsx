import React from 'react';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Notes Page Skeleton
   1. Header (search + add button)
   2. Notes grid (4-col xl / 3-col lg / 2-col md / 1-col mobile)
      Each card: color top border, title + pin, content lines, footer
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const SKELETON_COLORS = [
  'border-t-blue-500/40',
  'border-t-teal-500/40',
  'border-t-emerald-500/40',
  'border-t-amber-500/40',
  'border-t-rose-500/40',
  'border-t-cyan-500/40',
  'border-t-blue-500/40',
  'border-t-emerald-500/40',
];

const HeaderSkeleton = () => (
  <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
    <ShimmerBone className="h-10 w-full md:w-96 rounded-lg" />
    <div className="flex items-center gap-3">
      <ShimmerBone className="h-10 w-28 rounded-xl" />
    </div>
  </div>
);

const NoteCardSkeleton = ({ colorClass }) => (
  <div className={`glass-card h-48 sm:h-64 overflow-hidden border-t-4 ${colorClass} flex flex-col`}>
    {/* Header: title + pin */}
    <div className="p-4 sm:p-5 pb-0 flex justify-between items-start gap-2">
      <ShimmerBone className="h-5 w-3/4" />
      <ShimmerBone className="w-7 h-7 rounded-full shrink-0" />
    </div>

    {/* Content lines */}
    <div className="p-4 sm:p-5 flex-1 space-y-2">
      <ShimmerBone className="h-3 w-full" />
      <ShimmerBone className="h-3 w-full" />
      <ShimmerBone className="h-3 w-4/5" />
      <ShimmerBone className="h-3 w-3/5 hidden sm:block" />
      <ShimmerBone className="h-3 w-2/3 hidden sm:block" />
    </div>

    {/* Footer: date + actions */}
    <div className="p-4 pt-0 mt-auto flex justify-between items-center">
      <ShimmerBone className="h-3 w-20" />
      <div className="flex gap-1">
        <ShimmerBone className="w-7 h-7 rounded-lg" />
        <ShimmerBone className="w-7 h-7 rounded-lg" />
      </div>
    </div>
  </div>
);

export const NotesPageSkeleton = () => (
  <div className="space-y-8">
    <HeaderSkeleton />

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <NoteCardSkeleton key={i} colorClass={SKELETON_COLORS[i]} />
      ))}
    </div>
  </div>
);

export default NotesPageSkeleton;
