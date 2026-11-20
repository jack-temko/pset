import { useCallback, useEffect, useRef, useState } from 'react';

import { errorView } from '@/api/client';
import type { View } from '@/api/gen/errs';

/** A read that is not on the change log (settings, health, an update's
 *  status), as a screen sees it. */
export type Read<T> =
  | { state: 'loading' }
  | { state: 'ready'; value: T }
  | { state: 'failed'; error: View };

/**
 * Reads once when the component mounts, and again on `reload`. Things on
 * the change log go through the store instead, which keeps them live; this
 * is for the few reads nothing announces. A reload keeps the last answer on
 * screen until the new one lands, so nothing jumps.
 */
export function useRead<T>(read: () => Promise<T>): [Read<T>, () => void] {
  const [state, setState] = useState<Read<T>>({ state: 'loading' });
  const latest = useRef(read);
  useEffect(() => {
    latest.current = read;
  });
  const n = useRef(0);
  const reload = useCallback(() => {
    // Only the newest read may answer: an older one landing late is dropped.
    const mine = ++n.current;
    latest.current().then(
      (value) => {
        if (mine === n.current) setState({ state: 'ready', value });
      },
      (e: unknown) => {
        if (mine !== n.current) return;
        setState((s) =>
          s.state === 'ready' ? s : { state: 'failed', error: errorView(e) },
        );
      },
    );
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return [state, reload];
}
