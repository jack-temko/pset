import { BoxRow } from '@/components/box'
import { BookStatus } from '@/components/book-status'
import { CoverSwatch } from '@/components/book-cover'
import { Button } from '@/components/button'
import type { Book } from '@/api/library'

/**
 * A book that is on its way to the shelf: its cloth colour, its title,
 * one line of what is happening, and the controls for exactly that state.
 *
 * | state     | line                              | controls              |
 * |-----------|-----------------------------------|-----------------------|
 * | queued    | Queued                            | Cancel                |
 * | preparing | the phase, its count and a bar    | Stop                  |
 * | failed    | the engine's own sentence         | Try again · Dismiss   |
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
  book: Book
  onStop?: () => void
  onRetry?: () => void
  onDismiss?: () => void
}) {
  const { state } = book

  const trailing =
    state.kind === 'failed' ? (
      <span className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </span>
    ) : state.kind === 'queued' ? (
      <Button variant="ghost" size="sm" onClick={onStop}>
        Cancel
      </Button>
    ) : state.kind === 'preparing' ? (
      <Button variant="ghost" size="sm" onClick={onStop}>
        Stop
      </Button>
    ) : null

  return (
    <BoxRow
      leading={<CoverSwatch hue={book.cover} />}
      title={book.title}
      description={<BookStatus bookId={book.id} state={state} />}
      trailing={trailing}
    />
  )
}
