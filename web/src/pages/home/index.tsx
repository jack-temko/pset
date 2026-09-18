import { BookOpen } from 'lucide-react'

import { AppShell, PageShell } from '@/components/shell'
import { Button } from '@/components/button'
import { Box, BoxFooter, BoxHeader, BoxRow, Counter, RowValue } from '@/components/box'
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

/**
 * Home. The greeting, then what's due across every book — and, as they are
 * built, the shelf and this week's numbers. The top bar's middle is empty
 * here: you are home, and the greeting says so.
 */
export function Home() {
  return (
    <AppShell>
      <PageShell>
        <h1 className="font-heading text-4xl">{greeting(new Date().getHours())}.</h1>
        <DueList items={SAMPLE} total={9} />
      </PageShell>
    </AppShell>
  )
}
