import { useMemo } from 'react';
import { useDeviceType } from './useDeviceType';
import { useMediaQuery } from './useMediaQuery';

/**
 * Hook to detect user's reduced motion preference.
 */
export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Lightweight motion configuration hook.
 * Optimized for snappy 60fps performance without heavy spring physics or infinite animations.
 */
export function useMotionConfig() {
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const prefersReducedMotion = useReducedMotion();

  return useMemo(() => {
    // If reduced motion is preferred or on low-power devices, use instant transitions
    if (prefersReducedMotion) {
      return {
        shouldAnimate: false,
        shouldStagger: false,
        shouldHover: false,
        shouldInfiniteAnimate: false,
        isMobile,
        isDesktop,
        duration: { fast: 0.05, normal: 0.1, slow: 0.15 },
        spring: {
          stiff: { type: 'tween', duration: 0.1 },
          normal: { type: 'tween', duration: 0.1 },
          bouncy: { type: 'tween', duration: 0.1 },
        },
        stagger: 0,
        transition: {
          default: { duration: 0.1 },
          page: { duration: 0.1 },
          modal: { duration: 0.1 },
        },
      };
    }

    // Snappy, lightweight configuration
    return {
      shouldAnimate: true,
      shouldStagger: false, // Disabled heavy stagger for instant rendering
      shouldHover: !isMobile,
      shouldInfiniteAnimate: false, // Disabled infinite loops to save GPU/CPU
      isMobile,
      isDesktop,
      duration: {
        fast: 0.1,
        normal: 0.15,
        slow: 0.2,
      },
      spring: {
        stiff: { type: 'tween', duration: 0.15, ease: 'easeOut' },
        normal: { type: 'tween', duration: 0.15, ease: 'easeOut' },
        bouncy: { type: 'tween', duration: 0.15, ease: 'easeOut' },
      },
      stagger: 0,
      transition: {
        default: { type: 'tween', duration: 0.15, ease: 'easeOut' },
        page: { type: 'tween', duration: 0.15, ease: 'easeOut' },
        modal: { type: 'tween', duration: 0.15, ease: 'easeOut' },
      },
    };
  }, [isMobile, isDesktop, prefersReducedMotion]);
}

export default useMotionConfig;
