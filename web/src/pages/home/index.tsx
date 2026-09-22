import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import {
  useBooks,
  useRemoveBook,
  useRetryImport,
  useStopImport,
  useUploadBooks,
  type Book,
} from '@/api/library'
import { useSettings } from '@/api/settings'

import { AppShell, PageShell, PageTitle } from '@/components/shell'
import { BookTile } from '@/components/book-tile'
import { ImportRow } from '@/components/import-row'
import { IconButton } from '@/components/button'
import { Box, BoxBody, BoxRow, Counter } from '@/components/box'
import { Button } from '@/components/button'
import { HomeworkStatusLabel } from '@/components/homework-status'
import { Door } from '@/components/door'
import { DurationValue, StatTile } from '@/components/stat-tile'
import { coverHueFromSha } from '@/lib/covers'
import { Skeleton } from '@/components/skeleton'
import { Spinner } from '@/components/spinner'
import { WEEK, WEEK_BY_BOOK, type Week, type WeekBook } from '@/lib/sample'
import { useDue, type Summary } from '@/api/homework'
import { dueLine, dueStatus } from '@/lib/due'

function greeting(hour: number, name: string): string {
  const time = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return name ? `${time}, ${name}` : time
}

/** A section's header row: the serif title (and an optional count) on the
 *  left, one optional quiet action on the right. */
function SectionHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-control items-center justify-between gap-3">
      <h2 className="font-heading text-xl">
        {title}
        {count !== undefined && <Counter>{count}</Counter>}
      </h2>
      {action}
    </div>
  )
}

/** The week's time as one full-width bar, split by book: the shelf,
 *  flattened. Each split takes its book's cover hue and is named below. */
