import { useCallback, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, ListTodo, ListTree, MessagesSquare } from 'lucide-react'

import { BookCover } from '@/components/book-cover'
import { BookReadiness } from '@/components/book-readiness'
import { RemoveBookButton } from '@/components/remove-book-button'
import { TaskSectionLabel } from '@/components/task-row'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { useBook } from '@/hooks/use-book'
import { useBookSections } from '@/hooks/use-book-sections'
import { useBookConversations } from '@/hooks/use-conversations'
import { useHomeworks } from '@/hooks/use-homeworks'
import { useTaskSettled, useTasks } from '@/lib/events'
import type { Section } from '@/lib/types'
import { coverHueFromSha } from '@/lib/covers'
import { formatBytes, formatDate, relTime } from '@/lib/format'
import { cn } from '@/lib/utils'

function BookDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-section px-page py-10">
      <Skeleton className="h-6 w-24 rounded-md" />
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <Skeleton className="aspect-3/4 w-36 shrink-0 rounded-lg sm:w-44 md:w-52" />
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="h-5 w-24 rounded-4xl" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
    </div>
  )
}

const TOC_PREVIEW_COUNT = 40

/** The chapter list, each row a door into the reader at its start page. */
function TocList({ sha, sections }: { sha: string; sections: Section[] }) {
  const [expanded, setExpanded] = useState(false)
  const shallowest = sections.reduce((min, s) => Math.min(min, s.level), Number.POSITIVE_INFINITY)
  const visible = expanded ? sections : sections.slice(0, TOC_PREVIEW_COUNT)
  const hidden = sections.length - visible.length
  return (
    <div className="py-1">
      {visible.map((s) => (
        <Link
          key={s.sortOrder}
          to={`/library/${sha}/read?page=${s.startPage}`}
          title={`Open page ${s.startPage} in the reader`}
          className="flex items-baseline gap-2 rounded-md py-2 pr-5 transition-colors hover:bg-muted/60"
          style={{ paddingLeft: `calc(1.25rem + ${(s.level - shallowest) * 0.875}rem)` }}
        >
          <span
            title={s.title}
            className={cn(
              'min-w-0 truncate',
              s.level === shallowest ? 'font-medium' : 'text-muted-foreground',
            )}
          >
            {s.title}
          </span>
          <span aria-hidden className="min-w-6 flex-1 border-b-2 border-dotted border-border" />
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {s.startPage === s.endPage ? s.startPage : `${s.startPage}–${s.endPage}`}
          </span>
        </Link>
      ))}
      {hidden > 0 && (
        <div className="flex justify-center px-5 py-3">
          <Button variant="ghost" size="xs" onClick={() => setExpanded(true)}>
            Show all {sections.length.toLocaleString()} entries
          </Button>
        </div>
      )}
    </div>
  )
}

function ActivityRow({
  to,
  title,
  meta,
  icon,
}: {
  to: string
  title: string
  meta: string
  icon: ReactNode
}) {
  return (
    <Link
      to={to}
      className="mx-2 flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm" title={title}>
        {title}
      </span>
      <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">{meta}</span>
    </Link>
  )
}

/** What has happened with this book: its asks and its homework. */
function ActivitySection({ sha }: { sha: string }) {
  const {
    conversations,
    loading: convLoading,
    error: convError,
    refetch: refetchConv,
  } = useBookConversations(sha)
  const { homeworks, loading: hwLoading, error: hwError, refetch: refetchHw } = useHomeworks()

  const asks = (conversations ?? [])
    .slice()
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
  const sets = (homeworks ?? [])
    .filter((h) => h.bookSha256 === sha)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const loading = convLoading || hwLoading
  const error = convError ?? hwError
  const refetch = () => {
    refetchConv()
    refetchHw()
  }

  let body
  if (loading) {
    body = (
      <div className="space-y-2 px-4 py-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" style={{ width: `${94 - i * 9}%` }} />
        ))}
      </div>
    )
  } else if (error) {
    body = (
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
        <Button variant="outline" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    )
  } else if (asks.length === 0 && sets.length === 0) {
    body = (
      <p className="px-5 py-6 text-sm text-muted-foreground">
        No questions or homework yet. Ask about this book or set homework from it, and it shows up
        here.
      </p>
    )
  } else {
    body = (
      <div className="py-2">
        {asks.map((c) => (
          <ActivityRow
            key={c.id}
            to={`/ask?c=${c.id}`}
            title={c.title}
            meta={relTime(c.lastActivityAt || c.createdAt)}
            icon={<MessagesSquare className="size-4" />}
          />
        ))}
        {sets.map((h) => (
          <ActivityRow
            key={h.id}
            to={`/homework/${h.id}`}
            title={h.title}
            meta={
              h.status === 'generating'
                ? 'Building…'
                : `${h.questionCount} ${h.questionCount === 1 ? 'question' : 'questions'}`
            }
            icon={<ListTodo className="size-4" />}
          />
        ))}
      </div>
    )
  }

  const count = loading ? 0 : asks.length + sets.length
  return (
    <section className="space-y-3">
      <TaskSectionLabel label="Activity" count={count} />
      <Card>
        <CardContent className="p-0">{body}</CardContent>
      </Card>
    </section>
  )
}

export function BookDetail() {
  const { bookId } = useParams()
  return <BookDetailView key={bookId ?? 'none'} bookId={bookId} />
}

