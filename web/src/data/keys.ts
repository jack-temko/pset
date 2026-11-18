import { useEffect, useRef } from 'react';

import { ACTIONS, type ActionId } from '@/api/gen/actions';

/**
 * Every shortcut on the page, through one keydown listener on the document.
 *
 * A key is written as the catalog writes it: lower case, modifiers first and
 * joined by "+" ("d", "j", "ctrl+z", "ctrl+shift+z", "escape"). "ctrl" is
 * Ctrl or Cmd, so one catalog serves both keyboards.
 *
 * While the cursor is in a text box, a key goes to the box: a single key is
 * typed, and Ctrl+Z undoes the typing, not the student's last action. Only a
 * binding made `whileTyping` (the palette's Ctrl+K) fires there.
 *
 * Two bindings of one key at once stack: the newest wins until it goes, so a
 * dialog opened over a screen takes Escape from it and gives it back.
 */

export interface Binding {
  run: () => void;
  whileTyping: boolean;
}

const bound = new Map<string, Binding[]>();

/** The key an event names, written as the catalog writes keys. Shift is
 *  named for letters and named keys only: "?" is already shifted. */
export function keyOf(e: KeyboardEvent): string {
  const name = e.key.toLowerCase();
  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push('ctrl');
  if (e.altKey) mods.push('alt');
  if (e.shiftKey && (e.key.length > 1 || /^[a-z]$/i.test(e.key))) {
    mods.push('shift');
  }
  return [...mods, name].join('+');
}

/** Whether keys typed now belong to a text box. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    // Buttons, boxes to tick and sliders take no text.
    return ![
      'button',
      'checkbox',
      'radio',
      'range',
      'submit',
      'reset',
    ].includes(target.type);
  }
  return false;
}

function onKeyDown(e: KeyboardEvent) {
  // A held key does not repeat an action: holding Ctrl+Z would undo the
  // whole week.
  if (e.repeat || e.isComposing) return;
  const top = bound.get(keyOf(e))?.at(-1);
  if (top === undefined) return;
  if (isTyping(e.target) && !top.whileTyping) return;
  e.preventDefault();
  top.run();
}

/** Binds a key until the returned function is called. */
export function bindKey(
  key: string,
  run: () => void,
  opts: { whileTyping?: boolean } = {},
): () => void {
  if (bound.size === 0) document.addEventListener('keydown', onKeyDown);
  const binding: Binding = { run, whileTyping: opts.whileTyping ?? false };
  const stack = bound.get(key) ?? [];
  stack.push(binding);
  bound.set(key, stack);
  return () => {
    const now = bound.get(key);
    if (now === undefined) return;
    const left = now.filter((b) => b !== binding);
    if (left.length === 0) bound.delete(key);
    else bound.set(key, left);
    if (bound.size === 0) document.removeEventListener('keydown', onKeyDown);
  };
}

/** Binds a key while the component is on screen and `enabled`. The newest
 *  `run` is called, so it may close over the component's state. */
export function useKey(
  key: string | undefined,
  run: () => void,
  opts: { enabled?: boolean; whileTyping?: boolean } = {},
): void {
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  const enabled = opts.enabled ?? true;
  const whileTyping = opts.whileTyping ?? false;
  useEffect(() => {
    if (key === undefined || !enabled) return undefined;
    return bindKey(
      key,
      () => {
        latest.current();
      },
      { whileTyping },
    );
  }, [key, enabled, whileTyping]);
}

/** Binds an action's catalog key, if it has one, to `run`: the screen says
 *  what the action acts on (the problem open now, for "d"). */
export function useActionKey(
  id: ActionId,
  run: () => void,
  opts: { enabled?: boolean } = {},
): void {
  useKey(ACTIONS[id].key, run, opts);
}