function WeekByBook({ books }: { books: WeekBook[] }) {
  const total = books.reduce((sum, b) => sum + b.minutes, 0)
  if (total === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex h-2 overflow-hidden rounded-full">
        {books.map((b) => (
          <span
            key={b.sha256}
            className="h-full"
            style={{
              width: `${(b.minutes / total) * 100}%`,
              background: `var(--cover-${coverHueFromSha(b.sha256)})`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {books.map((b) => (
          <span key={b.sha256} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: `var(--cover-${coverHueFromSha(b.sha256)})` }}
            />
            {b.title}
            <span className="font-mono font-normal tabular-nums">
              {Math.floor(b.minutes / 60) > 0 && `${Math.floor(b.minutes / 60)}h `}
              {b.minutes % 60}m
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** This week's numbers: time on each activity, then questions worked, with
 *  the by-book bar below. Reports, never nags: no targets, no deltas, no
 *  streaks. First on the page, so the week is visible without scrolling. */
function ThisWeek({ week, byBook }: { week: Week; byBook: WeekBook[] }) {
  const total = week.homework + week.reading + week.asking
  const empty = total === 0 && week.questions === 0

  return (
    <section className="space-y-5">
      <SectionHeader title="This week" />
      <div className="grid grid-cols-4 gap-4">
        <StatTile
          label="Homework"
          chart={1}
          value={<DurationValue minutes={week.homework} />}
          context={empty ? 'nothing yet this week' : 'so far this week'}
        />
        <StatTile
          label="Reading"
          chart={2}
          value={<DurationValue minutes={week.reading} />}
          context={empty ? 'nothing yet this week' : 'so far this week'}
        />
        <StatTile
          label="Asking"
          chart={3}
          value={<DurationValue minutes={week.asking} />}
          context={empty ? 'nothing yet this week' : 'so far this week'}
        />
        <StatTile
          label="Questions worked"
          value={week.questions}
          context={
            week.questions > 0
              ? `across ${week.problemSets} problem set${week.problemSets === 1 ? '' : 's'}`
              : 'nothing yet this week'
          }
        />
      </div>
      <WeekByBook books={byBook} />
    </section>
  )
}

/** How many due rows show before the door. */
const DUE_SHOWN = 3

/** What is due across every book: the only thing on the page with a
 *  deadline. The section header owns the title, count and action; the Box
 *  holds only rows and its door. Nothing due, no section. */
function Homework({ books }: { books: Book[] | undefined }) {
  const [open, setOpen] = useState(false)
  const { data: items } = useDue()
  const titleOf = (h: Summary) => books?.find((b) => b.id === h.bookId)?.title ?? ''

  if (items === undefined) {
    return (
      <section className="space-y-5">
        <SectionHeader title="Homework" />
        <Box>
          {Array.from({ length: DUE_SHOWN }, (_, i) => (
            <BoxRow key={i} title={<Skeleton className="h-3 w-40" />} description={<Skeleton className="h-3 w-80" />} />
          ))}
        </Box>
      </section>
    )
  }
  if (items.length === 0) return null
  const visible = open ? items : items.slice(0, DUE_SHOWN)

  return (
    <section className="space-y-5">
      {/* No New homework here: homework is always tied to a book, so the
          one place to create it is the book's Homework tab. */}
      <SectionHeader title="Homework" count={items.length} />
      <Box>
        {visible.map((d) => (
          <BoxRow
            key={d.id}
            href={`/books/${d.bookId}/homework/${d.id}`}
            title={d.title}
            description={`${titleOf(d)} · ${d.total} question${d.total === 1 ? '' : 's'} · ${dueLine(d)}`}
            trailing={<HomeworkStatusLabel status={dueStatus(d)} />}
          />
        ))}
        {items.length > DUE_SHOWN && (
          <Door
            className="border-t border-border-muted"
            open={open}
            total={items.length}
            onToggle={() => setOpen((o) => !o)}
          />
        )}
      </Box>
    </section>
  )
}

/** One row of covers by default: the door shows the rest in place, since
 *  there is no other screen for the shelf to lead to. */
const SHELF_ROW = 5

/**
 * The shelf. One `+` and nothing else: importing a book happens here,
 * where books live, and nowhere else in the app.
 *
 * The shelf only ever holds books you can open. Anything on its way there
 * (queued, preparing, or failed) is a row in a Box above it, with room
 * for the engine's whole sentence and real buttons. The Box exists only
 * while there is work, so a shelf of ready books is just covers, with
 * nothing reserved beneath them.
 */
function Shelf({ books }: { books: Book[] | undefined }) {
  const [open, setOpen] = useState(false)
  const [refused, setRefused] = useState<string[]>([])
  const picker = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const settings = useSettings()
  const upload = useUploadBooks()
  const stop = useStopImport()
  const retry = useRetryImport()
  const remove = useRemoveBook()

  // The engine refuses an import without embeddings rather than failing
  // forty minutes into reading the pages, so the shelf refuses it too,
  // before you've picked a file. Unknown until settings load: not blocked.
  const embeddingsReady = settings.data?.ready.embeddings ?? true

  const add = (files: File[]) => {
    if (files.length === 0) return
    setRefused([])
    upload.mutate(files, {
      onSuccess: ({ duplicates, errors }) => {
        setRefused(errors.map((e) => e.message))
        // A book you already have: you asked for it, so here it is. Only
        // when it's the one file you picked, and only if it can be opened;
        // one still on its way is already a row above the shelf.
        const only = duplicates.length === 1 && files.length === 1 ? duplicates[0] : null
        const dup = only ? books?.find((b) => b.id === only) : undefined
        if (dup?.state.kind === 'ready') navigate(`/books/${dup.id}`)
      },
      onError: (e) => setRefused([e.message]),
    })
  }

  // Running first, then waiting in order, then what failed.
  const rank = { preparing: 0, queued: 1, failed: 2, ready: 3 } as const
  const inFlight = (books ?? [])
    .filter((b) => b.state.kind !== 'ready')
    .sort((a, b) => rank[a.state.kind] - rank[b.state.kind])
  const ready = (books ?? []).filter((b) => b.state.kind === 'ready')
  const shown = open ? ready : ready.slice(0, SHELF_ROW)

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Your books"
        action={
          <IconButton
            variant="outline"
            size="sm"
            aria-label="Add a textbook"
            disabled={!embeddingsReady || upload.isPending}
            onClick={() => picker.current?.click()}
          >
            {upload.isPending ? <Spinner className="size-3" label="Adding" /> : <Plus />}
          </IconButton>
        }
      />

      {/* The one blocking condition, said before you can hit it. */}
      {!embeddingsReady && (
        <Box tone="warning">
          <BoxBody className="text-sm">
            PSet needs an embeddings server before it can prepare a book.{' '}
            <Link to="/settings" className="text-primary underline underline-offset-2">
              Set one up in Settings
            </Link>
            .
          </BoxBody>
        </Box>
      )}

      {refused.length > 0 && (
        <Box tone="destructive">
          <BoxBody className="flex items-start justify-between gap-4 text-sm">
            <span className="space-y-1">
              {refused.map((m, i) => (
                <span key={i} className="block">
                  {m}
                </span>
              ))}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setRefused([])}>
              Dismiss
            </Button>
          </BoxBody>
        </Box>
      )}

      {/* A local file, handed straight to the engine: no upload dialog,
          no drop zone. One control, one gesture. */}
      <input
        ref={picker}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          add(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {inFlight.length > 0 && (
        <Box>
          {inFlight.map((b) => (
            <ImportRow
              key={b.id}
              book={b}
              onStop={() => stop.mutate(b.id)}
              onRetry={() => retry.mutate(b.id)}
              onDismiss={() => remove.mutate(b.id)}
            />
          ))}
        </Box>
      )}

      {books === undefined ? (
        // A row of covers at their real size, so the shelf doesn't grow
        // when the books arrive.
        <div className="grid grid-cols-5 items-start gap-6">
          {Array.from({ length: SHELF_ROW }, (_, i) => (
            <Skeleton key={i} className="block aspect-3/4 w-full rounded-md" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="font-heading text-2xl text-muted-foreground italic">
            Nothing on the shelf yet.
          </p>
          <Button size="lg" disabled={!embeddingsReady} onClick={() => picker.current?.click()}>
            <Plus />
            Add your first book
          </Button>
        </div>
      ) : (
        ready.length > 0 && (
          <>
            <div className="grid grid-cols-5 items-start gap-6">
              {shown.map((b) => (
                <BookTile key={b.id} book={b} />
              ))}
            </div>
            {ready.length > SHELF_ROW && (
              <Door open={open} total={ready.length} onToggle={() => setOpen((o) => !o)} />
            )}
          </>
        )
      )}
    </section>
  )
}

/**
 * Home. The greeting, this week's numbers, what's due across every book,
 * then the shelf. The top bar's middle is empty here: you are home, and the
 * greeting says so.
 */
export function Home() {
  const { data: books } = useBooks()
  const { data: settings } = useSettings()
  // A first run is the greeting and the shelf, nothing else: empty
  // sections read as broken, and a row of zeroes is noise.
  const firstRun = books !== undefined && books.length === 0

  return (
    <AppShell>
      <PageShell>
        <PageTitle short="Home" className="text-4xl">
          {greeting(new Date().getHours(), settings?.profile.name ?? '')}.
        </PageTitle>
        {!firstRun && <ThisWeek week={WEEK} byBook={WEEK_BY_BOOK} />}
        {!firstRun && <Homework books={books} />}
        <Shelf books={books} />
      </PageShell>
    </AppShell>
  )
}
