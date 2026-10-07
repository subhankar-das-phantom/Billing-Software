import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

function shallowEqual(objA, objB) {
  if (objA === objB) return true;
  if (!objA || !objB) return false;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => objA[key] === objB[key]);
}

/**
 * Reusable URL-backed filter hook for list pages.
 * Guarantees 100% referential stability of setters even with inline defaultParams objects,
 * and shields against unstable setSearchParams from router versions via setSearchParamsRef.
 *
 * @param {Record<string, any>} defaultParams - Default fallback values for query params
 * @returns {{
 *   params: Record<string, string>,
 *   setParam: (key: string, value: any) => void,
 *   setParams: (updates: Record<string, any>) => void,
 *   resetParams: (preserveKeys?: string[]) => void,
 *   activeFilterCount: number,
 *   searchParams: URLSearchParams,
 *   setSearchParams: ReturnType<typeof useSearchParams>[1]
 * }}
 */
export function useListFilterParams(defaultParams = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Stabilize defaults ref across renders
  const defaultsRef = useRef(defaultParams);
  if (!shallowEqual(defaultsRef.current, defaultParams)) {
    defaultsRef.current = defaultParams;
  }

  // Stabilize setSearchParams ref to defend against React Router recreation
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  const params = useMemo(() => {
    const current = { ...defaultsRef.current };
    for (const key of Object.keys(defaultsRef.current)) {
      const val = searchParams.get(key);
      if (val !== null && val !== '') {
        current[key] = val;
      }
    }
    return current;
  }, [searchParams]);

  // Setters depend strictly on [] for permanent identity stability across renders
  const setParam = useCallback((key, value) => {
    setSearchParamsRef.current((prev) => {
      const next = new URLSearchParams(prev);
      const defaultValue = defaultsRef.current[key] ?? '';
      if (value === undefined || value === null || value === '' || value === defaultValue) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  }, []);

  const setParams = useCallback((updates) => {
    setSearchParamsRef.current((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        const defaultValue = defaultsRef.current[key] ?? '';
        if (value === undefined || value === null || value === '' || value === defaultValue) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      return next;
    }, { replace: true });
  }, []);

  const resetParams = useCallback((preserveKeys = []) => {
    setSearchParamsRef.current((prev) => {
      const next = new URLSearchParams();
      for (const key of preserveKeys) {
        const val = prev.get(key);
        if (val) next.set(key, val);
      }
      return next;
    }, { replace: true });
  }, []);

  const activeFilterCount = useMemo(() => {
    return Object.keys(defaultsRef.current).filter((k) => {
      if (k === 'search') return false;
      const val = searchParams.get(k);
      return val !== null && val !== '' && val !== defaultsRef.current[k];
    }).length;
  }, [searchParams]);

  return {
    params,
    setParam,
    setParams,
    resetParams,
    activeFilterCount,
    searchParams,
    setSearchParams
  };
}
