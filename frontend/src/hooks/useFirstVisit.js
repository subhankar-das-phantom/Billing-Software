import { useRef } from 'react';

/**
 * Tracks whether the current page is being visited for the first time
 * during this browser session. Uses sessionStorage so animations replay
 * after the tab is closed, but NOT when navigating between pages.
 *
 * Usage:
 *   const isFirstVisit = useFirstVisit('dashboard');
 *   <motion.div initial={isFirstVisit ? "hidden" : false} animate="show">
 *
 * Setting `initial` to `false` tells Framer Motion to skip the entrance
 * animation entirely and render directly in the `animate` state.
 */
export function useFirstVisit(pageKey) {
  // Use a ref so we compute once per mount and never change
  const isFirst = useRef(() => {
    const storageKey = `visited_${pageKey}`;
    try {
      if (sessionStorage.getItem(storageKey)) {
        return false;
      }
      sessionStorage.setItem(storageKey, '1');
      return true;
    } catch {
      // sessionStorage unavailable (e.g. private browsing quota exceeded)
      return true;
    }
  });

  // Lazily evaluate on first access
  if (typeof isFirst.current === 'function') {
    isFirst.current = isFirst.current();
  }

  return isFirst.current;
}

export default useFirstVisit;
