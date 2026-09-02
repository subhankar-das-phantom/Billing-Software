import { useMemo } from 'react';
import { useDeviceType } from './useDeviceType';
import { useMediaQuery } from './useMediaQuery';
import { usePerformanceMode } from './usePerformanceMode';

/**
 * Hook to detect user's reduced motion preference.
 */
export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Performance-aware motion configuration hook.
 * Coexists with useDeviceType:
 * - useDeviceType: Determines device/layout behavior (mobile, tablet, desktop)
 * - usePerformanceMode: Determines approximate hardware performance tier (high, medium, low)
 *
 * Preserves existing mobile experience (almost no animation) exactly as it is today,
 * while automatically reducing expensive animations on low-end older desktop PCs (e.g. 2nd/3rd gen i3/i5).
 */
export function useMotionConfig() {
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const prefersReducedMotion = useReducedMotion();
  const {
    performanceMode,
    isLowPerformance,
    isMediumPerformance,
    isHighPerformance,
    isReducedPerformance,
  } = usePerformanceMode();

  return useMemo(() => {
    // If reduced motion is preferred at OS/browser level, use instant transitions
    if (prefersReducedMotion) {
      return {
        shouldAnimate: false,
        shouldStagger: false,
        shouldHover: false,
        shouldInfiniteAnimate: false,
        allow3DTilt: false,
        allowComplexVariants: false,
        performanceMode: 'low',
        isLowPerformance: true,
        isMediumPerformance: false,
        isHighPerformance: false,
        isReducedPerformance: true,
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

    // ─── 1. Mobile & Tablet: Preserve existing mobile behavior 100% ───
    if (isMobile) {
      return {
        shouldAnimate: true,
        shouldStagger: false, // Disabled heavy stagger for instant rendering
        shouldHover: false, // Mobile has no hover
        shouldInfiniteAnimate: false,
        allow3DTilt: false,
        allowComplexVariants: false,
        performanceMode,
        isLowPerformance,
        isMediumPerformance,
        isHighPerformance,
        isReducedPerformance,
        isMobile: true,
        isDesktop: false,
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
    }

    // ─── 2. Desktop: Differentiate by Hardware Performance Tier ───

    // Tier A: Low-End Desktop (e.g. 2nd/3rd gen Core i3, dual-core, <= 4GB RAM)
    // Snappy near-instant tweens, avoids expensive GPU shaders & 3D matrix math
    if (isLowPerformance) {
      return {
        shouldAnimate: true,
        shouldStagger: false,
        shouldHover: true,
        shouldInfiniteAnimate: false,
        allow3DTilt: false, // Skip 3D mousemove math
        allowComplexVariants: false, // Skip GPU blur filters and 3D rotations
        performanceMode: 'low',
        isLowPerformance: true,
        isMediumPerformance: false,
        isHighPerformance: false,
        isReducedPerformance: true,
        isMobile: false,
        isDesktop: true,
        duration: {
          fast: 0.06,
          normal: 0.1,
          slow: 0.14,
        },
        spring: {
          stiff: { type: 'tween', duration: 0.08, ease: 'easeOut' },
          normal: { type: 'tween', duration: 0.08, ease: 'easeOut' },
          bouncy: { type: 'tween', duration: 0.08, ease: 'easeOut' },
        },
        stagger: 0,
        transition: {
          default: { type: 'tween', duration: 0.08, ease: 'easeOut' },
          page: { type: 'tween', duration: 0.08, ease: 'easeOut' },
          modal: { type: 'tween', duration: 0.08, ease: 'easeOut' },
        },
      };
    }

    // Tier B: Medium Desktop (e.g. 2nd/3rd gen Core i5, 4-core office PC with 6-8GB RAM)
    // Snappy transitions with standard hover, allows 3D tilt but avoids infinite loops
    if (isMediumPerformance) {
      return {
        shouldAnimate: true,
        shouldStagger: false,
        shouldHover: true,
        shouldInfiniteAnimate: false,
        allow3DTilt: true,
        allowComplexVariants: true,
        performanceMode: 'medium',
        isLowPerformance: false,
        isMediumPerformance: true,
        isHighPerformance: false,
        isReducedPerformance: true,
        isMobile: false,
        isDesktop: true,
        duration: {
          fast: 0.08,
          normal: 0.13,
          slow: 0.18,
        },
        spring: {
          stiff: { type: 'tween', duration: 0.12, ease: 'easeOut' },
          normal: { type: 'tween', duration: 0.12, ease: 'easeOut' },
          bouncy: { type: 'tween', duration: 0.12, ease: 'easeOut' },
        },
        stagger: 0,
        transition: {
          default: { type: 'tween', duration: 0.12, ease: 'easeOut' },
          page: { type: 'tween', duration: 0.12, ease: 'easeOut' },
          modal: { type: 'tween', duration: 0.12, ease: 'easeOut' },
        },
      };
    }

    // Tier C: High-End Desktop (Modern Core i5/i7/i9, Ryzen 5/7/9, 8+ threads, 8GB+ RAM)
    // Full animation experience with rich spring physics, 3D tilt, and visual effects
    return {
      shouldAnimate: true,
      shouldStagger: false,
      shouldHover: true,
      shouldInfiniteAnimate: false,
      allow3DTilt: true,
      allowComplexVariants: true,
      performanceMode: 'high',
      isLowPerformance: false,
      isMediumPerformance: false,
      isHighPerformance: true,
      isReducedPerformance: false,
      isMobile: false,
      isDesktop: true,
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
  }, [
    isMobile,
    isDesktop,
    prefersReducedMotion,
    performanceMode,
    isLowPerformance,
    isMediumPerformance,
    isHighPerformance,
    isReducedPerformance,
  ]);
}

export default useMotionConfig;

