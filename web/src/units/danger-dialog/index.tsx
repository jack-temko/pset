import { useEffect, useRef, useState } from 'react';

import { Button } from '@/units/button';
import { TextField } from '@/units/text-field';

const WIDTH = 480;

/** The last level of asking (danger-dialog-d1, friction-matches-loss): a
 *  dialog for what is wide and cannot be put back. It says what goes, with
 *  counts, and the red button stays not ready until the student has typed the
 *  word (the course's name, or "reset"). Escape, Cancel or a press on the
 *  backdrop close it. With `inline` (the design page) it sits in the flow
 *  instead of the top layer. */
export function DangerDialog({
  title,
  message,
  word,
  confirmLabel,
  onConfirm,
  onCancel,
  inline,
}: {
  /** What is being done: "Delete ECE 210". */
  title: string;
  /** What goes, with counts: "This deletes 12 sets and 9 materials." */
  message: string;
  /** What the student types to unlock the button: a course's name, or "reset". */
  word: string;
  /** The red button's words: "Delete course". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Sits in the flow, not the top layer (the design page only). */
  inline?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === word;

  useEffect(() => {
    const el = ref.current;
    if (inline || !el) return;
    if (typeof el.showModal === 'function' && !el.open) el.showModal();
  }, [inline]);

  const body = (
    <div className="p-6">
      <h2 className="ds-heading text-(--ds-fg)">{title}</h2>
      <p className="ds-body mt-2 text-(--ds-fg)">{message}</p>
      <div className="mt-4">
        <TextField
          label={`Type ${word} to confirm`}
          value={typed}
          onChange={setTyped}
          note={false}
          autoFocus={!inline}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="danger"
          notReady={matches ? undefined : `Type ${word} first.`}
          onPress={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button onPress={onCancel}>Cancel</Button>
      </div>
    </div>
  );

  const look =
    'rounded-(--ds-radius-control) border border-(--ds-danger) bg-(--ds-bg-raised) text-(--ds-fg)';
  if (inline)
    return (
      <div role="alertdialog" aria-label={title} className={look}>
        {body}
      </div>
    );
  return (
    <dialog
      ref={ref}
      aria-label={title}
      style={{ width: WIDTH }}
      className={`${look} m-auto max-w-[calc(100vw-32px)] backdrop:bg-black/60`}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {body}
    </dialog>
  );
}
