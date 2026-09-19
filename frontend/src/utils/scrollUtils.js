import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Bharat Enterprise Billing System — Scroll & Virtualization Utilities
 * Shared utilities for finding scroll parents, infinite scroll thresholds, and root margin constants.
 */

export const INFINITE_SCROLL_ROOT_MARGIN = '250px';
export const INFINITE_SCROLL_THRESHOLD = 0;

/**
 * Resolves the genuine vertical scroll container for virtualization and infinite scroll observers.
 * Bypasses explicit horizontal table wrappers that compute overflow-y: auto under CSS3 specs.
 * Guarantees that genuinely scrollable vertical modals always take precedence over <main>.
 *
 * @param {HTMLElement|null} node - The element whose vertical scroll parent needs to be resolved.
 * @returns {HTMLElement|null} The resolved vertical scroll container element or fallback.
 */
export function findScrollParent(node) {
  if (!node || typeof window === 'undefined') return null;

  let parent = node.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;

    // 1. Candidate check: vertical scroll intent ('auto' or 'scroll') AND actual vertical scrollability
    const hasScrollIntentY = overflowY === 'auto' || overflowY === 'scroll';
    const hasVerticalOverflow = parent.scrollHeight > parent.clientHeight;

    if (hasScrollIntentY && hasVerticalOverflow) {
      // 2. Semantic exclusion: Detect explicit horizontal table scroll containers.
      // Under CSS3 spec 11.1.1, overflow-x: auto forces overflow-y to compute as 'auto'.
      // Containers marked with [data-horizontal-table-scroll] are purely horizontal wrappers
      // and must be bypassed so traversal finds genuine vertical containers or <main>.
      // Genuinely scrollable vertical modals (even if they contain tables or min-w children)
      // do NOT have this attribute and are immediately returned as the scroll parent!
      const isHorizontalTableWrapper = parent.hasAttribute('data-horizontal-table-scroll');

      if (!isHorizontalTableWrapper) {
        // Genuine vertical container (e.g. nested modal, sheet, or custom vertical viewport)
        return parent;
      }
    }

    // 3. Direct recognition of <main> as the primary scroll container of the dashboard shell
    if (parent.tagName.toLowerCase() === 'main') {
      return parent;
    }

    parent = parent.parentElement;
  }

  // Fallback: Dashboard <main> element, or documentElement
  return document.querySelector('main') || (typeof document !== 'undefined' ? document.documentElement : null);
}

/**
 * Bharat Enterprise Billing System — Reactive Sentinel Hook
 *
 * Implements a level-triggered reactive pattern instead of an edge-triggered drop.
 * Solves the infinite-scroll stall where an edge-triggered IntersectionObserver fires while
 * SWR background revalidation is active and drops the event forever because the sentinel
 * remains stationary inside the viewport.
 *
 * Provides:
 * 1. Stable sentinel callback ref that binds immediately when the sentinel node mounts in the DOM.
 * 2. Instant scroll parent resolution immune to initial skeleton mounting delays.
 * 3. Reactive effect monitoring [isIntersecting, hasMore, isFetching, isValidating] that triggers
 *    pagination the exact millisecond revalidation completes without requiring artificial scroll-up gestures.
 * 4. Post-layout geometric guard preventing duplicate page requests when newly appended items push
 *    the sentinel off-screen.
 *
 * @param {object} options
 * @param {boolean} options.hasMore - Whether more pages are available on the server.
 * @param {boolean} options.isFetching - Whether a pagination request is actively in-flight.
 * @param {boolean} options.isValidating - Whether SWR background revalidation is in progress.
 * @param {Function} options.onLoadMore - Callback to fetch the next page.
 * @param {boolean} [options.enabled=true] - Optional switch to enable/disable (e.g. For inactive tabs).
 * @returns {{ sentinelRef: Function, isIntersecting: boolean, scrollRoot: HTMLElement|null }}
 */
export function useInfiniteScrollSentinel({
  hasMore,
  isFetching,
  isValidating,
  onLoadMore,
  enabled = true
}) {
  const [scrollRoot, setScrollRoot] = useState(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const sentinelElementRef = useRef(null);

  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  // Stable callback ref: resolves scroll root immediately on mount
  const sentinelRef = useCallback((node) => {
    sentinelElementRef.current = node;
    if (node) {
      const resolved = findScrollParent(node);
      setScrollRoot(resolved);
    }
  }, []);

  // Update root on window resize
  useEffect(() => {
    const node = sentinelElementRef.current;
    if (!node) return;

    const handleResize = () => {
      const resolved = findScrollParent(node);
      setScrollRoot(prev => (prev !== resolved ? resolved : prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Truly stable IntersectionObserver: updates level-triggered intersection state
  useEffect(() => {
    const node = sentinelElementRef.current;
    if (!node || !scrollRoot || !enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { root: scrollRoot, threshold: INFINITE_SCROLL_THRESHOLD, rootMargin: INFINITE_SCROLL_ROOT_MARGIN }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      setIsIntersecting(false);
    };
  }, [scrollRoot, enabled]);

  // Level-triggered reactive pagination trigger
  useEffect(() => {
    if (!enabled) return;
    if (isIntersecting && hasMore && !isFetching && !isValidating) {
      // Defensive geometric guard: verify the sentinel element is genuinely inside or near the viewport.
      // Prevents premature double-triggering before the browser dispatches an offscreen event
      // after newly appended items push the sentinel downwards.
      const node = sentinelElementRef.current;
      if (node && scrollRoot) {
        const rootRect = scrollRoot.getBoundingClientRect
          ? scrollRoot.getBoundingClientRect()
          : { top: 0, bottom: window.innerHeight };
        const nodeRect = node.getBoundingClientRect();
        const marginPx = 250;
        const isActuallyNearViewport = nodeRect.top <= (rootRect.bottom + marginPx);

        if (!isActuallyNearViewport) {
          setIsIntersecting(false);
          return;
        }
      }

      onLoadMoreRef.current?.();
    }
  }, [isIntersecting, hasMore, isFetching, isValidating, enabled, scrollRoot]);

  return { sentinelRef, isIntersecting, scrollRoot };
}
