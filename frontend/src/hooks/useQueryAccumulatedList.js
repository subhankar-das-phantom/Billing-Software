import { useEffect, useRef, useState } from 'react';

const defaultItemKey = (item) => item?._id;

/**
 * Accumulate paginated responses without allowing a previous query's pages to
 * appear while the next query is being fetched.
 *
 * SWR is intentionally allowed to keep cached data. The accumulator is the
 * boundary that decides whether that data belongs to the active query.
 */
export function useQueryAccumulatedList({
  queryKey,
  page,
  data,
  itemsKey,
  getItemKey = defaultItemKey,
}) {
  const responseItems = Array.isArray(data?.[itemsKey]) ? data[itemsKey] : null;
  const responseMatches = Boolean(
    responseItems &&
    data?._queryKey === queryKey &&
    data?._page === page
  );

  const [state, setState] = useState(() => ({
    queryKey,
    items: responseMatches ? responseItems : [],
  }));
  const activeQueryKeyRef = useRef(queryKey);

  // This effect runs after render, so the render path below also checks the
  // stored query key and hides the old list immediately on a query change.
  useEffect(() => {
    activeQueryKeyRef.current = queryKey;
    // The accumulator is intentionally synchronized from the query response;
    // the render-time query-key check below prevents stale data before this runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((previous) => (
      previous.queryKey === queryKey
        ? previous
        : { queryKey, items: [] }
    ));
  }, [queryKey]);

  useEffect(() => {
    if (!responseMatches || activeQueryKeyRef.current !== queryKey) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((previous) => {
      if (previous.queryKey !== queryKey || page === 1) {
        return { queryKey, items: responseItems };
      }

      const existingIds = new Set(previous.items.map(getItemKey));
      const nextItems = responseItems.filter((item) => !existingIds.has(getItemKey(item)));
      return {
        queryKey,
        items: [...previous.items, ...nextItems],
      };
    });
  }, [data, page, queryKey, responseItems, responseMatches, getItemKey]);

  const isCurrentQuery = state.queryKey === queryKey;
  const clearItems = () => {
    setState({ queryKey, items: [] });
  };
  const updateItems = (updater) => {
    setState((previous) => {
      if (previous.queryKey !== queryKey) return previous;
      const nextItems = typeof updater === 'function' ? updater(previous.items) : updater;
      return { queryKey, items: Array.isArray(nextItems) ? nextItems : previous.items };
    });
  };

  return {
    items: isCurrentQuery ? state.items : [],
    hasCurrentPageData: isCurrentQuery && responseMatches,
    clearItems,
    updateItems,
  };
}

export default useQueryAccumulatedList;
