import { Link } from 'react-router-dom'

import { BookCover } from '@/components/book-cover'
import { BookStatus, isReady } from '@/components/book-status'
import { coverHueFromSha } from '@/lib/covers'
import type { Book } from '@/lib/sample'
import { cn } from '@/lib/utils'

/**
 * A book on a shelf: the cover is the card.
 *
 * A ready book is a link and says nothing — the cover carries the title, so
 * a caption would only repeat it. A book that isn't ready is dimmed, isn't a
 * link, and says why. A shelf that doesn't lie.
 */
export function BookTile({ book }: { book: Book }) {
  const cover = (
    <BookCover
      title={book.title}
      author={book.author}
      hue={coverHueFromSha(book.sha256)}
      className={cn(isReady(book.state) && 'group-hover:-translate-y-1 group-hover:shadow-lift')}
    />
  )

  if (!isReady(book.state)) {
    return (
      <div className="space-y-3">
        <div className="opacity-60">{cover}</div>
        <BookStatus state={book.state} />
      </div>
    )
  }

  return (
    <Link to={`/books/${book.sha256}`} className="group block rounded-md">
      {cover}
    </Link>
  )
}
