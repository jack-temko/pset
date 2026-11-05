import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from './client';
import { screenError } from './screen-error';

const clear = () => {
  screenError.clear();
};

function raiseScreenError(e: unknown) {
  if (e instanceof ApiError && e.view.scope === 'screen')
    screenError.raise(e.view);
}

/**
 * The one query client (and `makeQueryClient`, for /views, which gives
 * each view its own). Server state stays fresh through the event
 * stream, not through refetching on a timer or on focus: an event names
 * what changed, and only that is refetched or patched.
 */
export const makeQueryClient = () =>
  new QueryClient({
    // A failure of the whole screen (the server not answering) is said once,
    // by the shell's banner; any answer at all means it is back.
    queryCache: new QueryCache({ onError: raiseScreenError, onSuccess: clear }),
    mutationCache: new MutationCache({
      onError: raiseScreenError,
      onSuccess: clear,
    }),
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        // A 4xx won't change by asking again; a dropped connection might.
        retry: (count, err) =>
          !(err instanceof ApiError && err.status >= 400 && err.status < 500) &&
          count < 2,
      },
      mutations: { retry: false },
    },
  });

export const queryClient = makeQueryClient();
