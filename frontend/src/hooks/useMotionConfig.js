import { useMemo } from 'react';
import { useDeviceType } from './useDeviceType';

/**
 * Hook to detect user's reduced motion preference.
 * Uses matchMedia to check prefers-reduced-motion.
 */
export function useReducedMotion() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mediaQuery.matches;
  }, []);
}

/**
 * Main motion configuration hook that provides adaptive animation settings
 * based on device type and user motion preferences.
 */
export function useMotionConfig() {
  const { isMobile, isTablet, isDesktop, isTouchDevice } = useDeviceType();
  const prefersReducedMotion = useReducedMotion();

  return useMemo(() => {
    // If user prefers reduced motion, minimize all animations
    if (prefersReducedMotion) {
      return {
        // Flags
        shouldAnimate: false,
        shouldStagger: false,
        shouldHover: false,
        shouldInfiniteAnimate: false,
        isMobile,
        isDesktop,
        
        // Durations
        duration: {
          fast: 0.1,
          normal: 0.15,
          slow: 0.2,
        },
        
        // Spring configs
        spring: {
          stiff: { type: 'tween', duration: 0.1 },
          normal: { type: 'tween', duration: 0.15 },
          bouncy: { type: 'tween', duration: 0.15 },
        },
        
        // Stagger
        stagger: 0,
        
        // Transition presets
        transition: {
          default: { duration: 0.1 },
          page: { duration: 0.15 },
          modal: { duration: 0.1 },
        },
      };
    }

    // Mobile-optimized config
    if (isMobile || isTablet) {
      return {
        // Flags
        shouldAnimate: true,
        shouldStagger: false, // Disable stagger on mobile for smoother scrolling
        shouldHover: false,   // Touch devices don't need hover animations
        shouldInfiniteAnimate: false, // No infinite animations on mobile
        isMobile: true,
        isDesktop: false,
        
        // Shorter durations for snappier feel
        duration: {
          fast: 0.15,
          normal: 0.25,
          slow: 0.35,
        },
        
        // Lighter spring configs (less bouncy, more efficient)
        spring: {
          stiff: { type: 'spring', stiffness: 400, damping: 35 },
          normal: { type: 'spring', stiffness: 350, damping: 30 },
          bouncy: { type: 'spring', stiffness: 300, damping: 25 },
        },
        
        // No stagger
        stagger: 0,
        
        // Mobile transition presets
        transition: {
          default: { type: 'tween', duration: 0.25, ease: 'easeOut' },
          page: { type: 'tween', duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
          modal: { type: 'spring', stiffness: 400, damping: 30 },
        },
      };
    }

    // Desktop-optimized config (full animations)
    return {
      // Flags
      shouldAnimate: true,
      shouldStagger: true,
      shouldHover: true,
      shouldInfiniteAnimate: true,
      isMobile: false,
      isDesktop: true,
      
      // Longer durations for richer feel
      duration: {
        fast: 0.2,
        normal: 0.4,
        slow: 0.6,
      },
      
      // Rich spring configs
      spring: {
        stiff: { type: 'spring', stiffness: 400, damping: 25 },
        normal: { type: 'spring', stiffness: 300, damping: 24 },
        bouncy: { type: 'spring', stiffness: 200, damping: 15 },
      },
      
      // Stagger for lists
      stagger: 0.08,
      
      // Desktop transition presets
      transition: {
        default: { type: 'spring', stiffness: 300, damping: 24 },
        page: { type: 'tween', duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] },
        modal: { type: 'spring', stiffness: 300, damping: 25 },
      },
    };
  }, [isMobile, isTablet, isDesktop, prefersReducedMotion]);
}

export default useMotionConfig;