function BookDetailView({ bookId }: { bookId: string | undefined }) {
  const { book, loading, error, refetch } = useBook(bookId)
  const {
    sections,
    loading: sectionsLoading,
    error: sectionsError,
    refetch: refetchSections,
  } = useBookSections(book?.sha256)
  const { taskForBook } = useTasks()
  const task = book ? taskForBook(book.id) : null

  const refetchStructure = useCallback(() => {
    refetch()
    refetchSections()
  }, [refetch, refetchSections])

  // One task prepares the whole book, so one settle refetches everything it
  // could have changed.
  useTaskSettled(task, refetchStructure)

  if (loading) return <BookDetailSkeleton />

  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="mx-auto max-w-3xl px-page py-20 text-center">
          <h1 className="font-heading text-2xl">Book not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No book in the library matches <span className="font-mono">{bookId}</span>.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link to="/">
              <ArrowLeft /> Back to library
            </Link>
          </Button>
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-3xl px-page py-20 text-center">
        <Badge variant="destructive">Error</Badge>
        <h1 className="mt-3 font-heading text-2xl">Couldn’t load this book.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button variant="outline" onClick={refetch} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  if (!book) return null

  const author = book.author || book.subject
  const inferredCount = sections?.filter((s) => s.source === 'inferred').length ?? 0
  const outlineCount = (sections?.length ?? 0) - inferredCount
  const hasSections = sections !== null && sections.length > 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-section px-page py-10">
      <Button variant="ghost" size="sm" asChild className="-mb-6 text-muted-foreground">
        <Link to="/">
          <ArrowLeft /> Library
        </Link>
      </Button>

      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="w-36 shrink-0 sm:w-44 md:w-52">
          <BookCover title={book.title} author={author} hue={coverHueFromSha(book.sha256)} />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            {book.subject && <Badge variant="secondary">{book.subject}</Badge>}
            <h1 className="font-heading text-4xl font-medium tracking-tight text-balance">
              {book.title}
            </h1>
            {author && <p className="text-muted-foreground">{author}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span>
              <span className="font-mono text-foreground">{book.pageCount.toLocaleString()}</span>{' '}
              pages
            </span>
            <span className="font-mono text-xs">{formatBytes(book.fileSize)}</span>
            <span>
              Imported{' '}
              <span className="font-mono text-xs text-foreground">
                {formatDate(book.importedAt)}
              </span>
            </span>
          </div>
          {book.ready && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button asChild>
                <Link to={`/library/${book.sha256}/read`}>
                  <BookOpen /> Open reader
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/ask?book=${book.sha256}`}>
                  <MessagesSquare /> Ask about this book
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/homework?book=${book.sha256}`}>
                  <ListTodo /> Set homework
                </Link>
              </Button>
              {/* Removing stays reachable for a ready book — it is the
                  deliberate undo, and hiding it would make the only deleting
                  door harder to find than the accidental ones. */}
              <RemoveBookButton bookId={book.sha256} title={book.title} />
            </div>
          )}
        </div>
      </div>

      <BookReadiness book={book} onChanged={refetchStructure} />

      <section className="space-y-3">
        <TaskSectionLabel label="Chapters" count={sections?.length ?? 0} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Table of contents</CardTitle>
            <CardDescription>
              {hasSections
                ? inferredCount === 0
                  ? 'Read from the PDF’s built-in outline. Pick a chapter to open it in the reader.'
                  : inferredCount === sections.length
                    ? 'No outline in this PDF, so chapters were inferred from the page text. Pick one to open it in the reader.'
                    : `${outlineCount.toLocaleString()} from the PDF outline · ${inferredCount.toLocaleString()} inferred from the page text.`
                : 'Chapters, sections and page ranges for quick navigation.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {sectionsLoading ? (
              <div className="divide-y">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3">
                    <Skeleton className="h-4" style={{ width: `${72 - (i % 3) * 14}%` }} />
                    <Skeleton className="ml-auto h-3 w-12" />
                  </div>
                ))}
              </div>
            ) : sectionsError ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <Badge variant="destructive">Error</Badge>
                <p className="max-w-prose text-sm text-muted-foreground">
                  {sectionsError.message}
                </p>
                <Button variant="outline" size="sm" onClick={refetchSections} className="mt-1">
                  Retry
                </Button>
              </div>
            ) : !book.ready && !hasSections ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <ListTree className="size-5" />
                </div>
                <p className="font-heading text-lg">Not worked out yet.</p>
                <p className="max-w-prose text-sm text-muted-foreground">
                  The chapters appear once this book has finished being prepared.
                </p>
              </div>
            ) : hasSections ? (
              <TocList sha={book.sha256} sections={sections} />
            ) : (
              <div className="px-5 py-6 text-sm text-muted-foreground">No sections found.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <ActivitySection sha={book.sha256} />

      <section className="space-y-3">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          File details
        </h3>
        <Card>
          <CardContent className="space-y-3 text-xs">
            {(
              [
                ['SHA-256', book.sha256],
                ['Library copy', book.libraryPath],
                ['Original file', book.originPath],
                ['Page count', `${book.pageCount.toLocaleString()} pages`],
                ['Page size', `${book.pageWidth} × ${book.pageHeight} pt`],
                ['PDF version', book.pdfVersion],
                ['File size', formatBytes(book.fileSize)],
                ['Imported', formatDate(book.importedAt)],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div
                key={k}
                className="flex items-baseline justify-between gap-6 border-b pb-3 last:border-0"
              >
                <span className="shrink-0 text-muted-foreground">{k}</span>
                <span className="text-right font-mono break-all">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
