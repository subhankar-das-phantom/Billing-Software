/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * useListFilterParams Hook
 *
 * Reusable URL-backed filter hook for list pages with TypeScript generics.
 * Guarantees 100% referential stability of setters even with inline defaultParams objects,
 * and shields against unstable setSearchParams from router versions via setSearchParamsRef.
 */

import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

function shallowEqual(objA: Record<string, any>, objB: Record<string, any>): boolean {
  if (objA === objB) return true;
  if (!objA || !objB) return false;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => objA[key] === objB[key]);
}

export interface UseListFilterParamsReturn<T extends Record<string, any>> {
  params: T;
  setParam: <K extends keyof T>(key: K, value: any) => void;
  setParams: (updates: Partial<Record<keyof T | string, any>>) => void;
  resetParams: (preserveKeys?: (keyof T | string)[]) => void;
  activeFilterCount: number;
  searchParams: URLSearchParams;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
}

export function useListFilterParams<T extends Record<string, any>>(
  defaultParams: T = {} as T
): UseListFilterParamsReturn<T> {
  const [searchParams, setSearchParams] = useSearchParams();

  // Stabilize defaults ref across renders
  const defaultsRef = useRef<T>(defaultParams);
  if (!shallowEqual(defaultsRef.current, defaultParams)) {
    defaultsRef.current = defaultParams;
  }

  // Stabilize setSearchParams ref to defend against React Router recreation
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  const params = useMemo(() => {
    const current = { ...defaultsRef.current } as any;
    for (const key of Object.keys(defaultsRef.current)) {
      const val = searchParams.get(key);
      if (val !== null && val !== '') {
        current[key] = val;
      }
    }
    return current as T;
  }, [searchParams, defaultsRef.current]);

  // Setters depend strictly on [] for permanent identity stability across renders
  const setParam = useCallback(<K extends keyof T>(key: K, value: any) => {
    setSearchParamsRef.current(
      (prev) => {
        const next = new URLSearchParams(prev);
        const strKey = String(key);
        const defaultValue = (defaultsRef.current as any)[strKey] ?? '';
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          value === defaultValue ||
          (defaultValue !== '' && String(value) === String(defaultValue))
        ) {
          next.delete(strKey);
        } else {
          next.set(strKey, String(value));
        }
        return next;
      },
      { replace: true }
    );
  }, []);

  const setParams = useCallback((updates: Partial<Record<keyof T | string, any>>) => {
    setSearchParamsRef.current(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          const defaultValue = (defaultsRef.current as any)[key] ?? '';
          if (
            value === undefined ||
            value === null ||
            value === '' ||
            value === defaultValue ||
            (defaultValue !== '' && String(value) === String(defaultValue))
          ) {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        }
        return next;
      },
      { replace: true }
    );
  }, []);

  const resetParams = useCallback((preserveKeys: (keyof T | string)[] = []) => {
    setSearchParamsRef.current(
      (prev) => {
        const next = new URLSearchParams();
        const preserveStrs = preserveKeys.map(String);
        for (const key of preserveStrs) {
          const val = prev.get(key);
          if (val) next.set(key, val);
        }
        return next;
      },
      { replace: true }
    );
  }, []);

  const activeFilterCount = useMemo(() => {
    return Object.keys(defaultsRef.current).filter((k) => {
      if (k === 'search') return false;
      const val = searchParams.get(k);
      return val !== null && val !== '' && val !== String((defaultsRef.current as any)[k]);
    }).length;
  }, [searchParams, defaultsRef.current]);

  return {
    params,
    setParam,
    setParams,
    resetParams,
    activeFilterCount,
    searchParams,
    setSearchParams,
  };
}

export default useListFilterParams;
