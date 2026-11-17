import { useContext, useLayoutEffect, useRef } from 'react';

import { ARRIVE_MS, Arriving, moves } from './arrival';

/** Where a digit rests on its strip: in the second turn, so a roll can come
 *  up from below it. */
const rest = (d: number) => d + 10;
const isDigit = (c: string) => c >= '0' && c <= '9';

/** A number that rolls to its value like a stock ticker (bone-d5): each
 *  digit spins up from 0 when the number first shows as its screen arrives
 *  (loading D3), the ones a full turn more, and rolls from the old digit when the value changes. Digits keep
 *  their tabular width, so nothing beside it moves. For a figure, not a
 *  count: a one-digit number does not roll, and a count ("2 of 8") is
 *  plain text. Any text works: only its numbers roll ("92 h", "1 h 10 m"). */
export function Ticker({ children }: { children: string }) {
  const arriving = useContext(Arriving);
  const strips = useRef<(HTMLSpanElement | null)[]>([]);
  // What was shown last, so a change rolls from it; null until the first.
  const was = useRef<string | null>(null);
  useLayoutEffect(() => {
    const before = was.current;
    was.current = children;
    if (before === children) return;
    // A first show rolls only as its screen arrives (loading D3).
    if (before === null && !arriving) return;
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
  }, [children, arriving]);
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
