import { useSyncExternalStore, useCallback } from 'react';

/**
 * High-performance, tear-free media query hook using React 19's useSyncExternalStore.
 * Zero CPU overhead, no polling, and no unnecessary re-renders.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const matchMedia = window.matchMedia(query);
      
      if (matchMedia.addEventListener) {
        matchMedia.addEventListener('change', callback);
        return () => matchMedia.removeEventListener('change', callback);
      } else if ('addListener' in matchMedia) {
        // @ts-ignore
        matchMedia.addListener(callback);
        // @ts-ignore
        return () => matchMedia.removeListener(callback);
      }
      return () => {};
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default useMediaQuery;
