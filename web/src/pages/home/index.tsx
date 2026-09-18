import { useState } from 'react'
import { BookOpen } from 'lucide-react'

import { AppShell, PageShell } from '@/components/shell'
import { BookTile } from '@/components/book-tile'
import { Button } from '@/components/button'
import { Box, BoxRow, Counter, RowValue } from '@/components/box'
import { Door } from '@/components/door'
import { DurationValue, StatTile, type Segment } from '@/components/stat-tile'
import { BOOKS, DUE, DUE_SHOWN, WEEK, type Book, type Due, type Week } from '@/lib/sample'
import { cn } from '@/lib/utils'

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

/** This week's numbers: time on each activity, then questions worked with
 *  the split as a stacked bar. Reports, never nags — no targets, no deltas,
 *  no streaks. First on the page, so the week is visible without scrolling. */
function ThisWeek({ week }: { week: Week }) {
  const total = week.homework + week.reading + week.asking
  const segments: Segment[] =
    total > 0
      ? ([
          { chart: 1, pct: (week.homework / total) * 100 },
          { chart: 2, pct: (week.reading / total) * 100 },
          { chart: 3, pct: (week.asking / total) * 100 },
        ] satisfies Segment[])
      : []
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
          segments={segments}
        />
      </div>
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
      <SectionHeader
        title="Homework"
        count={items.length}
        action={
          <Button variant="outline" size="sm">
            New homework
          </Button>
        }
      />
      <Box>
        {visible.map((d) => (
          <BoxRow
            key={d.id}
            href={`/homework/${d.id}`}
            leading={<BookOpen />}
            title={d.title}
            description={`${d.book} · ${d.questions} questions`}
            trailing={<RowValue className={cn(d.urgent && 'text-warning')}>{d.due}</RowValue>}
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

function Shelf({ books }: { books: Book[] }) {
  const [open, setOpen] = useState(false)
  const shown = open ? books : books.slice(0, SHELF_ROW)

  return (
    <section className="space-y-5">
      <SectionHeader title="Your books" />
      <div className="grid grid-cols-5 items-start gap-6">
        {shown.map((b) => (
          <BookTile key={b.sha256} book={b} />
        ))}
      </div>
      {books.length > SHELF_ROW && (
        <Door open={open} total={books.length} onToggle={() => setOpen((o) => !o)} />
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
        <ThisWeek week={WEEK} />
        <Homework items={DUE} shown={DUE_SHOWN} />
        <Shelf books={BOOKS} />
      </PageShell>
    </AppShell>
  )
}
