import React, { useMemo, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { VirtualizedList } from './VirtualizedList';
import { Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function InfiniteVirtualizedList({
  queryKey,
  queryFn,
  getNextPageParam: getNextPageParamProp,
  initialPageParam,
  estimateSize = () => 80,
  renderItem,
  getKey = (item, index) => item?._id ?? index,
  emptyState,
  className = '',
  itemClassName = '',
  enabled = true,
  rootMargin = '400px',
  staleTime,
  overscan
}) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey,
    queryFn,
    getNextPageParam: getNextPageParamProp
      ?? ((lastPage) => lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined),
    initialPageParam: initialPageParam ?? 1,
    enabled,
    ...(staleTime !== undefined && { staleTime })
  });

  const flatItems = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.items || page.invoices || page.payments || page.manualEntries || page.creditNotes || []);
  }, [data]);

  // Use IntersectionObserver to load more when the sentinel is visible
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isLoading || !enabled) return;

    const scrollParent = typeof document !== 'undefined' ? document.querySelector('main') : null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { root: scrollParent, rootMargin } // Use generous rootMargin for smooth loading
    );

    const sentinel = document.getElementById(`sentinel-${queryKey.join('-')}`);
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage, rootMargin, queryKey, enabled]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-500" />
        <p>Loading records...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-red-400 min-h-[300px] bg-red-500/10 rounded-xl border border-red-500/20">
        <AlertCircle className="w-10 h-10 mb-4" />
        <p className="mb-4">Failed to load records: {error?.message}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (flatItems.length === 0) {
    return emptyState || (
      <div className="flex items-center justify-center p-12 text-slate-400 min-h-[300px] border border-dashed border-slate-700 rounded-xl">
        No records found.
      </div>
    );
  }

  return (
    <div className={`flex flex-col w-full h-full ${className}`}>
      {/* We use VirtualizedList which needs a fixed height container, so the parent should usually be flex-1 overflow-hidden, but VirtualizedList expects its parent to manage its height or it will expand. Wait, VirtualizedList inside this component uses window scroll by default (useWindowVirtualizer). */}
      <VirtualizedList
        items={flatItems}
        estimateSize={estimateSize}
        renderItem={renderItem}
        getKey={getKey}
        className="w-full"
        itemClassName={itemClassName}
        {...(overscan !== undefined && { overscan })}
      />
      
      {/* Sentinel Element for Intersection Observer */}
      <div
        id={`sentinel-${queryKey.join('-')}`}
        className="h-10 w-full flex items-center justify-center mt-4 mb-8 text-slate-400"
      >
        {isFetchingNextPage ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-sm">Loading more...</span>
          </motion.div>
        ) : hasNextPage ? (
          <span className="text-sm text-slate-500">Scroll for more</span>
        ) : (
          <span className="text-sm text-slate-500">End of records</span>
        )}
      </div>
    </div>
  );
}
