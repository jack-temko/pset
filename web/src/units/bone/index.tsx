import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ARRIVE_MS, GRACE_MS } from './rhythm';

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

/** Whether to move: the browser can animate and the student has not asked
 *  for less motion. Tests run where neither exists. */
function moves(el: Element): boolean {
  return (
    'animate' in el &&
    'matchMedia' in window &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** How long a block of text takes to grow to its height when it comes. */
export const GROW_MS = 200;

/** Text that may wrap: a name, a sentence, a memory (bone-d4). While it
 *  loads it is one bar line; when it comes, the block grows smoothly to the
 *  text's height and the text fades in where the bar was, so what is below
 *  slides down instead of jumping. Nothing to count or remember: use it for
 *  any text slot that can wrap. */
export function FillBlock({
  as = 'p',
  className,
  ch,
  row,
  children,
}: {
  /** The element the text is set in. */
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'div' | 'span';
  className?: string;
  ch: number | readonly number[];
  row?: number;
  /** The text; undefined while it is loading. */
  children: ReactNode;
}) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const waiting = children === undefined || children === null;
  // The height while the bar showed, kept until the text comes.
  const was = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (el === null) return;
    const h = el.getBoundingClientRect().height;
    if (waiting) {
      was.current = h;
      return;
    }
    const from = was.current;
    was.current = null;
    if (from === null || Math.abs(from - h) < 0.5 || !moves(el)) return;
    el.animate(
      [
        { height: `${String(from)}px`, overflow: 'hidden' },
        { height: `${String(h)}px`, overflow: 'hidden' },
      ],
      { duration: GROW_MS, easing: 'ease-out' },
    );
  }, [el, waiting]);
  return createElement(
    as,
    {
      ref: setEl,
      className,
      'data-grows': true,
    },
    <Fill ch={ch} row={row}>
      {children}
    </Fill>,
  );
}

/** Where a digit rests on its strip: in the second turn, so a roll can come
 *  up from below it. */
const rest = (d: number) => d + 10;
const isDigit = (c: string) => c >= '0' && c <= '9';

/** A number that rolls to its value like a stock ticker (bone-d5): each
 *  digit spins up from 0 when the number first shows, the ones a full turn
 *  more, and rolls from the old digit when the value changes. Digits keep
 *  their tabular width, so nothing beside it moves. For a figure, not a
 *  count: a one-digit number does not roll, and a count ("2 of 8") is a
 *  Fill. Any text works: only its numbers roll ("92 h", "1 h 10 m"). While
 *  it loads, it is a bar. */
export function Ticker({
  ch,
  children,
}: {
  /** The bar's width while loading. */
  ch: number;
  /** The text; undefined while it is loading. */
  children: string | undefined;
}) {
  const strips = useRef<(HTMLSpanElement | null)[]>([]);
  // What was shown last, so a change rolls from it; null until the first.
  const was = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (children === undefined) return;
    const before = was.current;
    was.current = children;
    if (before === children) return;
    // Each number in the text rolls on its own ("2 of 6"), matched to the
    // old text's numbers from the right.
    const runs = (t: string) => t.match(/\d+/g) ?? [];
    const olds = before === null ? [] : runs(before);
    const news = runs(children);
    let at = 0;
    news.forEach((run, r) => {
      const start = children.indexOf(run, at);
      at = start + run.length;
      // A one-digit number is read at once: it does not roll.
      if (run.length === 1) return;
      const old = olds.at(r - news.length + olds.length);
      for (let j = 0; j < run.length; j++) {
        const k = run.length - 1 - j; // place: 0 for the ones
        const el = strips.current.at(start + j);
        const to = rest(Number(run[j]));
        const prev = old === undefined ? undefined : old.at(old.length - 1 - k);
        // Coming in: up from 0, the ones a turn more. Changing: from the old digit.
        const from =
          prev === undefined
            ? k === 0 && old === undefined
              ? 0
              : 10
            : rest(Number(prev));
        if (el === undefined || el === null || from === to || !moves(el))
          continue;
        el.animate(
          [
            { transform: `translateY(${String(-from * 5)}%)` },
            { transform: `translateY(${String(-to * 5)}%)` },
          ],
          { duration: ARRIVE_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      }
    });
  }, [children]);
  if (children === undefined) return <Bone ch={ch} />;
  return (
    <span className="ds-tabular">
      {children.split('').map((c, i) =>
        isDigit(c) ? (
          <span key={i} className="relative inline-block">
            <span className="invisible">{c}</span>
            <span aria-hidden className="absolute inset-0 overflow-hidden">
              <span
                ref={(el) => {
                  strips.current[i] = el;
                }}
                className="ds-ticker-strip absolute inset-x-0 top-0"
                style={{
                  transform: `translateY(${String(-rest(Number(c)) * 5)}%)`,
                }}
              />
            </span>
          </span>
        ) : (
          c
        ),
      )}
    </span>
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
