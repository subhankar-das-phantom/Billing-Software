import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
const inFlightRequests = new Map();
const recentFetchTimestamps = new Map();
const invalidationSubscribers = new Map();

// Pattern-based subscribers for non-useSWR consumers (e.g. InvoiceCreatePage local state)
const patternSubscribers = new Map(); // Map<pattern, Set<callback>>
const seenInvalidationIds = new Set();
const MAX_SEEN_IDS = 100;


let broadcastChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
    broadcastChannel.onmessage = (event) => {
      const { type, pattern, key, invalidationId } = event.data;
      if (type === 'invalidate') {
        if (pattern) {
          for (const cacheKey of memoryCache.keys()) {
            if (isPatternMatch(cacheKey, pattern)) {
              memoryCache.delete(cacheKey);
            }
          }
          for (const [subKey, callback] of invalidationSubscribers.entries()) {
            if (isPatternMatch(subKey, pattern)) {
              callback();
            }
          }
          notifyPatternSubscribers(pattern, invalidationId);
        } else if (key) {
          memoryCache.delete(key);
          if (invalidationSubscribers.has(key)) {
            invalidationSubscribers.get(key)();
          }
          notifyPatternSubscribers(key, invalidationId);
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

const isPatternMatch = (cacheKey, pattern) =>
  typeof cacheKey === 'string'
  && typeof pattern === 'string'
  && cacheKey.includes(pattern);

// Single dispatch function with ID-based dedup.
// Both BroadcastChannel and storage handlers call this instead of
// notifying subscribers directly, preventing double notifications.
const notifyPatternSubscribers = (matchValue, invalidationId) => {
  if (invalidationId) {
    if (seenInvalidationIds.has(invalidationId)) return;
    seenInvalidationIds.add(invalidationId);
    if (seenInvalidationIds.size > MAX_SEEN_IDS) {
      seenInvalidationIds.delete(seenInvalidationIds.values().next().value);
    }
  }

  for (const [pattern, callbacks] of patternSubscribers) {
    if (!isPatternMatch(matchValue, pattern)) continue;
    for (const cb of callbacks) cb();
  }
};

// HMR-safe global storage listener for pattern subscribers.
// The per-hook storage listener (inside useSWR) handles invalidationSubscribers;
// this global one handles only patternSubscribers — no overlap.
let storageListenerInitialized = false;

if (!storageListenerInitialized) {
  storageListenerInitialized = true;
  try {
    window.addEventListener('storage', (event) => {
      if (!event.key?.startsWith('swr_cache__invalidate_')) return;
      try {
        const signal = safeJSONParse(event.newValue);
        if (!signal) return;
        const matchValue = signal.value;
        if (matchValue && (signal.type === 'pattern' || signal.type === 'key')) {
          notifyPatternSubscribers(matchValue, signal.invalidationId);
        }
      } catch {}
    });
  } catch {}
}

const hasOwn = (obj, key) =>
  obj != null && Object.prototype.hasOwnProperty.call(obj, key);

const getCachedData = (key) => {
  if (memoryCache.has(key)) {
    const { data, timestamp, ttl } = memoryCache.get(key);
    if (Date.now() - timestamp < ttl) {
      return { data, isExpired: false, hasData: true };
    }
    return { data, isExpired: true, hasData: true };
  }
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return { data: null, isExpired: true, hasData: false };
    const parsed = safeJSONParse(cached);
    if (!hasOwn(parsed, 'data')) return { data: null, isExpired: true, hasData: false };
    const { data, timestamp, ttl } = parsed;
    const isExpired = Date.now() - timestamp > ttl;
    memoryCache.set(key, { data, timestamp, ttl });
    return { data, isExpired, hasData: true };
  } catch {
    return { data: null, isExpired: true, hasData: false };
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
  const invalidationId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'invalidate',
      [type === 'pattern' ? 'pattern' : 'key']: keyOrPattern,
      invalidationId
    });
  }
  try {
    const signalKey = `${CACHE_PREFIX}_invalidate_${Date.now()}`;
    localStorage.setItem(signalKey, JSON.stringify({ type, value: keyOrPattern, invalidationId }));
    setTimeout(() => localStorage.removeItem(signalKey), 100);
  } catch {}
};

