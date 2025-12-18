import { useState, useEffect, useMemo } from 'react';

/**
 * Hook to detect device type based on screen size and touch capabilities.
 * Returns memoized device information to prevent unnecessary re-renders.
 */
export function useDeviceType() {
  const [deviceInfo, setDeviceInfo] = useState(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
  }));

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setDeviceInfo({
        isMobile: width <= 768,
        isTablet: width > 768 && width <= 1024,
        isDesktop: width > 1024,
        isTouchDevice,
        screenWidth: width,
      });
    };

    // Initial update
    updateDeviceInfo();

    // Debounced resize handler for performance
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDeviceInfo, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return deviceInfo;
}

export default useDeviceType;
