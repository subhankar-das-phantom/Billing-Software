import { useMemo } from 'react';
import { useMediaQuery } from './useMediaQuery';

/**
 * Lightweight, zero-lag device type detector.
 * Uses native CSS media queries without expensive resize polling.
 */
export function useDeviceType() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
  const isDesktop = !isMobile && !isTablet;

  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice,
    screenWidth: isMobile ? 375 : isTablet ? 768 : 1280
  };
}

export default useDeviceType;
