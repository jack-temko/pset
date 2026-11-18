import { useEffect } from 'react';

import { catchFailures } from './incidents';
import { store } from './resources';
import { connect } from './stream';
import { useUndoKey } from './undo';

let started = false;

/**
 * Starts the page's live data once: the change stream into the store, and
 * the catch-all that reports the page's own failures. Every screen on the
 * new backend calls it; the first one starts it, and it runs for the life
 * of the page. Also binds Ctrl+Z while the screen is shown.
 */
export function useLiveData(): void {
  useEffect(() => {
    if (started) return;
    started = true;
    connect(store);
    catchFailures();
  }, []);
  useUndoKey();
}
