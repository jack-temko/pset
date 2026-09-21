import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AppShell, PageShell } from '@/components/shell'
import { BookTile } from '@/components/book-tile'
import { ImportRow } from '@/components/import-row'
import { IconButton } from '@/components/button'
import { Box, BoxBody, BoxRow, Counter } from '@/components/box'
import { Button } from '@/components/button'
import { HomeworkStatusLabel, dueText } from '@/components/homework-status'
import { Door } from '@/components/door'
import { DurationValue, StatTile } from '@/components/stat-tile'
import { coverHueFromSha } from '@/lib/covers'
import {
  BOOKS,
  DUE,
  DUE_SHOWN,
  WEEK,
  WEEK_BY_BOOK,
  type Book,
  type Due,
  type Week,
  type WeekBook,
} from '@/lib/sample'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
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

/** The week's time as one full-width bar, split by book — the shelf,
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
 *  the by-book bar below. Reports, never nags — no targets, no deltas, no
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
          value={week.questions > 0 ? week.questions : '—'}
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

/** What is due across every book — the only thing on the page with a
 *  deadline. The section header owns the title, count and action; the Box
 *  holds only rows and its door. */
function Homework({ items, shown }: { items: Due[]; shown: number }) {
  const [open, setOpen] = useState(false)
  const visible = open ? items : items.slice(0, shown)

  return (
    <section className="space-y-5">
      {/* No New homework here — homework is always tied to a book, so the
          one place to create it is the book's Homework tab. */}
      <SectionHeader title="Homework" count={items.length} />
      <Box>
        {visible.map((d) => (
          <BoxRow
            key={d.id}
            href={`/books/${d.bookSha}/homework/${d.id}`}
            title={d.title}
            description={`${d.book} · ${d.questions} questions · ${dueText(d.due, d.status)}`}
            trailing={<HomeworkStatusLabel status={d.status} />}
          />
        ))}
        {items.length > shown && (
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

/** One row of covers by default — the door shows the rest in place, since
 *  there is no other screen for the shelf to lead to. */
const SHELF_ROW = 5

/** Until Settings exists, this stands in for "is the embeddings endpoint
 *  configured". The engine refuses an import without one rather than
 *  failing forty minutes into OCR, so the shelf refuses it too — before
 *  you have picked a file. */
const EMBEDDINGS_READY = true

/**
 * The shelf. One `+` and nothing else: importing a book happens here,
 * where books live, and nowhere else in the app.
 *
 * The shelf only ever holds books you can open. Anything on its way there
 * — queued, preparing, or failed — is a row in a Box above it, with room
 * for the engine's whole sentence and real buttons. The Box exists only
 * while there is work, so a shelf of ready books is just covers, with
 * nothing reserved beneath them.
 */
function Shelf({ books }: { books: Book[] }) {
  const [open, setOpen] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  // Running first, then waiting in order, then what failed.
  const rank = { preparing: 0, queued: 1, failed: 2, ready: 3 } as const
  const inFlight = books
    .filter((b) => b.state.kind !== 'ready')
    .sort((a, b) => rank[a.state.kind] - rank[b.state.kind])
  const ready = books.filter((b) => b.state.kind === 'ready')
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
            disabled={!EMBEDDINGS_READY}
            onClick={() => picker.current?.click()}
          >
            <Plus />
          </IconButton>
        }
      />

      {/* The one blocking condition, said before you can hit it. */}
      {!EMBEDDINGS_READY && (
        <Box tone="warning">
          <BoxBody className="text-sm">
            pset needs an embeddings endpoint before it can prepare a book.{' '}
            <Link to="/settings" className="text-primary underline underline-offset-2">
              Set one up in Settings
            </Link>
            .
          </BoxBody>
        </Box>
      )}

      {/* A local file, handed straight to the engine — no upload dialog,
          no drop zone. One control, one gesture. */}
      <input
        ref={picker}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          // The engine stages and hashes each file, then queues it; the
          // rows appear above the shelf. Wired with the backend pass.
          e.target.value = ''
        }}
      />

      {/* Stop, Cancel, Try again and Dismiss are wired with the backend
          pass: stop and cancel end the task, retry re-enqueues the staged
          file, dismiss drops it and the row with it. */}
      {inFlight.length > 0 && (
        <Box>
          {inFlight.map((b) => (
            <ImportRow key={b.sha256} book={b} />
          ))}
        </Box>
      )}

      {books.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="font-heading text-2xl text-muted-foreground italic">
            Nothing on the shelf yet.
          </p>
          <Button size="lg" disabled={!EMBEDDINGS_READY} onClick={() => picker.current?.click()}>
            <Plus />
            Add your first book
          </Button>
        </div>
      ) : (
        ready.length > 0 && (
          <>
            <div className="grid grid-cols-5 items-start gap-6">
              {shown.map((b) => (
                <BookTile key={b.sha256} book={b} />
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
  return (
    <AppShell>
      <PageShell>
        <h1 className="font-heading text-4xl">{greeting(new Date().getHours())}.</h1>
        <ThisWeek week={WEEK} byBook={WEEK_BY_BOOK} />
        <Homework items={DUE} shown={DUE_SHOWN} />
        <Shelf books={BOOKS} />
      </PageShell>
    </AppShell>
  )
}
