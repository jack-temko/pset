import { useEffect, useRef, useState } from 'react';

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
 * Two bindings of one key at once stack: the one mounted last wins until it
 * goes, so a dialog opened over a screen takes Escape from it and gives it
 * back. A binding keeps its place in the stack when it is switched off and on
 * again (`enabled`), so a screen under a dialog never jumps above it.
 *
 * Letters are read from the key's place on the keyboard when the layout gives
 * no Latin letter: on a Russian keyboard Ctrl+Z reports "я", and still undoes.
 */

export interface Binding {
  run: () => void;
  whileTyping: boolean;
  /** Its place in the stack: higher is newer. */
  order: number;
}

const bound = new Map<string, Binding[]>();

let mounted = 0;
/** A new place at the top of every stack. */
const nextOrder = () => ++mounted;

/** The key's name: `e.key`, or the Latin letter at its place when the layout
 *  types another alphabet there. */
function nameOf(e: KeyboardEvent): string {
  const latin = /^Key([A-Z])$/.exec(e.code)?.[1];
  if (
    latin !== undefined &&
    e.key.length === 1 &&
    !/^[\x20-\x7e]$/.test(e.key)
  ) {
    return latin.toLowerCase();
  }
  return e.key.toLowerCase();
}

/** The key an event names, written as the catalog writes keys. Shift is
 *  named for letters and named keys only: "?" is already shifted. */
export function keyOf(e: KeyboardEvent): string {
  const name = nameOf(e);
  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push('ctrl');
  if (e.altKey) mods.push('alt');
  if (e.shiftKey && (name.length > 1 || /^[a-z]$/.test(name))) {
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
  // whole week. Nor does a key that ends an IME's composition (Safari says
  // so only with keyCode 229).
  // oxlint-disable-next-line typescript/no-deprecated -- Safari marks the composition's last key only this way
  if (e.repeat || e.isComposing || e.keyCode === 229) return;
  const top = bound.get(keyOf(e))?.at(-1);
  if (top === undefined) return;
  if (isTyping(e.target) && !top.whileTyping) return;
  e.preventDefault();
  top.run();
}

/** Binds a key until the returned function is called. `order` is its place
 *  in the stack, a new top by default. */
export function bindKey(
  key: string,
  run: () => void,
  opts: { whileTyping?: boolean; order?: number } = {},
): () => void {
  if (bound.size === 0) document.addEventListener('keydown', onKeyDown);
  const binding: Binding = {
    run,
    whileTyping: opts.whileTyping ?? false,
    order: opts.order ?? nextOrder(),
  };
  const stack = [...(bound.get(key) ?? []), binding].sort(
    (a, b) => a.order - b.order,
  );
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
  // Taken once, as the component mounts: its place in the stack for good.
  const [order] = useState(nextOrder);
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
      { whileTyping, order },
    );
  }, [key, enabled, whileTyping, order]);
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
