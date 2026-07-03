import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * useCustomerFilters
 *
 * URL-synced filter state for the Customers page.
 *
 * Architecture:
 *   - Source of truth: URL search params (via useSearchParams)
 *   - Draft state: managed by the filter panel component locally
 *   - On Apply: panel calls applyFilters(draft) → URL updates → SWR re-fetches
 *   - On Reset: panel calls resetFilters() → URL clears → SWR re-fetches
 *
 * This hook does NOT maintain draft state for the panel.
 * The panel owns its own local draft. This hook only reads/writes URL params.
 */

// Default filter values — represent "no filter applied"
export const DEFAULT_FILTERS = {
  search: '',
  status: '',          // '' = active (server default)
  hasGstin: '',        // '' = all
  hasDlNo: '',         // '' = all
  hasPhone: '',        // '' = all
  hasEmail: '',        // '' = all
  hasAddress: '',      // '' = all
  dateRange: '',       // '' = all time
  dateFrom: '',
  dateTo: '',
  sortBy: '',          // '' = createdAt (server default)
  sortOrder: '',       // '' = desc (server default)
};

// Keys that are considered "filter" keys (not search/sort)
// Used for counting active filters
const FILTER_KEYS = [
  'status', 'hasGstin', 'hasDlNo', 'hasPhone', 'hasEmail',
  'hasAddress', 'dateRange',
];

/**
 * Extract filter object from URLSearchParams.
 * Only includes keys that have non-empty values.
 */
function paramsToFilters(searchParams) {
  const filters = {};
  for (const key of Object.keys(DEFAULT_FILTERS)) {
    const value = searchParams.get(key) || '';
    if (value) {
      filters[key] = value;
    }
  }
  return filters;
}

/**
 * Convert a filters object to URLSearchParams (dropping empty values).
 */
function filtersToParams(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
  return params;
}

export function useCustomerFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read current filters from URL
  const filters = useMemo(() => paramsToFilters(searchParams), [searchParams]);

  // Count active filters (excluding search and sort, which are always visible)
  const activeFilterCount = useMemo(() => {
    return FILTER_KEYS.filter(key => {
      const value = searchParams.get(key);
      return value && value !== '';
    }).length;
  }, [searchParams]);

  const isFiltered = activeFilterCount > 0;

  // Apply filters to URL (called by filter panel on "Apply" click)
  const applyFilters = useCallback((newFilters) => {
    // Merge with current search (preserve it if not provided)
    const merged = { ...filters, ...newFilters };
    setSearchParams(filtersToParams(merged), { replace: true });
  }, [filters, setSearchParams]);

  // Reset all filters to defaults (preserves search)
  const resetFilters = useCallback(() => {
    const currentSearch = searchParams.get('search') || '';
    const params = new URLSearchParams();
    if (currentSearch) {
      params.set('search', currentSearch);
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  // Update just the search param (called by the search input)
  const setSearch = useCallback((search) => {
    const newFilters = { ...filters };
    if (search) {
      newFilters.search = search;
    } else {
      delete newFilters.search;
    }
    setSearchParams(filtersToParams(newFilters), { replace: true });
  }, [filters, setSearchParams]);

  // Build API params object from current filters
  const apiParams = useMemo(() => {
    const params = { ...filters };
    // Always include fuzzy for search
    if (params.search) {
      params.fuzzy = 'true';
    }
    return params;
  }, [filters]);

  return {
    filters,
    apiParams,
    activeFilterCount,
    isFiltered,
    applyFilters,
    resetFilters,
    setSearch,
    search: filters.search || '',
  };
}
