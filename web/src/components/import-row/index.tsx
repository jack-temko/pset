import { BoxRow } from '@/components/box';
import { BookStatus } from '@/components/book-status';
import { CoverSwatch } from '@/components/book-cover';
import { Button } from '@/components/button';
import { viewOf } from '@/api/client';
import { ErrorNotice } from '@/components/error-notice';
import type { Book } from '@/api/library';

/**
 * A book that is on its way to the shelf: its cloth colour, its title,
 * one line of what is happening, and the controls for exactly that state.
 *
 * | state     | line                              | controls              |
 * |-----------|-----------------------------------|-----------------------|
 * | queued    | Queued                            | Cancel                |
 * | preparing | the phase, its count and a bar    | Stop                  |
 * | failed    | the error notice, in its place    | its action · Dismiss  |
 *
 * Stopping leaves a failed row rather than removing it, so Try again is
 * the undo. Only Try again is outlined: it is the one action here that
 * starts work.
 */
export function ImportRow({
  book,
  onStop,
  onRetry,
  onDismiss,
}: {
  book: Book;
  onStop?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const { state } = book;

  // A failure is the notice, in the row's place: the title and Dismiss
  // above it, and what, why and fix with the way to try again below.
  if (state.kind === 'failed')
    return (
      <div className="space-y-3 border-t border-border-muted px-card py-3 first:border-t-0">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex shrink-0 items-center">
            <CoverSwatch hue={book.cover} />
          </span>
          <span className="min-w-0 flex-1 truncate">{book.title}</span>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
        <ErrorNotice
          error={state.error ?? viewOf('internal.unexpected')}
          onRetry={onRetry}
        />
      </div>
    );

  const trailing =
    state.kind === 'queued' ? (
      <Button variant="ghost" size="sm" onClick={onStop}>
        Cancel
      </Button>
    ) : state.kind === 'preparing' ? (
      <Button variant="ghost" size="sm" onClick={onStop}>
        Stop
      </Button>
    ) : null;

  return (
    <BoxRow
      leading={<CoverSwatch hue={book.cover} />}
      title={book.title}
      description={
        <BookStatus bookId={book.id} state={state} since={book.updatedAt} />
      }
      trailing={trailing}
    />
  );
}
