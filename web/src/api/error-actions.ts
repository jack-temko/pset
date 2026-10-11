import { createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Action, View } from './gen/errs';

/** The button an error asks for: its words, and what clicking does. */
export interface ErrorAction {
  label: string;
  run: () => void;
}

const LABELS: Record<Exclude<Action, ''>, string> = {
  retry: 'Try again',
  open_settings: 'Open Settings',
  open_book: 'Open the book',
  check_update: 'Check for updates',
  reload: 'Reload the page',
};

/** A host that wants to see where an action would go instead of going
 *  there: /views records it as a handoff. Everywhere else there is none. */
export const ErrorActionsContext = createContext<
  ((action: Exclude<Action, '' | 'retry'>, view: View) => void) | null
>(null);

/**
 * What an error's one typed action does here. `retry` is the caller's own
 * (it knows the call that failed), so without `onRetry` there is no button;
 * the others are the same wherever the error is shown.
 */
export function useErrorAction(
  view: View,
  onRetry?: () => void,
): ErrorAction | null {
  const navigate = useNavigate();
  const host = useContext(ErrorActionsContext);
  const action = view.action;
  if (!action) return null;
  const label = LABELS[action];
  if (host && action !== 'retry') {
    return {
      label,
      run: () => {
        host(action, view);
      },
    };
  }
  switch (action) {
    case 'retry':
      return onRetry ? { label, run: onRetry } : null;
    case 'open_settings':
      return {
        label,
        run: () => {
          void navigate('/settings#connections');
        },
      };
    case 'check_update':
      return {
        label,
        run: () => {
          void navigate('/settings#updates');
        },
      };
    case 'open_book':
      return view.ref
        ? {
            label,
            run: () => {
              void navigate(`/books/${view.ref}`);
            },
          }
        : null;
    case 'reload':
      return {
        label,
        run: () => {
          window.location.reload();
        },
      };
  }
}
