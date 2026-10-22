import { Flag } from 'lucide-react';

import { Tooltip } from '@/units/tooltip';
import { FILL, LINE, type ChipState } from './colors';

export type { ChipState };

export interface Chip {
  id: string;
  /** The book's label, "4.62". */
  label: string;
  /** The short generated title, "RC step response". */
  title: string;
  state: ChipState;
  /** The state in words for the tooltip: "Writing the guide". */
  word: string;
}

/** The whole set as one bar, like GitHub's progress bar: a track 8px tall
 *  with fully rounded ends and one segment per problem, 2px apart. The colour
 *  is the problem's state: done green, started accent, not started the track
 *  colour, working (being found or its guide written) yellow and pulsing,
 *  queued yellow at 40%, failed red. The one you are on has a 2px line under it in its segment's colour, the
 *  width of its segment and 3px below the track, so it never touches a
 *  neighbour. Hover
 *  brightens a segment and names it with its state, such as "4 · RC step
 *  response · Started"; one click jumps there. The bar never wraps. */
export function ProblemStrip({
  chips,
  current,
  summary = false,
  allDone = false,
  onJump,
  onSummary,
}: {
  chips: readonly Chip[];
  current?: string;
  /** The summary is showing: the flag is underlined like a current segment. */
  summary?: boolean;
  /** Every problem is done, so the flag's line is green. */
  allDone?: boolean;
  onJump?: (id: string) => void;
  /** The flag at the end of the bar was pressed. */
  onSummary?: () => void;
}) {
  return (
    <ul className="flex min-w-0" style={{ gap: 2 }}>
      {chips.map((c, i) => {
        const here = c.id === current;
        const name = `${String(i + 1)} \u00b7 ${c.title} \u00b7 ${c.word}`;
        const ends = `${i === 0 ? 'rounded-l-full' : ''} ${i === chips.length - 1 ? 'rounded-r-full' : ''}`;
        return (
          <li key={c.id} className="flex min-w-0 flex-1 [&>span]:w-full">
            <Tooltip text={name}>
              <button
                type="button"
                aria-current={here ? 'step' : undefined}
                aria-label={`Problem ${name}`}
                onClick={() => {
                  onJump?.(c.id);
                }}
                className="group relative flex h-5 w-full min-w-0 items-center"
              >
                <span
                  style={{ background: FILL[c.state] }}
                  className={`block h-2 w-full group-hover:brightness-125 ${ends} ${c.state === 'working' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
                />
                {here && (
                  <span
                    aria-hidden
                    className="absolute left-0 block w-full"
                    style={{ height: 2, bottom: 1, background: LINE[c.state] }}
                  />
                )}
              </button>
            </Tooltip>
          </li>
        );
      })}
      <li className="ml-1 flex shrink-0">
        <Tooltip text="Summary">
          <button
            type="button"
            aria-label="Summary"
            aria-current={summary ? 'step' : undefined}
            onClick={() => {
              onSummary?.();
            }}
            style={{
              color: summary
                ? allDone
                  ? 'var(--ds-success)'
                  : 'var(--ds-fg)'
                : undefined,
            }}
            className={`relative flex h-5 w-5 items-center justify-center ${summary ? '' : 'text-(--ds-fg-muted) hover:text-(--ds-fg)'}`}
          >
            <Flag className="size-3" aria-hidden />
            {summary && (
              <span
                aria-hidden
                className="absolute left-0 block w-full"
                style={{ height: 2, bottom: 1, background: 'currentColor' }}
              />
            )}
          </button>
        </Tooltip>
      </li>
    </ul>
  );
}

/** The strip while the set loads: the track with as many segments as it
 *  will have, in the same heights. */
export function ProblemStripSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      aria-hidden
      className="flex h-5 min-w-0 items-center"
      style={{ gap: 2 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className={`h-2 min-w-0 flex-1 animate-pulse bg-(--ds-border-muted) motion-reduce:animate-none ${i === 0 ? 'rounded-l-full' : ''} ${i === count - 1 ? 'rounded-r-full' : ''}`}
        />
      ))}
      <li className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="size-3.5 animate-pulse rounded-(--ds-radius-segment) bg-(--ds-border-muted) motion-reduce:animate-none" />
      </li>
    </ul>
  );
}
