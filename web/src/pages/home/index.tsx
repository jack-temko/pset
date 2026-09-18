import { BookOpen } from 'lucide-react'

import { AppShell, PageShell } from '@/components/shell'
import { BookTile } from '@/components/book-tile'
import { Button } from '@/components/button'
import { Box, BoxFooter, BoxHeader, BoxRow, Counter, RowValue } from '@/components/box'
import { BOOKS, DUE, DUE_TOTAL, type Book, type Due } from '@/lib/sample'
import { cn } from '@/lib/utils'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

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

function Shelf({ books }: { books: Book[] }) {
  return (
    <section className="space-y-5">
      <h2 className="font-heading text-xl">Your books</h2>
      <div className="grid grid-cols-5 items-start gap-6">
        {books.map((b) => (
          <BookTile key={b.sha256} book={b} />
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
        <DueList items={DUE} total={DUE_TOTAL} />
        <Shelf books={BOOKS} />
      </PageShell>
    </AppShell>
  )
}
