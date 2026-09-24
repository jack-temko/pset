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
import { Box, BoxBody, BoxRow, Counter } from '@/components/box'
import { Button, IconButton, buttonVariants } from '@/components/button'
import { CoverSwatch } from '@/components/book-cover'
import type { CoverHue } from '@/lib/covers'
import { HomeworkStatusLabel } from '@/components/homework-status'
import { Door } from '@/components/door'
import { DurationValue, StatTile } from '@/components/stat-tile'
import { Skeleton } from '@/components/skeleton'
import { Spinner } from '@/components/spinner'
import { useWeek, type Week } from '@/api/activity'
import { useDue, type Summary } from '@/api/homework'
import { dueLine, dueStatus } from '@/lib/due'
import { useShowPending } from '@/lib/settled'

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
              background: `var(--cover-${b.cover})`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {books.map((b) => (
          <span key={b.sha256} className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* A spine, not a dot: the activity tiles own the dots, and this
                swatch ties the entry to its cover on the shelf below. */}
            <CoverSwatch hue={b.cover} className="h-3 w-2" />
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
/** The week's time split by book, for the bar under the stat tiles. The
 *  colour comes from the book's cover hue: the bar is the shelf, flattened. */
type WeekBook = { sha256: string; cover: CoverHue; title: string; minutes: number }

/** One rounding, from one array: the tiles are cut from the same per-book
 *  minutes the bar shows (weighted by the per-activity totals, spare minutes
 *  to the largest fractions), so both views always sum the same. */
function splitByBookTotal(
  total: number,
  w: { homework: number; reading: number; asking: number },
): { homework: number; reading: number; asking: number } {
  const weight = w.homework + w.reading + w.asking
  if (total === 0 || weight === 0) return w
  const exact = [w.homework, w.reading, w.asking].map((m) => (m * total) / weight)
  const out = exact.map((v) => Math.floor(v))
  const left = total - out.reduce((a, b) => a + b, 0)
  exact
    .map((v, i) => ({ fraction: v - Math.floor(v), i }))
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, left)
    .forEach(({ i }) => (out[i] += 1))
  return { homework: out[0], reading: out[1], asking: out[2] }
}

function ThisWeek({ week: loaded, byBook }: { week: Week | undefined; byBook: WeekBook[] }) {
  // Until the numbers arrive, the tiles hold their size with skeletons.
  const week = loaded ?? { homework: 0, reading: 0, asking: 0, questions: 0, problemSets: 0, byBook: [] }
  const onShelf = byBook.reduce((sum, b) => sum + b.minutes, 0)
  const { homework, reading, asking } = splitByBookTotal(onShelf, week)
  const total = homework + reading + asking
  const empty = total === 0 && week.questions === 0
  const wait = (v: React.ReactNode) => (loaded ? v : <Skeleton className="h-6 w-16" />)

  return (
    <section className="space-y-5">
      <SectionHeader title="This week" />
      <div className="grid grid-cols-4 gap-4">
        <StatTile
          label="Homework"
          chart={1}
          value={wait(<DurationValue minutes={homework} />)}
          context={empty ? 'nothing yet this week' : 'so far this week'}
        />
        <StatTile
          label="Reading"
          chart={2}
          value={wait(<DurationValue minutes={reading} />)}
          context={empty ? 'nothing yet this week' : 'so far this week'}
        />
        <StatTile
          label="Asking"
          chart={3}
          value={wait(<DurationValue minutes={asking} />)}
          context={empty ? 'nothing yet this week' : 'so far this week'}
        />
        <StatTile
          label="Questions worked"
          value={wait(week.questions)}
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
  // A small PDF uploads in a blink: the spinner only for a slow one.
  const adding = useShowPending(upload)
  const stop = useStopImport()
  const retry = useRetryImport()
  const remove = useRemoveBook()

  // The engine refuses an import without a chat model (it reads the
  // contents) or embeddings (it builds search) rather than failing forty
  // minutes into reading the pages, so the shelf refuses it too, before
  // you've picked a file. Unknown until settings load: not blocked.
  const chatReady = settings.data?.ready.chat ?? true
  const embeddingsReady = settings.data?.ready.embeddings ?? true
  const preparable = chatReady && embeddingsReady
  const missing =
    !chatReady && !embeddingsReady
      ? 'a saved chat model and embeddings server'
      : !chatReady
        ? 'a saved chat model'
        : 'a saved embeddings server'

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

  // Running first, then waiting in the order it will run, then what
  // failed. The runner examines every book first, then prepares digital
  // books ahead of scans, oldest first within each (the list comes
  // oldest first, and the sort is stable).
  const rank = { preparing: 0, queued: 1, failed: 2, ready: 3 } as const
  const turn = { '': 0, digital: 1, scanned: 2 } as const
  const inFlight = (books ?? [])
    .filter((b) => b.state.kind !== 'ready')
    .sort((a, b) => rank[a.state.kind] - rank[b.state.kind] || (a.state.kind === 'queued' ? turn[a.kind] - turn[b.kind] : 0))
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
            disabled={!preparable || adding}
            onClick={() => !upload.isPending && picker.current?.click()}
          >
            {adding ? <Spinner className="size-3" label="Adding" /> : <Plus />}
          </IconButton>
        }
      />

      {/* The one blocking condition, said before you can hit it, with the
          gesture that unblocks it: a Save in Settings. */}
      {!preparable && (
        <Box tone="warning">
          <BoxBody className="text-sm">
            PSet needs {missing} before it can prepare a book.{' '}
            <Link to="/settings#connections" className="text-primary underline underline-offset-2">
              {!chatReady && !embeddingsReady ? 'Save them in Settings' : 'Save one in Settings'}
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
          {/* Blocked, the primary CTA is the way out, not a dead button:
              the shelf opens once the connections are saved. The header's + stays
              quietly disabled until then. */}
          {preparable ? (
            <Button size="lg" onClick={() => picker.current?.click()}>
              <Plus />
              Add your first book
            </Button>
          ) : (
            <Link to="/settings#connections" className={buttonVariants({ size: 'lg' })}>
              Set up in Settings
            </Link>
          )}
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
              <Door shape="pill" open={open} total={ready.length} onToggle={() => setOpen((o) => !o)} />
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
  const { data: week } = useWeek()
  const byBook = (week?.byBook ?? []).flatMap((w) => {
    const b = books?.find((x) => x.id === w.bookId)
    return b ? [{ sha256: b.sha256, cover: b.cover, title: b.title, minutes: w.minutes }] : []
  })

  return (
    <AppShell>
      <PageShell>
        <PageTitle short="Home" className="text-4xl">
          {greeting(new Date().getHours(), settings?.profile.name ?? '')}.
        </PageTitle>
        {!firstRun && <ThisWeek week={week} byBook={byBook} />}
        {!firstRun && <Homework books={books} />}
        <Shelf books={books} />
      </PageShell>
    </AppShell>
  )
}
