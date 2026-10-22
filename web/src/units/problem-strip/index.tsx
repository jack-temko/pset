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

/** The underline of the current segment: its segment's colour, so it reads
 *  as part of it. A not-started segment is the neutral track, which would
 *  vanish, so its line is the muted text colour. */
const LINE: Record<ChipState, string> = {
  done: 'var(--ds-success)',
  started: 'var(--ds-accent-solid)',
  todo: 'var(--ds-fg-muted)',
  working: 'var(--ds-attention)',
  queued: 'color-mix(in srgb, var(--ds-attention) 40%, transparent)',
  failed: 'var(--ds-danger)',
};

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
  onJump,
}: {
  chips: readonly Chip[];
  current?: string;
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
                  className={`block h-2 w-full group-hover:brightness-125 ${ends} ${LOOK[c.state]}`}
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
