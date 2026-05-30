import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Returns a debounced version of `value`, plus a `flush()` function
 * that immediately pushes the latest value (useful for form-submit or
 * clear-search scenarios where you can't wait for the timer).
 *
 * Special behaviour:
 *  - When `value` becomes falsy (empty string, null, 0, etc.) the
 *    debounced value updates **immediately** — clearing a search field
 *    should never feel laggy.
 *  - Otherwise the returned value only updates after the caller stops
 *    changing `value` for `delay` ms.
 *  - On unmount the pending timer is cleaned up automatically.
 *
 * @template T
 * @param {T}      value - The rapidly-changing input value.
 * @param {number} [delay=500] - Debounce window in milliseconds.
 * @returns {[T, () => void]} A tuple of [debouncedValue, flush].
 *
 * @example
 * const [searchInput, setSearchInput] = useState('');
 * const [debouncedSearch, flushSearch] = useDebounce(searchInput, 500);
 *
 * const handleSubmit = (e) => {
 *   e.preventDefault();
 *   flushSearch();   // immediately sync debounced value
 *   mutate();        // then revalidate SWR
 * };
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const latestValue = useRef(value);

  // Always track the latest value so flush() can grab it
  latestValue.current = value;

  useEffect(() => {
    // If the value is falsy (e.g. cleared search), update immediately
    if (!value) {
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  // Imperatively push the latest value right now (skipping the timer)
  const flush = useCallback(() => {
    setDebouncedValue(latestValue.current);
  }, []);

  return [debouncedValue, flush];
}
