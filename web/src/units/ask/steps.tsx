import {
  BookOpen,
  Calculator,
  ChevronRight,
  Image,
  Search,
  type LucideIcon,
} from 'lucide-react';

import {
  doneLine,
  liveLine,
  summary,
  type CallKind,
  type Block,
} from './types';

const ICONS: Record<CallKind, LucideIcon> = {
  search: Search,
  read: BookOpen,
  look: Image,
  compute: Calculator,
};

const ROW =
  'ds-small flex h-(--ds-small-line) max-w-full items-center gap-2 text-(--ds-fg-muted)';

/** A label for work in progress, in the row's place: the same row as the
 *  steps it gives way to, so nothing moves (ask-d19). */
export function ThinkingRow({ text = 'Thinking' }: { text?: string }) {
  return (
    <p className={ROW}>
      <span className="size-4 shrink-0" aria-hidden />
      <span className="ds-shimmer min-w-0 truncate">{text}</span>
    </p>
  );
}

/** A run of steps, in the place they happened (ask-d15). Running, it is one
 *  row naming the current step with a light sweeping over it; done, the same
 *  row folds the run to a summary that opens to a small timeline. The row is
 *  the same height either way (ask-d17). */
export function StepRow({
  run,
  live,
  open,
  onToggle,
}: {
  run: Extract<Block, { k: 'run' }>;
  /** The answer is still being written and this is its latest part. */
  live: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  if (live)
    return (
      <ThinkingRow text={run.current ? liveLine(run.current) : 'Thinking'} />
    );
  const calls = run.current ? [...run.calls, run.current] : run.calls;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`${ROW} cursor-pointer hover:text-(--ds-fg)`}
      >
        <ChevronRight
          className={`size-4 shrink-0 ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
        <span className="min-w-0 truncate">{summary(calls)}</span>
      </button>
      {open && (
        <ul className="ds-small relative mt-1 ml-0 space-y-1 text-(--ds-fg-muted)">
          <span
            aria-hidden
            className="absolute top-2 bottom-2 left-2 w-px bg-(--ds-border)"
          />
          {calls.map((c, i) => {
            const Icon = ICONS[c.kind];
            return (
              <li key={i} className="relative flex items-start gap-2">
                <span className="z-10 grid h-5 w-4 shrink-0 place-items-center bg-(--ds-bg)">
                  <Icon className="size-3" aria-hidden />
                </span>
                <span className="[overflow-wrap:anywhere]">{doneLine(c)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
