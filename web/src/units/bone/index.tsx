import { useEffect, useRef, type ReactNode } from 'react';

import { GRACE_MS } from './rhythm';

const widthOf = (ch: number | readonly number[], row = 0) =>
  typeof ch === 'number' ? ch : (ch.at(row % ch.length) ?? 8);

/** A bar where text will be (bone-d1). It is one line of the text style it
 *  sits in and has no height of its own, so it cannot size a box; its width
 *  is in ch and never passes its slot. The only place a bar is drawn. */
export function Bone({
  ch,
  row,
  pill,
  still,
}: {
  /** The width in ch, or a rhythm of widths picked by `row`. */
  ch: number | readonly number[];
  row?: number;
  /** A tag's or a counter's shape: a full-height rounded bar. */
  pill?: boolean;
  /** No pulse: a wait that is work in progress (Finding, a page drawing). */
  still?: boolean;
}) {
  return (
    <span
      aria-hidden
      data-bone
      className={`ds-bone ${pill === true ? 'ds-bone-pill' : ''} ${still === true ? 'ds-bone-still' : ''}`}
      style={{ width: `${String(widthOf(ch, row))}ch` }}
    />
  );
}

/** A value, or the bar that holds its place until it comes. A value that
 *  replaces a bar the student could see (after the grace) fades in over
 *  150ms; one that came inside the grace just appears (bone-d2). */
export function Fill({
  ch,
  row,
  children,
}: {
  ch: number | readonly number[];
  row?: number;
  /** The value; undefined while it is loading. */
  children: ReactNode;
}) {
  const waiting = children === undefined || children === null;
  // Set once the bar has been up for the grace: only then could it be seen.
  const seen = useRef(false);
  useEffect(() => {
    if (!waiting) return;
    const t = window.setTimeout(() => {
      seen.current = true;
    }, GRACE_MS);
    return () => {
      window.clearTimeout(t);
    };
  }, [waiting]);
  if (waiting) return <Bone ch={ch} row={row} />;
  // oxlint-disable-next-line react-hooks/refs -- read once to pick the fade; a stale read only skips a 150ms fade
  return seen.current ? (
    <span className="ds-fill-in">{children}</span>
  ) : (
    children
  );
}

/** For what is not text (a chart, a page): fills the box its parent made,
 *  and adds no size of its own. */
export function BoneBlock({ still }: { still?: boolean }) {
  return (
    <span
      aria-hidden
      data-bone
      className={`ds-bone-block ${still === true ? 'ds-bone-still' : ''}`}
    />
  );
}
