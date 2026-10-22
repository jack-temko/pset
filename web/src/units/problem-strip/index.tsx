import { Tooltip } from '@/units/tooltip';

/** Where a problem stands, from the student's side (one set of colours, used
 *  by every way of marking the current one). */
export type ChipState =
  | 'done'
  | 'started'
  | 'todo'
  | 'working'
  | 'queued'
  | 'failed';

export type Marker = 'underline' | 'taller' | 'inset';

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

const LOOK: Record<ChipState, string> = {
  done: 'bg-(--ds-success)',
  started: 'bg-(--ds-accent-solid)',
  todo: 'bg-(--ds-border)',
  working: 'animate-pulse bg-(--ds-attention) motion-reduce:animate-none',
  queued: 'bg-[color-mix(in_srgb,var(--ds-attention)_40%,transparent)]',
  failed: 'bg-(--ds-danger)',
};

/** The whole set as one bar, like GitHub's progress bar: a track 8px tall
 *  with fully rounded ends and one segment per problem, 2px apart. The colour
 *  is the problem's state: done green, started accent, not started the track
 *  colour, working (being found or its guide written) yellow and pulsing,
 *  queued yellow at 40%, failed red. The one you are on is marked in one of
 *  three ways that never touch a neighbour: an accent line under it, a
 *  segment 4px taller, or an inner outline in the text colour. Hover
 *  brightens a segment and names it with its state, such as "4 · RC step
 *  response · Started"; one click jumps there. The bar never wraps. */
export function ProblemStrip({
  chips,
  current,
  marker = 'underline',
  onJump,
}: {
  chips: readonly Chip[];
  current?: string;
  marker?: Marker;
  onJump?: (id: string) => void;
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
                  style={
                    here && marker === 'inset'
                      ? { boxShadow: 'inset 0 0 0 2px var(--ds-fg)' }
                      : undefined
                  }
                  className={`block w-full group-hover:brightness-125 ${here && marker === 'taller' ? 'h-3' : 'h-2'} ${ends} ${LOOK[c.state]}`}
                />
                {here && marker === 'underline' && (
                  <span
                    aria-hidden
                    className="absolute left-0 block w-full bg-(--ds-accent)"
                    style={{ height: 2, bottom: 1 }}
                  />
                )}
              </button>
            </Tooltip>
          </li>
        );
      })}
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
    </ul>
  );
}
