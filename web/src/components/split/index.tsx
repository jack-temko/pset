import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react';

import { ResizeHandle } from '@/components/resize-handle';
import { cn } from '@/lib/utils';
import { HALF, leftWidth, SPLIT_MIN } from './width';

const keyOf = (id: string) => `pset-split:${id}`;

/** Storage can throw and a stored value can be anything: halves stand in. */
function read(id: string): number {
  try {
    const n: unknown = JSON.parse(localStorage.getItem(keyOf(id)) ?? 'null');
    if (typeof n === 'number' && n > 0 && n < 1) return n;
  } catch {
    /* halves */
  }
  return HALF;
}

function write(id: string, ratio: number) {
  try {
    localStorage.setItem(keyOf(id), JSON.stringify(ratio));
  } catch {
    /* forgetting is fine */
  }
}

/**
 * Two panes side by side with today's ResizeHandle on the seam. The left
 * pane is the one that is sized; the right takes the rest. The ratio is
 * kept as a fraction of the split's width, saved in this browser under
 * `id` (one per course), and each pane holds at `min`. Each pane scrolls on
 * its own: the split only gives them a box.
 */
export function Split({
  id,
  left,
  right,
  min = SPLIT_MIN,
  className,
}: {
  /** What the saved ratio is filed under: the course. */
  id: string;
  left: ReactNode;
  right: ReactNode;
  min?: number;
  className?: string;
}) {
  const [ratio, setRatio] = useState(() => read(id));
  const [total, setTotal] = useState(0);
  // A callback ref, so the measuring follows the element if it remounts.
  const [el, frame] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!el) return;
    // oxlint-disable-next-line react/set-state-in-effect -- measures the frame before paint, then keeps it measured
    setTotal(el.clientWidth);
    const ro = new ResizeObserver(() => {
      setTotal(el.clientWidth);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [el]);

  const measured = total > 0;
  const width = leftWidth(total, ratio, min);
  // Reads the newest ratio: a key press changes it and commits in one event.
  const commit = useCallback(() => {
    setRatio((r) => (write(id, r), r));
  }, [id]);

  return (
    <div ref={frame} className={cn('flex min-h-0 min-w-0', className)}>
      <div
        style={{ width: measured ? width : `${String(HALF * 100)}%` }}
        className="flex min-w-0 shrink-0 flex-col border-r"
      >
        {left}
      </div>
      <ResizeHandle
        label="Resize the panes"
        pane="before"
        value={width}
        min={min}
        max={Math.max(min, total - min)}
        onChange={(px) => {
          if (measured) setRatio(px / total);
        }}
        onCommit={commit}
        onReset={() => {
          setRatio(HALF);
          write(id, HALF);
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">{right}</div>
    </div>
  );
}
