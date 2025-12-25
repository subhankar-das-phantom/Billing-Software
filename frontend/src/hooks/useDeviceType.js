import { useState, useEffect } from 'react';

/**
 * Helper to get device info - used for both initial state and updates
 */
const getDeviceInfo = () => {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      screenWidth: 1024,
    };
  }
  
  const width = window.innerWidth;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return {
    isMobile: width <= 768,
    isTablet: width > 768 && width <= 1024,
    isDesktop: width > 1024,
    isTouchDevice,
    screenWidth: width,
  };
};

/**
 * Hook to detect device type based on screen size and touch capabilities.
 * Uses lazy initial state to correctly detect mobile on first render.
 */
export function useDeviceType() {
  // Lazy initial state - correctly detects device on first render
  const [deviceInfo, setDeviceInfo] = useState(getDeviceInfo);

  useEffect(() => {
    // Debounced resize handler for performance
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDeviceInfo(getDeviceInfo());
      }, 150);
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

