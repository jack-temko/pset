import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Undone } from '@/api/gen/action';
import { clearPressed, pressRedo, usePressed } from '@/data/undo';
import { TOAST_MS, UndoToast } from '@/units/undo-toast';

/** Where Show goes for a kind of thing, once its screen is on the new
 *  backend. A kind with no page yet has no Show. */
const pageOf = (u: Undone): string | undefined => {
  if (u.id === undefined) return undefined;
  switch (u.kind) {
    default:
      return undefined;
  }
};

/**
 * The one undo toast of the page: what the last Ctrl+Z (or Redo) did, until
 * it is closed, 6 s pass, or the next replaces it. Every screen's frame
 * mounts it once.
 */
export function UndoToastHost() {
  const pressed = usePressed();
  const navigate = useNavigate();
  useEffect(() => {
    if (pressed === null) return undefined;
    // Each press starts its own 6 s: a newer one replaces this one, timer
    // and all.
    const t = setTimeout(clearPressed, TOAST_MS);
    return () => {
      clearTimeout(t);
    };
  }, [pressed]);
  if (pressed === null) return null;
  if (pressed.kind === 'refused') {
    return (
      <UndoToast refused said={pressed.error.what} onClose={clearPressed} />
    );
  }
  const u = pressed.undone;
  const page = pageOf(u);
  return (
    <UndoToast
      said={u.said}
      onRedo={() => {
        void pressRedo(u);
      }}
      onShow={
        page === undefined
          ? undefined
          : () => {
              clearPressed();
              void navigate(page);
            }
      }
      onClose={clearPressed}
    />
  );
}
