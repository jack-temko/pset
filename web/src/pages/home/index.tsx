import { BookOpen, Check } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AppShell, PageShell } from '@/components/shell'
import { BookCover } from '@/components/book-cover'
import { Button } from '@/components/button'
import { Box, BoxFooter, BoxHeader, BoxRow, Counter, RowValue } from '@/components/box'
import { coverHueFromSha } from '@/lib/covers'
import { cn } from '@/lib/utils'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export type Due = {
  id: string
  title: string
  book: string
  questions: number
  /** Plain words, already relative: "today", "tomorrow", "Fri". */
  due: string
  /** Due today or overdue — the row's date takes warning ink. */
  urgent?: boolean
}

// Sample until the backend for this page lands.
const SAMPLE: Due[] = [
  { id: '1', title: 'Problem set 4', book: 'Linear Algebra Done Right', questions: 8, due: 'today', urgent: true },
  { id: '2', title: 'Chapter 3 exercises', book: 'Nonlinear Dynamics and Chaos', questions: 5, due: 'tomorrow' },
  { id: '3', title: 'Lab report 2', book: 'Introduction to Electrodynamics', questions: 3, due: 'Fri' },
]

/** What is due across every book — the first thing on the page, because it
 *  is the only thing with a deadline. */
function DueList({ items, total }: { items: Due[]; total: number }) {
  return (
    <Box>
      <BoxHeader>
        <span>
          Due
          <Counter>{total}</Counter>
        </span>
        <Button variant="outline" size="sm">
          New homework
        </Button>
      </BoxHeader>
      {items.map((d) => (
        <BoxRow
          key={d.id}
          href={`/homework/${d.id}`}
          leading={<BookOpen />}
          title={d.title}
          description={`${d.book} · ${d.questions} questions`}
          trailing={<RowValue className={cn(d.urgent && 'text-warning')}>{d.due}</RowValue>}
        />
      ))}
      {total > items.length && (
        <BoxFooter>
          <span>
            Showing {items.length} of {total}
          </span>
        </BoxFooter>
      )}
    </Box>
  )
}

export type Book = {
  sha256: string
  title: string
  author: string
  /** Not ready means the cover is dimmed and inert, with the reason under it. */
  ready: boolean
  /** While preparing: pages read so far, and the total. */
  progress?: { done: number; total: number }
}

// Sample until the backend for this page lands.
const BOOKS: Book[] = [
  { sha256: '4f1a9c2e', title: 'Linear Algebra Done Right', author: 'Sheldon Axler', ready: true },
  { sha256: '7a3b81d0', title: 'Nonlinear Dynamics and Chaos', author: 'Steven Strogatz', ready: true },
  { sha256: '93c07f45', title: 'Introduction to Electrodynamics', author: 'David Griffiths', ready: true },
  { sha256: 'b82e14aa', title: 'Principles of Mathematical Analysis', author: 'Walter Rudin', ready: true },
  {
    sha256: 'c59d3b72',
    title: 'Introduction to the Theory of Computation',
    author: 'Michael Sipser',
    ready: false,
    progress: { done: 140, total: 312 },
  },
]

/** One tile: the cover is the card, and the line under it says whether the
 *  book can be used. A book that isn't ready is dimmed and isn't a link — a
 *  shelf that doesn't lie. */
function ShelfTile({ book }: { book: Book }) {
  const cover = (
    <BookCover
      title={book.title}
      author={book.author}
      hue={coverHueFromSha(book.sha256)}
      className="transition duration-150 ease-out group-hover:-translate-y-1 group-hover:shadow-lift"
    />
  )

  if (!book.ready) {
    const { done = 0, total = 1 } = book.progress ?? {}
    return (
      <div className="space-y-3">
        <div className="opacity-60">
          <BookCover
            title={book.title}
            author={book.author}
            hue={coverHueFromSha(book.sha256)}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-warning">
            Preparing · {done} of {total}
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <Link to={`/books/${book.sha256}`} className="group space-y-3 rounded-md">
      {cover}
      <p className="flex items-center gap-2 text-xs text-success">
        <Check className="size-4 shrink-0" />
        Ready
      </p>
    </Link>
  )
}

function Shelf({ books }: { books: Book[] }) {
  return (
    <section className="space-y-5">
      <h2 className="font-heading text-xl">Your books</h2>
      <div className="grid grid-cols-5 gap-6">
        {books.map((b) => (
          <ShelfTile key={b.sha256} book={b} />
        ))}
      </div>
    </section>
  )
}

/**
 * Home. The greeting, what's due across every book, then the shelf — and,
 * once it has a backend, this week's numbers. The top bar's middle is empty
 * here: you are home, and the greeting says so.
 */
export function Home() {
  return (
    <AppShell>
      <PageShell>
        <h1 className="font-heading text-4xl">{greeting(new Date().getHours())}.</h1>
        <DueList items={SAMPLE} total={9} />
        <Shelf books={BOOKS} />
      </PageShell>
    </AppShell>
  )
}
