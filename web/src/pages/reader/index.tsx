import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  ScanText,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useBook, useBookPage } from '@/hooks/use-book'
import { useBookSections } from '@/hooks/use-book-sections'
import { useTaskSettled, useTasks } from '@/lib/events'
import { api, ApiError } from '@/lib/api'
import type { Section } from '@/lib/types'
import { cn } from '@/lib/utils'

function splitParagraphs(text: string): string[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (blocks.length > 0) return blocks
  return text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function PageSkeleton() {
  return (
    <div className="mt-6 space-y-5">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${96 - (i % 3) * 9}%` }} />
      ))}
    </div>
  )
}

/** Where this book's resume page lives. */
const lastPageKey = (sha: string) => `pset:reader:last-page:${sha}`

function readLastPage(sha: string): number | null {
  try {
    const n = Number.parseInt(localStorage.getItem(lastPageKey(sha)) ?? '', 10)
    return Number.isNaN(n) || n < 1 ? null : n
  } catch {
    return null
  }
}

function writeLastPage(sha: string, page: number): void {
  try {
    localStorage.setItem(lastPageKey(sha), String(page))
  } catch {
    // Storage can refuse (private mode); the reader works without memory.
  }
}

const TOC_PREVIEW_COUNT = 40

function ReaderToc({
  sections,
  loading,
  error,
  refetch,
  indexing,
  currentPage,
  onJump,
}: {
  sections: Section[] | null
  loading: boolean
  error: Error | null
  refetch: () => void
  indexing: boolean
  currentPage: number
  onJump: (page: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const shallowest =
    sections?.reduce((min, s) => Math.min(min, s.level), Number.POSITIVE_INFINITY) ?? 0
  // The deepest section whose [startPage, endPage] range contains the page.
  const activeSection = sections
    ? sections
        .filter((s) => currentPage >= s.startPage && currentPage <= s.endPage)
        .sort((a, b) => b.level - a.level)[0] ?? null
    : null
  const visible = sections ? (expanded ? sections : sections.slice(0, TOC_PREVIEW_COUNT)) : []
  const hidden = (sections?.length ?? 0) - visible.length

  let content: ReactNode
  if (loading) {
    content = (
      <div className="space-y-3 px-1 py-1">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${90 - (i % 4) * 13}%` }} />
        ))}
      </div>
    )
  } else if (error && !(error instanceof ApiError && error.status === 404)) {
    content = (
      <div className="space-y-2 px-1 py-2">
        <p className="text-xs text-destructive">{error.message}</p>
        <Button variant="outline" size="xs" onClick={refetch}>
          Retry
        </Button>
      </div>
    )
  } else if (indexing) {
    content = (
      <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground" role="status">
        <LoaderCircle className="size-4 animate-spin text-primary" />
        Still being prepared…
      </p>
    )
  } else if (!sections || sections.length === 0) {
    content = (
      <p className="px-1 py-2 text-xs leading-relaxed text-muted-foreground/80">
        No chapters in this book.
      </p>
    )
  } else {
    content = (
      <>
        <ul className="space-y-1">
          {visible.map((s) => {
            const active = s.sortOrder === activeSection?.sortOrder
            return (
              <li key={s.sortOrder}>
                <button
                  type="button"
                  onClick={() => onJump(s.startPage)}
                  aria-current={active ? 'true' : undefined}
                  title={`${s.title} · page ${s.startPage}`}
                  className={cn(
                    'flex w-full items-baseline gap-2 rounded-md py-1 pr-2 text-left text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    active
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                  style={{ paddingLeft: `calc(0.5rem + ${(s.level - shallowest) * 0.75}rem)` }}
                >
                  <span className="min-w-0 truncate">{s.title}</span>
                  <span
                    aria-hidden
                    className={cn(
                      'min-w-4 flex-1 border-b-2 border-dotted',
                      active ? 'border-foreground/30' : 'border-border',
                    )}
                  />
                  <span className="shrink-0 font-mono text-xs opacity-70">{s.startPage}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {hidden > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="xs" onClick={() => setExpanded(true)}>
              Show all {sections.length.toLocaleString()} entries
            </Button>
          </div>
        )}
      </>
    )
  }

  return (
    <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-60 shrink-0 flex-col overflow-y-auto pb-4 pr-1 lg:flex">
      <h2 className="mb-2 px-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Contents
      </h2>
      {content}
    </aside>
  )
}

const MODES = [
  ['scan', 'Scan'],
  ['text', 'Text'],
] as const

type ReaderMode = (typeof MODES)[number][0]

function ModeSwitch({ mode, onPick }: { mode: ReaderMode; onPick: (m: ReaderMode) => void }) {
  return (
    <div role="group" aria-label="Reading mode" className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {MODES.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onPick(value)}
          aria-pressed={mode === value}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
            mode === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function CardShell({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ScanText className="size-5" />
        </div>
        <p className="font-heading text-lg">{title}</p>
        <div className="max-w-prose text-sm text-muted-foreground">{children}</div>
        {action}
      </CardContent>
    </Card>
  )
}

/** How the scan pane is doing, reset for every page. */
type ScanState = 'loading' | 'ready' | 'missing'

function ReaderView({ bookId }: { bookId: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { book, loading: bookLoading, error: bookError, refetch: refetchBook } = useBook(bookId)
  const paramPage = (() => {
    const n = Number.parseInt(searchParams.get('page') ?? '', 10)
    return Number.isNaN(n) || n < 1 ? null : n
  })()
  // A deep link wins; otherwise land where this book was left off.
  const [localPage, setLocalPage] = useState(
    () => paramPage ?? (bookId ? readLastPage(bookId) : null) ?? 1,
  )
  const [mode, setMode] = useState<ReaderMode>('scan')
  const [scan, setScan] = useState<ScanState>('loading')
  const page = paramPage ?? localPage

  const pageCount = book?.pageCount ?? 0
  const safePage = pageCount > 0 ? Math.min(page, pageCount) : page

  const goTo = useCallback(
    (n: number) => {
      if (!book || pageCount <= 0) return
      setLocalPage(Math.min(Math.max(n, 1), pageCount))
      if (paramPage !== null) setSearchParams({}, { replace: true })
    },
    [book, pageCount, paramPage, setSearchParams],
  )

  // Draft is derived against `safePage` so it follows nav buttons without an effect.
  const [draft, setDraft] = useState({ value: '1', page: 1 })
  const draftValue = draft.page === safePage ? draft.value : String(safePage)
  const commitDraft = () => {
    const n = Number.parseInt(draftValue, 10)
    if (Number.isNaN(n)) setDraft({ value: String(safePage), page: safePage })
    else goTo(n)
  }

  const { text, loading: textLoading, error: textError, refetch: refetchText } = useBookPage(
    book?.ready ? book.sha256 : undefined,
    safePage,
  )
  const {
    sections,
    loading: tocLoading,
    error: tocError,
    refetch: refetchToc,
  } = useBookSections(book?.sha256)
  const { taskForBook } = useTasks()
  const task = book ? taskForBook(book.id) : null
  const preparing = task?.status === 'running' || task?.status === 'queued'
  // The reader is a view of a finished book, so it refreshes itself the
  // moment the preparation that was blocking it stops running.
  useTaskSettled(task, refetchBook)

  // A fresh page starts with a clean scan pane.
  useEffect(() => {
    setScan('loading')
  }, [safePage])

  // Reading leaves a trace: every page you land on becomes the resume page.
  useEffect(() => {
    if (!book?.ready || pageCount <= 0) return
    writeLastPage(book.sha256, safePage)
  }, [book?.ready, book?.sha256, pageCount, safePage])

  // Paging resets the reading position, including after the clamps.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [safePage])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      )
        return
      const back = e.key === 'ArrowLeft' || e.key === 'PageUp'
      const forward = e.key === 'ArrowRight' || e.key === 'PageDown'
      if (!back && !forward) return
      e.preventDefault()
      goTo(safePage + (back ? -1 : 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, safePage])

  if (bookLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-page py-10">
        <Skeleton className="h-6 w-48 rounded-md" />
        <PageSkeleton />
      </div>
    )
  }

  if (bookError || !book) {
    return (
      <div className="mx-auto max-w-3xl px-page py-20 text-center">
        <h1 className="font-heading text-2xl">Book not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {bookError instanceof ApiError && bookError.status === 404
            ? 'No book in the library matches this link.'
            : (bookError?.message ?? 'Something went wrong.')}
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/">
            <ArrowLeft /> Back to library
          </Link>
        </Button>
      </div>
    )
  }

  // A book that is not ready is never read here: the book page owns its
  // preparation, so the reader sends you there rather than showing a page of
  // half-recovered text.
  const notReady = !book.ready
  const pageMissing =
    !notReady && !textLoading && textError instanceof ApiError && textError.status === 404
  const showSkeleton = !notReady && (textLoading || (!text && !textError))

  let body: ReactNode
  if (notReady) {
    body = (
      <CardShell
        title={preparing ? 'Still being prepared.' : 'This book isn’t ready yet.'}
        action={
          <Button asChild variant="default" className="mt-2">
            <Link to={`/library/${book.sha256}`}>Open the book’s page</Link>
          </Button>
        }
      >
        {preparing
          ? 'It opens for reading as soon as it finishes.'
          : 'Its book page has what happened and what to do about it.'}
      </CardShell>
    )
  } else if (mode === 'scan') {
    if (scan === 'missing') {
      body = (
        <CardShell
          title="This page has no scan."
          action={
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setMode('text')}>
              Read the text
            </Button>
          }
        >
          Nothing could be shown for page {safePage}. The extracted text is still there.
        </CardShell>
      )
    } else {
      body = (
        <>
          {scan === 'loading' && (
            <Skeleton className="mx-auto aspect-3/4 w-full max-w-3xl rounded-lg" />
          )}
          <img
            key={safePage}
            src={api.pageImageUrl(book.sha256, safePage)}
            alt={`Page ${safePage} of ${book.title}`}
            onLoad={() => setScan('ready')}
            onError={() => setScan('missing')}
            className={cn(
              'mx-auto w-full max-w-3xl rounded-lg border bg-card shadow-sm',
              scan !== 'ready' && 'hidden',
            )}
          />
        </>
      )
    }
  } else if (showSkeleton) {
    body = (
      <article className="mx-auto max-w-prose">
        <PageSkeleton />
      </article>
    )
  } else if (pageMissing) {
    body = (
      <CardShell title="This page has no text yet." action={
        <Button variant="outline" size="sm" onClick={refetchText} className="mt-2">
          Retry
        </Button>
      }>
        Nothing was recovered from this page. Its book page lists any pages that
        couldn’t be read.
      </CardShell>
    )
  } else if (textError) {
    body = (
      <CardShell title="The page text couldn’t be loaded." action={
        <Button variant="outline" size="sm" onClick={refetchText} className="mt-2">
          Retry
        </Button>
      }>
        {textError.message}
      </CardShell>
    )
  } else {
    body = (
      text && (
        <article className="mx-auto max-w-prose">
          <div className="space-y-5 font-serif text-lg leading-relaxed text-pretty">
            {splitParagraphs(text.text).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <Separator className="my-8" />
          <div className="text-xs text-muted-foreground">{book.title}</div>
        </article>
      )
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-page py-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link to={`/library/${book.sha256}`}>
            <ArrowLeft /> {book.title}
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex gap-8">
        <ReaderToc
          sections={sections}
          loading={tocLoading}
          error={tocError}
          refetch={refetchToc}
          indexing={preparing}
          currentPage={safePage}
          onJump={goTo}
        />

        <div className="min-w-0 flex-1">
          {!notReady && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="whitespace-nowrap">
                  Page <span className="font-mono text-foreground">{safePage}</span> of{' '}
                  <span className="font-mono">{pageCount.toLocaleString()}</span>
                </span>
                <Input
                  value={draftValue}
                  onChange={(e) => setDraft({ value: e.target.value, page: safePage })}
                  onBlur={commitDraft}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitDraft()
                  }}
                  inputMode="numeric"
                  aria-label="Go to page"
                  className="h-7 w-16 text-center font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <ModeSwitch mode={mode} onPick={setMode} />
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={safePage <= 1}
                  onClick={() => goTo(safePage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={safePage >= pageCount}
                  onClick={() => goTo(safePage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight />
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/ask?book=${book.sha256}&page=${safePage}`}>
                    <Sparkles />
                    Ask about this page
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {body}
        </div>
      </div>
    </div>
  )
}

export function Reader() {
  const { bookId } = useParams()
  return <ReaderView key={bookId ?? 'none'} bookId={bookId} />
}
