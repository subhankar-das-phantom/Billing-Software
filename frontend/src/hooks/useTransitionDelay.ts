import { useState, useEffect } from 'react';

/**
 * Delays the rendering of heavy components until the page transition animation finishes.
 * This prevents the GPU from dropping frames when mounting massive DOM trees
 * at the exact same time a framer-motion page slide/fade is occurring.
 */
export function useTransitionDelay(delayMs: number = 200, shouldDelay: boolean = true): boolean {
  const [isReady, setIsReady] = useState(!shouldDelay);

  useEffect(() => {
    if (!shouldDelay) {
      setIsReady(true);
      return;
    }

    // If the window isn't focused, or we are on a fast machine, 200ms is standard.
    const timer = setTimeout(() => {
      setIsReady(true);
    }, delayMs);
    
    return () => clearTimeout(timer);
  }, [delayMs, shouldDelay]);

  return isReady;
}
