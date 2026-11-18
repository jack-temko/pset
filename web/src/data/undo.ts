import { useSyncExternalStore } from 'react';

import { errorView } from '@/api/client';
import type { Undone } from '@/api/gen/action';
import type { View } from '@/api/gen/errs';

import { undoNewest } from './actions';
import { useKey } from './keys';

/**
 * Ctrl+Z: takes back the student's newest action, wherever it is, without
 * moving them (C7: "Renamed back to Problem set 4. Show."). What it took
 * back, or why it couldn't ("There's nothing to undo."), is kept here for the
 * one place that says it; where and how that reads is the notice's design
 * pass, not this file's.
 */
export type Pressed =
  | { kind: 'undone'; undone: Undone }
  | { kind: 'refused'; error: View };

let last: Pressed | null = null;
const listeners = new Set<() => void>();

function set(next: Pressed | null) {
  last = next;
  listeners.forEach((l) => {
    l();
  });
}

// Presses go to the server one after another: two sent together could both
// pick the same newest action, and the second would be refused as already
// undone instead of taking back the one before it.
let queue: Promise<void> = Promise.resolve();

/** Ctrl+Z pressed: the next undo, after any still on its way. */
export function pressUndo(): Promise<void> {
  queue = queue.then(async () => {
    try {
      set({ kind: 'undone', undone: await undoNewest() });
    } catch (e) {
      set({ kind: 'refused', error: errorView(e) });
    }
  });
  return queue;
}

/** Forgets what the last press said: the student moved on. */
export function clearPressed(): void {
  set(null);
}

/** What the last Ctrl+Z did, until it is cleared. */
export function usePressed(): Pressed | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => last,
  );
}

/** Binds Ctrl+Z for the whole app; mounted once, by the shell. */
export function useUndoKey(): void {
  useKey('ctrl+z', () => {
    void pressUndo();
  });
}
