import { useSyncExternalStore } from 'react';

import { errorView } from '@/api/client';
import type { Undone } from '@/api/gen/action';
import type { View } from '@/api/gen/errs';

import { redo, undoNewest } from './actions';
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

/** Ctrl+Z pressed: the next undo, after every action and undo still on its
 *  way (`undoNewest` keeps them in order). Never rejects. */
export async function pressUndo(): Promise<void> {
  let next: Pressed;
  try {
    next = { kind: 'undone', undone: await undoNewest() };
  } catch (e) {
    next = { kind: 'refused', error: errorView(e) };
  }
  // Said outside the try: a listener that throws is its own bug, not a
  // refusal of the undo.
  set(next);
}

/** Redo, from the toast: puts back what an undo took back, and says that
 *  instead. Never rejects. */
export async function pressRedo(undone: Undone): Promise<void> {
  let next: Pressed;
  try {
    next = { kind: 'undone', undone: await redo(undone) };
  } catch (e) {
    next = { kind: 'refused', error: errorView(e) };
  }
  set(next);
}

/** Forgets what the last press said: the student moved on. */
export function clearPressed(): void {
  set(null);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** What the last Ctrl+Z did, until it is cleared. */
export function usePressed(): Pressed | null {
  return useSyncExternalStore(subscribe, () => last);
}

/** Binds Ctrl+Z for the whole app; mounted once, by the shell. */
export function useUndoKey(): void {
  useKey('ctrl+z', () => {
    void pressUndo();
  });
}
