import { useSyncExternalStore } from 'react';

import type { View } from './gen/errs';

/**
 * The one error of the whole screen, if there is one: a request that found
 * the server unreachable. The shell draws it as the banner, so nothing else
 * says it again. It clears the moment any request gets an answer.
 */
let current: View | null = null;
const listeners = new Set<() => void>();

function set(next: View | null) {
  if (current === next) return;
  current = next;
  listeners.forEach((l) => {
    l();
  });
}

export const screenError = {
  /** The error now, outside a component. */
  current: (): View | null => current,
  /** Remember a screen-scope error. */
  raise: (view: View) => {
    set(view);
  },
  /** An answer arrived: the server is there. */
  clear: () => {
    set(null);
  },
};

export function useScreenError(): View | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
  );
}
