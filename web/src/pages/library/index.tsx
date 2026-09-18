import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, LoaderCircle, Search } from 'lucide-react'

import { BookCover } from '@/components/book-cover'
import { PageShell } from '@/components/page-shell'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useBooks } from '@/hooks/use-books'
import { coverHueFromSha } from '@/lib/covers'
import { cn } from '@/lib/utils'
import { useTasks } from '@/lib/events'
import { bookMissingLine, taskHeadline, taskStateLabel } from '@/lib/tasks'
import type { Book } from '@/lib/types'

import { ImportDialog } from './import-dialog'

/**
 * A shelf holds ready books and books on their way, and never pretends the
 * second kind is the first: a book that isn't ready is dimmed, says so, and
 * says why. A failed import that merely lost its spinner would look exactly
 * like a finished book, which is how the old shelf lied.
 */
function BookCard({ book }: { book: Book }) {
  const author = book.author || book.subject
  const task = book.task
  const preparing = task?.status === 'running' || task?.status === 'queued'
  const line = task
    ? preparing
      ? taskHeadline(task)
      : (task.error ?? taskStateLabel(task))
    : bookMissingLine(book)

  return (
    <Link
      to={`/library/${book.sha256}`}
      className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full gap-3 p-card">
        {/* the cover lifts off the shelf; the card stays put. The cover's
            plate carries the title and author, so the card body only holds
            the facts the cover can't show. */}
        <div
          className={cn(
            'relative rounded-lg transition-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_12px_20px_-14px_rgb(0_0_0/0.4)] group-focus-visible:-translate-y-1',
            !book.ready && 'opacity-55',
          )}
        >
          <BookCover title={book.title} author={author} hue={coverHueFromSha(book.sha256)} />
          {preparing ? (
            <span
              title={line ?? undefined}
              className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur"
            >
              <LoaderCircle aria-hidden className="size-4 animate-spin text-primary" />
            </span>
          ) : null}
        </div>
        <CardContent className="space-y-1 p-0">
          <div className="text-sm text-muted-foreground">
            {book.kind === 'scanned' ? 'Scanned' : 'Digital'} ·{' '}
            <span className="font-mono">{book.pageCount.toLocaleString()}</span> pages
          </div>
          {!book.ready ? (
            <p
              className={cn(
                'truncate text-xs',
                task?.status === 'failed' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {line ?? 'Not ready yet'}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  )
}

function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4 2xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i} className="h-full gap-3 p-card">
          <Skeleton className="aspect-3/4 w-full rounded-lg" />
          <CardContent className="p-0">
            <Skeleton className="h-4 w-2/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function Library() {
  const { books, loading, error, refetch } = useBooks()
  const { tasks } = useTasks()
  const [query, setQuery] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [importOpen, setImportOpen] = useState(searchParams.get('import') === '1')

  // /?import=1 arrives from off-page (Ask's empty state); consume it so the
  // URL is clean and a refresh doesn't reopen the dialog.
  useEffect(() => {
    if (searchParams.has('import')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  // Refresh the grid when a task that was running stops running. Comparing
  // identities rather than counts matters: one task finishing as another
  // starts leaves the count unchanged, and the old shelf never refreshed.
  const prevRunning = useRef<string | null>(null)
  const runningIds = (tasks ?? [])
    .filter((t) => t.status === 'running' || t.status === 'queued')
    .map((t) => t.id)
    .join(',')
  useEffect(() => {
    const prev = prevRunning.current
    prevRunning.current = runningIds
    if (prev !== null && prev !== runningIds) refetch()
  }, [runningIds, refetch])

  const filtered = useMemo(() => {
    if (!books) return []
    const q = query.trim().toLowerCase()
    if (!q) return books
    return books.filter((b) => [b.title, b.author].some((v) => v.toLowerCase().includes(q)))
  }, [books, query])

  const empty = !loading && !error && books !== null && books.length === 0
  const totalPages = books?.reduce((n, b) => n + b.pageCount, 0) ?? 0

  return (
    <PageShell
      title="Your library"
      description="Every book you’ve added, ready to open, search and study."
      actions={
        !empty && (
          <Button onClick={() => setImportOpen(true)}>Import</Button>
        )
      }
    >

      {!empty && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, author…"
              className="pl-9"
              aria-label="Search library"
            />
          </div>
          {books && books.length > 0 && (
            <p className="shrink-0 text-xs text-muted-foreground">
              {books.length} {books.length === 1 ? 'book' : 'books'} ·{' '}
              <span className="font-mono">{totalPages.toLocaleString()}</span> pages
            </p>
          )}
        </div>
      )}

      {loading ? (
        <LibrarySkeleton />
      ) : error ? (
        <ErrorState title="Couldn’t load your library." message={error.message} onRetry={refetch} />
      ) : empty ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="Add your first textbook"
          message="Drop in a PDF and its pages become searchable and ready to study."
          action={
            <Button onClick={() => setImportOpen(true)}>Import a PDF</Button>
          }
        />
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-3 gap-4 2xl:grid-cols-4">
          {filtered.map((b) => (
            <BookCard key={b.sha256} book={b} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-24 text-center">
          <p className="font-heading text-lg">No books match “{query}”.</p>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setQuery('')}>
            Clear search
          </Button>
        </div>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </PageShell>
  )
}
