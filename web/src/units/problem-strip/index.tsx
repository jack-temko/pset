import { Tooltip } from '@/units/tooltip';

export type ChipState = 'todo' | 'done' | 'failed' | 'finding';

export interface Chip {
  id: string;
  /** The book's label, "4.62". */
  label: string;
  /** The short generated title, "RC step response". */
  title: string;
  state: ChipState;
}

const WORD: Record<ChipState, string> = {
  todo: '',
  done: ' · done',
  failed: ' · not found',
  finding: ' · being found',
};

/** The whole set as one bar, like GitHub's progress bar: a track 8px tall
 *  with fully rounded ends and one segment per problem, 2px apart. Done is
 *  the accent, upcoming the track colour, a problem that could not be found
 *  the danger colour, one still being found dashed. The one you are on keeps
 *  its colour and gets a 2px accent outline, offset 2px so it shows on a done
 *  segment. Hover brightens a segment and names it, such as "4 · RC step
 *  response"; one click jumps there. The bar never wraps: with many problems
 *  the segments narrow and the gaps stay 2px. */
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
        const name = `${String(i + 1)} · ${c.title}${WORD[c.state]}`;
        const ends = `${i === 0 ? 'rounded-l-full' : ''} ${i === chips.length - 1 ? 'rounded-r-full' : ''}`;
        const look =
          c.state === 'failed'
            ? 'bg-(--ds-danger)'
            : c.state === 'done'
              ? 'bg-(--ds-accent-solid)'
              : c.state === 'finding'
                ? 'animate-pulse bg-(--ds-border) motion-reduce:animate-none'
                : 'bg-(--ds-border)';
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
                className="group flex h-5 w-full min-w-0 items-center"
              >
                <span
                  className={`block h-2 w-full group-hover:brightness-125 ${ends} ${look} ${here ? 'outline-2 outline-offset-2 outline-solid outline-(--ds-accent)' : ''}`}
                />
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
