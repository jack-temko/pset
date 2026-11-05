import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/units/button';

const WIDTH = 360;
const EDGE = 8;

/** Asks before something is taken away (confirm-d2). It says what goes, with
 *  counts, then a danger button and Cancel. Anchored to the button that began
 *  it, it floats in the top layer under that button, so nothing on the page
 *  moves. Outside press or Escape cancels. Without an anchor (the design
 *  page) it sits in the flow. */
export function Confirm({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  anchor,
}: {
  /** What goes, with counts: "This deletes 12 sets and 9 materials." */
  message: string;
  /** The danger button's words: "Delete course". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** The element that began it; the question opens under it, right edges aligned. */
  anchor?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    if (typeof el.showPopover === 'function' && !el.matches(':popover-open'))
      el.showPopover();
    const r = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    setPos({
      x: Math.max(EDGE, Math.min(r.right - WIDTH, vw - WIDTH - EDGE)),
      y: r.bottom + 4,
    });
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!ref.current?.contains(t) && !anchor.contains(t)) onCancel();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', key);
    };
  }, [anchor, onCancel]);

  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label={confirmLabel}
      popover={anchor ? 'manual' : undefined}
      style={
        anchor
          ? {
              left: pos?.x ?? 0,
              top: pos?.y ?? 0,
              right: 'auto',
              bottom: 'auto',
              margin: 0,
              width: WIDTH,
            }
          : undefined
      }
      className={`rounded-(--ds-radius-control) border border-(--ds-danger) bg-(--ds-bg-raised) p-4 text-(--ds-fg) ${anchor ? 'fixed' : ''}`}
    >
      <p className="ds-body">{message}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="danger" onPress={onConfirm}>
          {confirmLabel}
        </Button>
        <Button onPress={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
