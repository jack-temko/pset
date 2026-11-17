/** What a key does in the walkthrough: browse with the arrows, open or
 *  close a help row with 1, 2 or 3. Enter is not here: on the primary
 *  button it is the button's own. */
export type WalkthroughKey =
  | { kind: 'browse'; by: -1 | 1 }
  | { kind: 'row'; index: 0 | 1 | 2 };

/** The action for a key, or null when it is not one, a modifier is held or the
 *  student is typing (a text box, a menu, a dialog): the keys are for the
 *  student's hands resting on the keyboard, never for what they write. */
export function walkthroughKey(
  key: string,
  held: boolean,
  typing: boolean,
): WalkthroughKey | null {
  if (held || typing) return null;
  if (key === 'ArrowLeft') return { kind: 'browse', by: -1 };
  if (key === 'ArrowRight') return { kind: 'browse', by: 1 };
  if (key === '1' || key === '2' || key === '3')
    return { kind: 'row', index: (Number(key) - 1) as 0 | 1 | 2 };
  return null;
}

/** Whether a key press came from somewhere that takes text or its own keys. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    'input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"], [role="slider"]',
  );
}
