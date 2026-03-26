import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Stale-While-Revalidate (SWR) Hook
 * 
 * Shows cached data instantly, then fetches fresh data in the background.
 * When the key changes, stale data is preserved until fresh data arrives
 * (prevents UI flickering and PageLoader hijacking inputs).
 */

const CACHE_PREFIX = 'swr_cache_';
const BROADCAST_CHANNEL = 'swr_sync';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

const memoryCache = new Map();
const invalidationSubscribers = new Map();

let broadcastChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
    broadcastChannel.onmessage = (event) => {
      const { type, pattern, key } = event.data;
      if (type === 'invalidate') {
        if (pattern) {
          for (const cacheKey of memoryCache.keys()) {
            if (cacheKey.includes(pattern)) {
              memoryCache.delete(cacheKey);
            }
          }
          for (const [subKey, callback] of invalidationSubscribers.entries()) {
            if (subKey.includes(pattern)) {
              callback();
            }
          }
        } else if (key) {
          memoryCache.delete(key);
          if (invalidationSubscribers.has(key)) {
            invalidationSubscribers.get(key)();
          }
        }
      }
    };
  }
} catch (e) {
  console.log('SWR: BroadcastChannel not available, using storage events');
}

const safeJSONParse = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

const getCachedData = (key) => {
  if (memoryCache.has(key)) {
    const { data, timestamp, ttl } = memoryCache.get(key);
    if (Date.now() - timestamp < ttl) {
      return { data, isExpired: false };
    }
    return { data, isExpired: true };
  }
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return { data: null, isExpired: true };
    const { data, timestamp, ttl } = safeJSONParse(cached) || {};
    if (!data) return { data: null, isExpired: true };
    const isExpired = Date.now() - timestamp > ttl;
    memoryCache.set(key, { data, timestamp, ttl });
    return { data, isExpired };
  } catch {
    return { data: null, isExpired: true };
  }
};

const setCachedData = (key, data, ttl = DEFAULT_TTL) => {
  const cacheEntry = { data, timestamp: Date.now(), ttl };
  memoryCache.set(key, cacheEntry);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheEntry));
  } catch (e) {
    console.warn('SWR: localStorage write failed, clearing old entries');
    clearOldCache();
  }
};

const clearOldCache = () => {
  const now = Date.now();
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const cached = safeJSONParse(localStorage.getItem(key));
        if (cached && now - cached.timestamp > cached.ttl) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key);
      }
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

const broadcastInvalidation = (type, keyOrPattern) => {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'invalidate',
      [type === 'pattern' ? 'pattern' : 'key']: keyOrPattern
    });
  }
  try {
    const signalKey = `${CACHE_PREFIX}_invalidate_${Date.now()}`;
    localStorage.setItem(signalKey, JSON.stringify({ type, value: keyOrPattern }));
    setTimeout(() => localStorage.removeItem(signalKey), 100);
  } catch {}
};

export const invalidateCache = (key) => {
  memoryCache.delete(key);
  try { localStorage.removeItem(CACHE_PREFIX + key); } catch {}
  broadcastInvalidation('key', key);
};

export const invalidateCachePattern = (pattern) => {
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) memoryCache.delete(key);
  }
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX) && key.includes(pattern)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  broadcastInvalidation('pattern', pattern);
};

/**
 * Main SWR Hook
 */
export function useSWR(key, fetcher, options = {}) {
  const {
    ttl = DEFAULT_TTL,
    revalidateOnFocus = false,
    fallbackData = null
  } = options;

  const [data, setData] = useState(() => {
    const cached = getCachedData(key);
    return cached.data || fallbackData;
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(() => !getCachedData(key).data);
  const [isValidating, setIsValidating] = useState(false);
  const [isStale, setIsStale] = useState(() => getCachedData(key).isExpired);

  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Standalone revalidate for manual triggers (mutate, subscribers)
  const revalidate = useCallback(async () => {
    if (!mountedRef.current || !key) return;
    setIsValidating(true);
    setError(null);
    try {
      const freshData = await fetcherRef.current();
      if (!mountedRef.current) return;
      setCachedData(key, freshData, ttl);
      setData(freshData);
      setIsStale(false);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err);
    } finally {
      if (mountedRef.current) {
        setIsValidating(false);
        setIsLoading(false);
      }
    }
  }, [key, ttl]);

  const mutate = useCallback((newData, shouldRevalidate = true) => {
    if (!key) return;
    if (newData !== undefined) {
      setData(newData);
      setCachedData(key, newData, ttl);
    }
    if (shouldRevalidate) {
      revalidate();
    }
  }, [key, ttl, revalidate]);

  // ─── Primary effect: fetch on mount & key change ───
  // Uses a LOCAL `aborted` flag scoped to each effect invocation.
  // When the key changes:
  //   1. If there's cached data for the new key → show it immediately
  //   2. If not → KEEP old data visible (don't reset to null!)
  //   3. Fetch fresh data in background
  //   4. When fetch completes → replace data
  // This prevents PageLoader from hijacking the UI during search.
  useEffect(() => {
    mountedRef.current = true;
    let aborted = false;

    // Swap to cached data for the new key if available
    const cached = getCachedData(key);
    if (cached.data) {
      setData(cached.data);
      setIsStale(cached.isExpired);
      setIsLoading(false);
    }
    // If no cache: DON'T reset data — keep showing stale data from previous key.
    // The isValidating flag tells the UI that fresh data is incoming.

    // Fetch fresh data in background
    const doFetch = async () => {
      setIsValidating(true);
      setError(null);
      try {
        const freshData = await fetcherRef.current();
        if (aborted) return;
        setCachedData(key, freshData, ttl);
        setData(freshData);
        setIsStale(false);
      } catch (err) {
        if (aborted) return;
        setError(err);
      } finally {
        if (!aborted) {
          setIsValidating(false);
          setIsLoading(false);
        }
      }
    };

    doFetch();

    return () => {
      aborted = true;
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ttl]);

  // ─── Cross-tab invalidation subscriber ───
  useEffect(() => {
    if (!key) return undefined;
    invalidationSubscribers.set(key, revalidate);

    const handleStorageChange = (event) => {
      if (event.key?.startsWith(CACHE_PREFIX)) {
        if (event.key === CACHE_PREFIX + key) {
          const cached = getCachedData(key);
          if (cached.data) {
            setData(cached.data);
            setIsStale(cached.isExpired);
          }
        }
        if (event.key.includes('_invalidate_')) {
          try {
            const signal = safeJSONParse(event.newValue);
            if (signal) {
              if (signal.type === 'pattern' && key.includes(signal.value)) {
                memoryCache.delete(key);
                revalidate();
              } else if (signal.type === 'key' && signal.value === key) {
                memoryCache.delete(key);
                revalidate();
              }
            }
          } catch {}
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      invalidationSubscribers.delete(key);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, revalidate]);

  // ─── Revalidate on window focus ───
  useEffect(() => {
    if (!revalidateOnFocus) return;
    const handleFocus = () => {
      if (document.visibilityState === 'visible') revalidate();
    };
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [revalidateOnFocus, revalidate]);

  return {
    data,
    error,
    isLoading,
    loading: isLoading,
    isValidating,
    isStale,
    mutate,
    revalidate
  };
}

export default useSWR;
