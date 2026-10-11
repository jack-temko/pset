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
  const action = view.action;
  if (!action) return null;
  const label = LABELS[action];
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