const fetchWithDedupe = (key, fetcher) => {
  if (!key || typeof fetcher !== 'function') {
    return Promise.resolve(null);
  }

  const recentFetchAt = recentFetchTimestamps.get(key);
  if (recentFetchAt && Date.now() - recentFetchAt < 1000) {
    const cached = getCachedData(key);
    if (cached?.hasData) {
      return Promise.resolve(cached.data);
    }
  }

  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const requestPromise = (async () => {
    try {
      const data = await fetcher();
      recentFetchTimestamps.set(key, Date.now());
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, requestPromise);
  return requestPromise;
};

export const invalidateCache = (key) => {
  memoryCache.delete(key);
  try { localStorage.removeItem(CACHE_PREFIX + key); } catch {}
  broadcastInvalidation('key', key);
};

export const invalidateCachePattern = (pattern) => {
  for (const key of memoryCache.keys()) {
    if (isPatternMatch(key, pattern)) memoryCache.delete(key);
  }
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX) && isPatternMatch(key, pattern)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  broadcastInvalidation('pattern', pattern);
};

/**
 * Subscribe to cache invalidation events matching a pattern.
 * Works across tabs via BroadcastChannel + storage fallback.
 * Returns an unsubscribe function.
 *
 * @example
 *   const unsub = subscribeToInvalidation('products', () => refreshStock());
 *   return unsub; // in useEffect cleanup
 */
export const subscribeToInvalidation = (pattern, callback) => {
  if (!patternSubscribers.has(pattern)) {
    patternSubscribers.set(pattern, new Set());
  }
  patternSubscribers.get(pattern).add(callback);

  return () => {
    const callbacks = patternSubscribers.get(pattern);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) patternSubscribers.delete(pattern);
    }
  };
};

/**
 * Main SWR Hook
 */
export function useSWR(key, fetcher, options = {}) {
  const { user } = useAuth();
  const {
    ttl = DEFAULT_TTL,
    revalidateOnFocus = false,
    fallbackData = null
  } = options;

  const userId = user?._id || user?.id;
  const baseKey = key
    ? (typeof key === 'string' ? key : JSON.stringify(key))
    : null;
  const scopedKey = userId && baseKey ? `${baseKey}|${userId}` : null;

  const [data, setData] = useState(() => {
    if (!scopedKey) return fallbackData;
    const cached = getCachedData(scopedKey);
    return cached.hasData ? cached.data : fallbackData;
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(() => (scopedKey ? !getCachedData(scopedKey).hasData : false));
  const [isValidating, setIsValidating] = useState(false);
  const [isStale, setIsStale] = useState(() => (scopedKey ? getCachedData(scopedKey).isExpired : true));

  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const revalidate = useCallback(async () => {
    if (!mountedRef.current || !scopedKey) return;
    setIsValidating(true);
    setError(null);
    try {
      const freshData = await fetchWithDedupe(scopedKey, fetcherRef.current);
      if (!mountedRef.current) return;
      setCachedData(scopedKey, freshData, ttl);
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
  }, [scopedKey, ttl]);

  const mutate = useCallback((newData, shouldRevalidate = true) => {
    if (!scopedKey) return;
    if (newData !== undefined) {
      setData(newData);
      setCachedData(scopedKey, newData, ttl);
    }
    if (shouldRevalidate) {
      revalidate();
    }
  }, [scopedKey, ttl, revalidate]);

  useEffect(() => {
    mountedRef.current = true;
    let aborted = false;

    if (!scopedKey) {
      setData(fallbackData);
      setError(null);
      setIsLoading(false);
      setIsValidating(false);
      setIsStale(true);
      return () => {
        aborted = true;
        mountedRef.current = false;
      };
    }

    const cached = getCachedData(scopedKey);
    if (cached.hasData) {
      setData(cached.data);
      setIsStale(cached.isExpired);
      setIsLoading(false);
    }

    const doFetch = async () => {
      setIsValidating(true);
      setError(null);
      try {
        const freshData = await fetchWithDedupe(scopedKey, fetcherRef.current);
        if (aborted) return;
        setCachedData(scopedKey, freshData, ttl);
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
  }, [scopedKey, ttl, fallbackData]);

  useEffect(() => {
    if (!scopedKey) return undefined;
    invalidationSubscribers.set(scopedKey, revalidate);

    const handleStorageChange = (event) => {
      if (event.key?.startsWith(CACHE_PREFIX)) {
        if (event.key === CACHE_PREFIX + scopedKey) {
          const cached = getCachedData(scopedKey);
          if (cached.hasData) {
            setData(cached.data);
            setIsStale(cached.isExpired);
          }
        }
        if (event.key.includes('_invalidate_')) {
          try {
            const signal = safeJSONParse(event.newValue);
            if (signal) {
              if (signal.type === 'pattern' && scopedKey.includes(signal.value)) {
                memoryCache.delete(scopedKey);
                revalidate();
              } else if (signal.type === 'key' && signal.value === scopedKey) {
                memoryCache.delete(scopedKey);
                revalidate();
              }
            }
          } catch {}
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      invalidationSubscribers.delete(scopedKey);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [scopedKey, revalidate]);

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

