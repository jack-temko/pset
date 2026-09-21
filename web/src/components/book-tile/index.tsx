import { Link } from 'react-router-dom'

import { BookCover } from '@/components/book-cover'
import { coverHueFromSha } from '@/lib/covers'
import type { Book } from '@/api/library'

/**
 * A book on a shelf: the cover is the card, and it is always a link.
 *
 * The shelf only ever holds books you can open. A book on its way there
 * lives in an `ImportRow` above the shelf instead, so a tile never needs
 * a caption, never reserves space for one, and a shelf of ready books is
 * nothing but covers.
 */
export function BookTile({ book }: { book: Book }) {
  return (
    <Link to={`/books/${book.id}`} className="group block rounded-md">
      <BookCover
        title={book.title}
        author={book.author}
        hue={coverHueFromSha(book.sha256)}
        className="transition duration-150 ease-out group-hover:-translate-y-1 group-hover:shadow-lift motion-reduce:transition-none"
      />
    </Link>
  )
}
