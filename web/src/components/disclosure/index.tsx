import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { Spinner } from '@/components/spinner';
import { cn } from '@/lib/utils';

/**
 * A row that opens its content in place: a title, a short fact about what is
 * inside on the right (how long it is), and a chevron. A tap opens it, and it
 * stays open; a tap again closes it. Rows go in a Box, one under another.
 *
 * `busy` is for content that is still being made: the row says so ("Writing")
 * with a spinner and can't be opened, rather than opening onto nothing.
 */
export function Disclosure({
  title,
  meta,
  open,
  onOpenChange,
  busy,
  still,
  keys,
  children,
}: {
  title: ReactNode;
  /** What is inside, in a few words: "2 lines", "5 steps". */
  meta?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set while the content is still being made: what to say ("Writing"). */
  busy?: ReactNode;
  /** With `busy`: nothing is happening yet (queued), so no spinner. */
  still?: boolean;
  /** The key that toggles it, for assistive tech (`aria-keyshortcuts`). */
  keys?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="border-t border-border-muted first:border-t-0">
      <button
        type="button"
        aria-expanded={busy ? undefined : open}
        aria-controls={busy ? undefined : id}
        aria-keyshortcuts={keys}
        disabled={!!busy}
        onClick={() => onOpenChange(!open)}
        className={cn(
          'flex min-h-row w-full items-center gap-3 px-card py-2 text-left text-sm',
          busy ? 'cursor-default' : 'cursor-pointer hover:bg-muted/50',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {busy ? (
            <>
              {busy}
              {!still && <Spinner className="size-3" />}
            </>
          ) : (
            <>
              {meta}
              <ChevronDown
                className={cn(
                  'size-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
                  open && 'rotate-180',
                )}
              />
            </>
          )}
        </span>
      </button>
      {open && !busy && (
        <div
          id={id}
          role="region"
          className="border-t border-border-muted px-card py-3 text-base"
        >
          {children}
        </div>
      )}
    </div>
  );
}
