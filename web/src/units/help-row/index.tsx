import { ChevronRight, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

/** "about 20 s": the wait as the student reads it. */
export function waitText(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return `about ${String(s)} s`;
  const m = Math.round(s / 60);
  return `about ${String(m)} min`;
}

/** One step of help as a closed row that opens in place (P13). Any number of
 *  rows can be open at once. While the step is still being written the row
 *  says so and when, and does not open (P10). The title is the one word the
 *  row is named by: Hint, Walkthrough, Answer. */
export function HelpRow({
  title,
  state = 'ready',
  seconds = 20,
  open = false,
  onToggle,
  children,
}: {
  title: string;
  state?: 'ready' | 'writing';
  /** How long the writing should take. */
  seconds?: number;
  open?: boolean;
  onToggle?: () => void;
  /** The help text, drawn when the row is open. */
  children?: ReactNode;
}) {
  const writing = state === 'writing';
  const shown = open && !writing;
  return (
    <div className="min-w-0 overflow-hidden rounded-(--ds-radius-control) border border-(--ds-border)">
      <button
        type="button"
        aria-expanded={writing ? undefined : shown}
        aria-busy={writing || undefined}
        onClick={() => {
          if (!writing) onToggle?.();
        }}
        className={`ds-body flex min-h-(--ds-control) w-full min-w-0 items-center gap-2 px-3 py-1 text-left text-(--ds-fg) ${writing ? 'cursor-default' : 'hover:bg-(--ds-hover) active:bg-(--ds-pressed)'}`}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {writing ? (
            <LoaderCircle
              className="size-4 animate-spin text-(--ds-fg-muted) motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <ChevronRight
              className={`size-4 text-(--ds-fg-muted) ${shown ? 'rotate-90' : ''}`}
              aria-hidden
            />
          )}
        </span>
        <span className="min-w-0 truncate font-medium">
          {writing ? (
            <span className="text-(--ds-fg-muted) font-normal">
              Writing the {title.toLowerCase()} · {waitText(seconds)}
            </span>
          ) : (
            title
          )}
        </span>
      </button>
      {shown && (
        <div className="ds-reading min-w-0 border-t border-(--ds-border-muted) px-4 py-3 [overflow-wrap:anywhere]">
          {children}
        </div>
      )}
    </div>
  );
}
