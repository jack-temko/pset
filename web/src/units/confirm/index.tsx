import { Button } from '@/units/button';

/** Asks before something is taken away, in place of the button that began it
 *  (confirm-d1). It says what goes, with counts, and has two buttons: the
 *  danger one first, then Cancel. */
export function Confirm({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  /** What goes, with counts: "This deletes 12 sets and 9 materials." */
  message: string;
  /** The danger button's words: "Delete course". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={confirmLabel}
      className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-(--ds-radius-control) border border-(--ds-danger) px-4 py-3"
    >
      <p className="ds-body min-w-0 flex-1 text-(--ds-fg)">{message}</p>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="danger" onPress={onConfirm}>
          {confirmLabel}
        </Button>
        <Button onPress={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
