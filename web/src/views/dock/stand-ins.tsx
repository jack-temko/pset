import { useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { KIND_WORD, type OpenThing, type Place, type Thing } from './things';
import { MATERIAL_LINKS, PAGES, SET_PROBLEMS } from './sample';

/** A line of a page, the same on every page, so a page is a believable
 *  amount of reading and nothing more. */
const LINES = [
  'A periodic signal x(t) with period T can be written as a sum of complex exponentials at multiples of the fundamental frequency.',
  'The coefficient a_k is found by integrating x(t) against the matching exponential over one period and dividing by T.',
  'For a real signal the coefficients come in conjugate pairs, so the series can also be written with sines and cosines.',
  'Convergence needs the Dirichlet conditions: x(t) has finitely many maxima, minima and discontinuities in one period.',
  'At a jump the series settles on the midpoint, and overshoots it by about nine percent however many terms are kept.',
];

/**
 * A stand-in for a material being read (A7 of the dock's grill): ten tall
 * pages that scroll on their own, a bar that says which page it was opened
 * at, and a link or two that ask the dock to open another thing at a page.
 * The real material views are the next track.
 */
export function MaterialStandIn({
  thing,
  place,
  open,
}: {
  thing: Thing;
  place: Place | undefined;
  open: OpenThing;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const links = MATERIAL_LINKS[thing.id] ?? {};

  // Opened at a page: go to it, before the first paint, and again each time
  // the dock is asked (a new place object), even for a tab already open.
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box || !place) return;
    const page = box.querySelector<HTMLElement>(
      `[data-page="${String(place.page)}"]`,
    );
    if (page) box.scrollTop = page.offsetTop - box.offsetTop - 56;
  }, [place]);

  return (
    <div ref={scroller} className="relative h-full overflow-y-auto bg-rail">
      <div className="sticky top-0 z-10 border-b bg-rail px-card py-2 text-sm text-muted-foreground">
        {KIND_WORD[thing.kind].one}.{' '}
        {place ? `Opened at page ${String(place.page)}` : `Opened at the start`}
      </div>
      <div className="space-y-4 p-card">
        {Array.from({ length: PAGES }, (_, i) => i + 1).map((n) => (
          <article
            key={n}
            data-page={n}
            className={cn(
              'space-y-3 rounded-sm border bg-card p-card shadow-sm',
              place?.page === n && 'ring-2 ring-ring',
            )}
          >
            <p className="text-xs text-muted-foreground">Page {n}</p>
            {LINES.map((line, j) => (
              <p key={j} className="text-reading">
                {line}
              </p>
            ))}
            {(links[n] ?? []).map((l) => (
              <p key={l.label} className="text-sm">
                See{' '}
                <button
                  type="button"
                  onClick={() => {
                    open(l.to, { page: l.page });
                  }}
                  className="text-primary underline underline-offset-2"
                >
                  {l.label}
                </button>
                .
              </p>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}

/**
 * A stand-in for a set (A7): problems, each with a link to a page of a
 * material, so "a link followed" can be reached. The real set view is track 3.
 */
export function SetStandIn({ thing, open }: { thing: Thing; open: OpenThing }) {
  const problems = SET_PROBLEMS[thing.id] ?? [];
  return (
    <div className="h-full overflow-y-auto">
      <ol className="space-y-4 p-card">
        {problems.map((p) => (
          <li
            key={p.label}
            className="space-y-2 rounded-md border bg-card p-card"
          >
            <p className="text-sm font-medium">Problem {p.label}</p>
            <p className="text-reading">{p.text}</p>
            <button
              type="button"
              onClick={() => {
                open(p.link.to, { page: p.link.page });
              }}
              className="text-sm text-primary underline underline-offset-2"
            >
              {p.link.label}
            </button>
          </li>
        ))}
        {problems.length === 0 && (
          <li className="text-sm text-muted-foreground">No problems yet.</li>
        )}
      </ol>
    </div>
  );
}

/** What the dock draws for a thing in this view: a set as a set, anything
 *  else as a page being read. */
export function StandIn({
  thing,
  place,
  open,
}: {
  thing: Thing;
  place: Place | undefined;
  open: OpenThing;
}) {
  return thing.kind === 'set' ? (
    <SetStandIn thing={thing} open={open} />
  ) : (
    <MaterialStandIn thing={thing} place={place} open={open} />
  );
}
