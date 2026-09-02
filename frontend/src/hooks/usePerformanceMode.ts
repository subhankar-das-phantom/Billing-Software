import { useMemo } from 'react';
import { useMediaQuery } from './useMediaQuery';

export type PerformanceMode = 'high' | 'medium' | 'low';

export interface PerformanceInfo {
  performanceMode: PerformanceMode;
  isLowPerformance: boolean;
  isMediumPerformance: boolean;
  isHighPerformance: boolean;
  isReducedPerformance: boolean;
  prefersReducedMotion: boolean;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
}

/**
 * Centralized, easily adjustable hardware capability thresholds.
 * Specifically tuned to recognize older desktop systems (e.g. 2nd/3rd gen Intel Core i3/i5, low RAM)
 * while ensuring modern hardware gets the full animation experience.
 */
export const PERFORMANCE_THRESHOLDS = {
  // Logical CPU core count (threads)
  MIN_HIGH_CORES: 6, // 6+ threads (Hexa-core or modern quad-core with hyperthreading)
  LOW_CORES_CEILING: 2, // 2 or fewer cores (Dual-core / Celeron / Pentium / Core 2 Duo)
  MEDIUM_CORES: 4, // 4 cores/threads (Older i3/i5 2nd/3rd gen or budget modern CPU)

  // Device RAM in Gigabytes (via navigator.deviceMemory where supported)
  LOW_MEMORY_GB: 2, // 2GB or less RAM
  MEDIUM_MEMORY_GB: 4, // 4GB RAM (typical for older office PCs)
  HIGH_MEMORY_GB: 8, // 8GB or more RAM
} as const;

/**
 * Synchronous, zero-lag helper to extract available hardware signals.
 * Does NOT run benchmarks, does NOT block rendering.
 */
export function getHardwareSignals(): {
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { hardwareConcurrency: null, deviceMemory: null };
  }

  const hardwareConcurrency =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : null;

  // navigator.deviceMemory returns approximate RAM in GiB (e.g. 0.25, 0.5, 1, 2, 4, 8)
  // Available in Chromium browsers (Chrome, Edge, Opera, Brave)
  const nav = navigator as unknown as { deviceMemory?: number };
  const deviceMemory =
    typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0
      ? nav.deviceMemory
      : null;

  return { hardwareConcurrency, deviceMemory };
}

/**
 * Classifies hardware capabilities based on available browser indicators.
 * Conservative classification: never downgrades based on a single weak or absent signal.
 */
export function classifyPerformance(
  hardwareConcurrency: number | null,
  deviceMemory: number | null,
  prefersReducedMotion: boolean
): PerformanceMode {
  // 1. Explicit accessibility override always takes precedence
  if (prefersReducedMotion) {
    return 'low';
  }

  const hasCores = hardwareConcurrency !== null;
  const hasMemory = deviceMemory !== null;

  // 2. Clear LOW indicators:
  // - 2 or fewer CPU cores (Dual-core or single-core Celeron/Pentium/Core 2 Duo)
  // - Or 2GB or less RAM
  // - Or 4 cores combined with 4GB RAM or less (classic 2nd/3rd gen Core i3/i5 office PC with 4GB RAM)
  if (
    (hasCores && hardwareConcurrency <= PERFORMANCE_THRESHOLDS.LOW_CORES_CEILING) ||
    (hasMemory && deviceMemory <= PERFORMANCE_THRESHOLDS.LOW_MEMORY_GB) ||
    (hasCores && hasMemory && hardwareConcurrency <= PERFORMANCE_THRESHOLDS.MEDIUM_CORES && deviceMemory <= PERFORMANCE_THRESHOLDS.MEDIUM_MEMORY_GB)
  ) {
    return 'low';
  }

  // 3. Clear HIGH indicators:
  // - 8+ CPU cores (Modern i7/i9, Ryzen 7/9, modern desktop)
  // - 6+ cores with >= 8GB RAM (or memory unsupported)
  // - 4 cores with >= 8GB RAM (capable modern quad-core)
  if (
    (hasCores && hardwareConcurrency >= 8) ||
    (hasCores && hardwareConcurrency >= PERFORMANCE_THRESHOLDS.MIN_HIGH_CORES && (!hasMemory || deviceMemory >= PERFORMANCE_THRESHOLDS.HIGH_MEMORY_GB)) ||
    (hasCores && hasMemory && hardwareConcurrency >= PERFORMANCE_THRESHOLDS.MEDIUM_CORES && deviceMemory >= PERFORMANCE_THRESHOLDS.HIGH_MEMORY_GB)
  ) {
    return 'high';
  }

  // 4. MEDIUM indicators (Moderate or partially constrained hardware):
  // - 4 CPU cores (e.g. 2nd/3rd gen Core i5 with unknown memory or 6GB RAM)
  // - 4GB RAM with unknown cores or 6 cores
  // - 6 cores with <= 4GB RAM
  if (
    (hasCores && hardwareConcurrency <= PERFORMANCE_THRESHOLDS.MEDIUM_CORES) ||
    (hasMemory && deviceMemory <= PERFORMANCE_THRESHOLDS.MEDIUM_MEMORY_GB)
  ) {
    return 'medium';
  }

  // 5. Fallback for unknown hardware (e.g. Firefox/Safari where deviceMemory is undefined and cores is unknown)
  // Default to high to avoid unnecessarily degrading capable systems
  return 'high';
}

/**
 * Independent Performance Detection Hook.
 * Completely separate from useDeviceType.
 * Determines approximate hardware capability without any CPU/GPU benchmarks or render blocking.
 */
export function usePerformanceMode(): PerformanceInfo {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const { hardwareConcurrency, deviceMemory } = useMemo(() => getHardwareSignals(), []);

  const performanceMode = useMemo(() => {
    return classifyPerformance(hardwareConcurrency, deviceMemory, prefersReducedMotion);
  }, [hardwareConcurrency, deviceMemory, prefersReducedMotion]);

  const isLowPerformance = performanceMode === 'low';
  const isMediumPerformance = performanceMode === 'medium';
  const isHighPerformance = performanceMode === 'high';
  const isReducedPerformance = performanceMode !== 'high';

  return {
    performanceMode,
    isLowPerformance,
    isMediumPerformance,
    isHighPerformance,
    isReducedPerformance,
    prefersReducedMotion,
    hardwareConcurrency,
    deviceMemory,
  };
}

export default usePerformanceMode;
