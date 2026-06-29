import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60 * 1000, // 3 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes (garbage collection time, replacing cacheTime in v5)
      retry: 1,                 // Only retry once on failure
      refetchOnWindowFocus: false, // Don't refetch when switching browser tabs
    },
  },
});
