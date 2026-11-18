import { X } from 'lucide-react';

import { Button } from '@/units/button';
import { IconButton } from '@/units/icon-button';

/**
 * What Ctrl+Z did, said once: the server's own sentence ("Renamed back to
 * Problem set 4."), with Redo and, when the thing has a page, Show. One at a
 * time: the next undo replaces it, so they never stack. A refused undo
 * ("There's nothing to undo.") is the same toast with no buttons.
 *
 * It floats at the bottom centre over the page (undo-toast-d1), so nothing
 * moves; on the design page it sits in the flow.
 */
export function UndoToast({
  said,
  refused,
  onRedo,
  onShow,
  onClose,
  floating = true,
}: {
  /** The sentence to show. */
  said: string;
  /** Ctrl+Z was refused: the sentence is why, and nothing can be redone. */
  refused?: boolean;
  /** Puts back what was undone. */
  onRedo?: () => void;
  /** Goes to the thing that was undone, when it has a page. */
  onShow?: () => void;
  onClose: () => void;
  /** Fixed over the page; false on the design page. */
  floating?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex max-w-[min(560px,calc(100vw-32px))] items-center gap-3 rounded-lg border border-(--ds-border) bg-(--ds-bg-raised) py-2 pr-2 pl-4 shadow-lg',
        floating ? 'fixed bottom-6 left-1/2 z-50 -translate-x-1/2' : '',
      ].join(' ')}
    >
      <p
        className={`ds-body min-w-0 flex-1 [overflow-wrap:anywhere] ${
          refused === true ? 'text-(--ds-fg-muted)' : 'text-(--ds-fg)'
        }`}
      >
        {said}
      </p>
      {refused !== true && onShow !== undefined && (
        <Button variant="quiet" onPress={onShow}>
          Show
        </Button>
      )}
      {refused !== true && onRedo !== undefined && (
        <Button onPress={onRedo}>Redo</Button>
      )}
      <IconButton icon={X} label="Close" onPress={onClose} />
    </div>
  );
}

/** How long a toast stays with nothing pressed. */
export const TOAST_MS = 6000;
