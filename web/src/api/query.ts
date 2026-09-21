import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './client'

/**
 * The one query client. Server state stays fresh through the event
 * stream, not through refetching on a timer or on focus: an event names
 * what changed, and only that is refetched or patched.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      // A 4xx won't change by asking again; a dropped connection might.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
})
