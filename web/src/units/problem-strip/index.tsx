import { Tooltip } from '@/units/tooltip';

export type ChipState = 'todo' | 'done' | 'failed' | 'finding';

export interface Chip {
  id: string;
  /** The book's label, "3.1 #7": shown on hover. */
  label: string;
  state: ChipState;
}

const LOOKS: Record<ChipState, string> = {
  todo: 'border-(--ds-border) text-(--ds-fg) hover:bg-(--ds-hover)',
  done: 'border-transparent bg-(--ds-accent-solid) text-(--ds-on-accent) hover:bg-(--ds-accent-solid-hover)',
  failed: 'border-(--ds-danger) text-(--ds-danger) hover:bg-(--ds-danger-soft)',
  finding:
    'border-dashed border-(--ds-border) text-(--ds-fg-muted) hover:bg-(--ds-hover)',
};

const WORD: Record<ChipState, string> = {
  todo: '',
  done: ' · done',
  failed: ' · not found',
  finding: ' · being found',
};

/** The whole set in one line of numbered chips (P1): done filled, the one you
 *  are on outlined in the accent, one that could not be found in the danger
 *  colour, one still being found dashed. Hover names a chip by its label and
 *  its state; one click jumps there. The strip wraps to more rows for a
 *  long set. */
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
    <ul className="flex min-w-0 flex-wrap gap-1">
      {chips.map((c, i) => {
        const here = c.id === current;
        return (
          <li key={c.id} className="flex">
            <Tooltip text={`${c.label}${WORD[c.state]}`}>
              <button
                type="button"
                aria-current={here ? 'step' : undefined}
                aria-label={`Problem ${String(i + 1)}, ${c.label}${WORD[c.state]}`}
                onClick={() => {
                  onJump?.(c.id);
                }}
                className={`ds-small ds-tabular inline-flex h-(--ds-control) min-w-(--ds-control) items-center justify-center rounded-(--ds-radius-control) border px-2 ${LOOKS[c.state]} ${here ? 'outline-2 outline-offset-1 outline-solid outline-(--ds-accent)' : ''}`}
              >
                {i + 1}
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

/** The strip while the set loads: as many chips as it will have, so it does
 *  not change height. */
export function ProblemStripSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul aria-hidden className="flex min-w-0 flex-wrap gap-1">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="h-(--ds-control) w-(--ds-control) animate-pulse rounded-(--ds-radius-control) bg-(--ds-border-muted) motion-reduce:animate-none"
        />
      ))}
    </ul>
  );
}
