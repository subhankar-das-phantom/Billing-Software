import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Bharat Enterprise Billing System — Scroll & Virtualization Utilities
 * Shared utilities for finding scroll parents, infinite scroll thresholds, and root margin constants.
 */

export const INFINITE_SCROLL_ROOT_MARGIN = '600px';
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
    // 1. Explicit semantic modal/dialog container
    if (parent.getAttribute('role') === 'dialog' || parent.classList.contains('modal-body')) {
      return parent;
    }

    // 2. Explicit intentional nested scroll container (opt-in via data-scroll-container attribute)
    if (parent.hasAttribute('data-scroll-container')) {
      return parent;
    }

    parent = parent.parentElement;
  }

  // 3. Primary application / document root
  return document.scrollingElement || (typeof document !== 'undefined' ? document.documentElement : null);
}

/**
 * Bharat Enterprise Billing System — Dual-Trigger Reactive Sentinel Hook
 *
 * Combines IntersectionObserver with a direct passive scroll listener on scrollRoot (<main>).
 * Solves:
 * 1. Fast-scroll bypass: Rapid mousewheel flicks or scrollbar dragging trigger loadMore via
 *    the passive scroll listener before the user hits the bottom.
 * 2. Stuck-state elimination: Removes destructive manual state overwrites that caused
 *    IntersectionObserver to remain dormant until the user scrolled up and down.
 * 3. Immediate post-fetch continuation: When a fetch completes, if the user remains near
 *    the bottom, smoothly queues the next page after layout settlement.
 *
 * @param {object} options
 * @param {boolean} options.hasMore - Whether more pages are available on the server.
 * @param {boolean} options.isFetching - Whether a pagination request is actively in-flight.
 * @param {boolean} options.isValidating - Whether SWR background revalidation is in progress.
 * @param {Function} options.onLoadMore - Callback to fetch the next page.
 * @param {boolean} [options.enabled=true] - Optional switch to enable/disable (e.g. for inactive tabs).
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

  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  const isFetchingRef = useRef(isFetching);
  isFetchingRef.current = isFetching;

  const isValidatingRef = useRef(isValidating);
  isValidatingRef.current = isValidating;

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

  // Primary Trigger: IntersectionObserver with generous 600px rootMargin
  useEffect(() => {
    const node = sentinelElementRef.current;
    if (!node || !scrollRoot || !enabled) return;

    const isDocRoot = scrollRoot === document.documentElement || scrollRoot === document.body || scrollRoot === document.scrollingElement;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        root: isDocRoot ? null : scrollRoot,
        threshold: INFINITE_SCROLL_THRESHOLD,
        rootMargin: INFINITE_SCROLL_ROOT_MARGIN
      }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      setIsIntersecting(false);
    };
  }, [scrollRoot, enabled]);

  // Secondary Fast-Scroll Trigger: Direct passive scroll listener on scroll target
  useEffect(() => {
    if (!scrollRoot || !enabled) return;

    const isDocRoot = scrollRoot === document.documentElement || scrollRoot === document.body || scrollRoot === document.scrollingElement;
    const scrollTarget = isDocRoot ? window : scrollRoot;

    let ticking = false;
    const handleScrollNearBottom = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!scrollRoot) {
            ticking = false;
            return;
          }

          let scrollHeight, scrollTop, clientHeight;
          if (isDocRoot) {
            const el = document.scrollingElement || document.documentElement;
            scrollHeight = el.scrollHeight;
            scrollTop = window.scrollY || el.scrollTop || 0;
            clientHeight = window.innerHeight || el.clientHeight;
          } else {
            scrollHeight = scrollRoot.scrollHeight;
            scrollTop = scrollRoot.scrollTop;
            clientHeight = scrollRoot.clientHeight;
          }

          const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

          // If within 600px of the bottom during fast scrolling, trigger loadMore
          if (distanceFromBottom <= 600) {
            if (hasMoreRef.current && !isFetchingRef.current && !isValidatingRef.current) {
              onLoadMoreRef.current?.();
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    scrollTarget.addEventListener('scroll', handleScrollNearBottom, { passive: true });
    return () => scrollTarget.removeEventListener('scroll', handleScrollNearBottom);
  }, [scrollRoot, enabled]);

  // Reactive Level Trigger: fires when sentinel is intersecting and locks are released
  useEffect(() => {
    if (!enabled) return;
    if (isIntersecting && hasMore && !isFetching && !isValidating) {
      onLoadMoreRef.current?.();
    }
  }, [isIntersecting, hasMore, isFetching, isValidating, enabled]);

  // Post-Fetch Layout Continuation: if user is still near bottom after items append, queue next page
  useEffect(() => {
    if (!enabled || !hasMore || isFetching || isValidating || !scrollRoot) return;

    const timer = setTimeout(() => {
      if (!scrollRoot) return;
      const scrollHeight = scrollRoot.scrollHeight;
      const scrollTop = scrollRoot.scrollTop;
      const clientHeight = scrollRoot.clientHeight;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

      if (distanceFromBottom <= 600 && hasMoreRef.current && !isFetchingRef.current && !isValidatingRef.current) {
        onLoadMoreRef.current?.();
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isFetching, isValidating, hasMore, enabled, scrollRoot]);

  return { sentinelRef, isIntersecting, scrollRoot };
}
