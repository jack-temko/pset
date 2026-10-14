import { useLayoutEffect, useRef, useState } from 'react';

/** Above this many problems the bar is one continuous bar (progress-bar-d1). */
export const SEGMENT_MAX = 12;

/** A segment never gets narrower than this: the continuous bar takes over. */
const SEGMENT_MIN = 4;
const SEGMENT_GAP = 2;
/** The gap between the bar and the count. */
const BAR_GAP = 8;

/** How far a set is done: a segment per problem and the count in words
 *  beside it. The count always shows. When room is short the segments
 *  narrow to 4px, then one continuous bar takes over; the bar adapts to its
 *  own width, so nothing outside reaches into it (progress-bar-d2). */
export function ProgressBar({ done, total }: { done: number; total: number }) {
  const shown = Math.min(Math.max(done, 0), Math.max(total, 0));
  const complete = total > 0 && shown === total;
  const fill = complete ? 'bg-(--ds-fg-muted)' : 'bg-(--ds-accent)';

  const root = useRef<HTMLSpanElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  /** The width left for the bar, once measured. */
  const [room, setRoom] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      setRoom(el.clientWidth - (count.current?.offsetWidth ?? 0) - BAR_GAP);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [done, total]);

  const need = total * SEGMENT_MIN + (total - 1) * SEGMENT_GAP;
  const segmented =
    total <= SEGMENT_MAX && (room === undefined || room >= need);
  return (
    <span
      ref={root}
      className="flex w-full max-w-full min-w-0 items-center gap-2"
    >
      {segmented ? (
        <span className="flex min-w-0 shrink gap-0.5" data-bar="segments">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              data-segment={i < shown ? 'done' : 'todo'}
              className={`h-1 w-3 min-w-1 shrink rounded-(--ds-radius-segment) ${i < shown ? fill : 'bg-(--ds-border)'}`}
            />
          ))}
        </span>
      ) : (
        <span
          data-bar="continuous"
          className="h-1 w-[72px] min-w-4 shrink overflow-hidden rounded-(--ds-radius-segment) bg-(--ds-border)"
        >
          <span
            className={`block h-full ${fill}`}
            style={{
              width: `${String(total > 0 ? (shown / total) * 100 : 0)}%`,
            }}
          />
        </span>
      )}
      <span
        ref={count}
        className="ds-small ds-tabular shrink-0 whitespace-nowrap text-(--ds-fg-muted)"
      >
        {shown} of {total}
      </span>
    </span>
  );
}
