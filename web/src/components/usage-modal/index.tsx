import type { ReactNode } from 'react'

import type { BookUsage, Call, Detail, DetailTotal, Stage } from '@/api/gen/usage'
import { Button } from '@/components/button'
import { Dialog } from '@/components/dialog'
import { Spinner } from '@/components/spinner'
import { Table, type TableColumn } from '@/components/table'
import { atLeast, callSeconds, clock, cost, shortModel, timeOfDay, tokens } from '@/lib/usage-format'
import { cn } from '@/lib/utils'

/** What a modal is showing: the detail, still on its way, or not coming. */
type Loaded<T> = { data?: T | null; loading?: boolean; error?: boolean }

/** A figure that is absent is a dash, and a minimum when a call reported
 *  nothing, as everywhere usage is shown. */
const figure = (n: number | undefined, partial: boolean) => atLeast(tokens(n), partial)

function Totals({ total }: { total: DetailTotal }) {
  const partial = (total.uncounted ?? 0) > 0
  // Two rows of four: what happened, then the tokens. Counts a provider left
  // out are left out, without a hole.
  const cells: [string, string | undefined][] = [
    ['Time', clock(total.ms)],
    ['Calls', String(total.calls)],
    ['Failed', String(total.failed)],
    ['Cost', atLeast(cost(total.cost), partial)],
    ['Tokens in', figure(total.tokensIn, partial)],
    ['Tokens out', figure(total.tokensOut, partial)],
    ['Cached', total.cached === undefined ? undefined : figure(total.cached, partial)],
    ['Reasoning', total.reasoning === undefined ? undefined : figure(total.reasoning, partial)],
  ]
  return (
    <dl className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm">
      {cells.map(([k, v]) =>
        v === undefined ? null : (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="figure font-medium">{v}</dd>
          </div>
        ),
      )}
    </dl>
  )
}

const stageColumns: TableColumn<Stage>[] = [
  {
    key: 'stage',
    header: 'Stage',
    cell: (s) => s.name,
    secondary: (s) => (s.shared ? `Shared with ${s.shared} questions` : undefined),
  },
  { key: 'attempts', header: 'Attempts', width: '5.5rem', numeric: true, cell: (s) => s.attempts },
  { key: 'calls', header: 'Calls', width: '4.5rem', numeric: true, cell: (s) => s.calls },
  { key: 'ms', header: 'Time', width: '5.5rem', numeric: true, cell: (s) => clock(s.ms) },
  { key: 'in', header: 'Tokens in', width: '6.5rem', numeric: true, cell: (s) => atLeast(tokens(s.tokensIn), !!s.uncounted) },
  { key: 'out', header: 'Tokens out', width: '6.5rem', numeric: true, cell: (s) => atLeast(tokens(s.tokensOut), !!s.uncounted) },
  { key: 'cost', header: 'Cost', width: '6.5rem', numeric: true, cell: (s) => atLeast(cost(s.cost), !!s.uncounted) },
]

/** One call's model: the one that answered, with the one asked for under
 *  it when a fallback served. A call nobody answered shows the one asked. */
const modelOf = (c: Call) => shortModel(c.answered || c.asked)

const callColumns = (withReasoning: boolean): TableColumn<Call>[] => [
  { key: 'at', header: 'At', width: '5.5rem', mono: true, errorInk: true, cell: (c) => timeOfDay(c.at) },
  {
    key: 'stage',
    header: 'Stage',
    width: '9.5rem',
    wrapSecondary: true,
    cell: (c) => c.stage,
    secondary: (c) => c.error || (c.tools ? c.tools.split(',').join(', ') : undefined),
  },
  {
    key: 'model',
    header: 'Model',
    mono: true,
    cell: modelOf,
    secondary: (c) => (c.answered && c.answered !== c.asked ? `asked ${shortModel(c.asked)}` : undefined),
  },
  { key: 'ms', header: 'Time', width: '5rem', numeric: true, cell: (c) => callSeconds(c.ms) },
  { key: 'in', header: 'Tokens in', width: '6.5rem', numeric: true, cell: (c) => tokens(c.tokensIn) },
  { key: 'out', header: 'Tokens out', width: '6.5rem', numeric: true, cell: (c) => tokens(c.tokensOut) },
  ...(withReasoning ? [{ key: 'reasoning', header: 'Reasoning', width: '6rem', numeric: true, cell: (c: Call) => tokens(c.reasoning) }] : []),
  { key: 'cost', header: 'Cost', width: '6.5rem', numeric: true, cell: (c) => cost(c.cost) },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** A detail's stages table and, under it, every call grouped by run. */
function Breakdown({ detail }: { detail: Detail }) {
  // The column only when some call counted any: a provider that doesn't
  // report reasoning has nothing to show.
  const hasReasoning = detail.runs.some((r) => r.calls.some((c) => c.reasoning !== undefined))
  return (
    <>
      <Section title="Stages">
        <Table dense caption="Stages" columns={stageColumns} rows={detail.stages} rowKey={(s) => s.name} />
      </Section>
      {detail.runs.map((run, i) => (
        <Section key={i} title={detail.runs.length > 1 || run.shared ? run.label : 'Calls'}>
          <Table dense caption={run.label} columns={callColumns(hasReasoning)} rows={run.calls} rowKey={(c) => String(c.id)} error={(c) => !!c.error} />
        </Section>
      ))}
    </>
  )
}

function Body({ state, children }: { state: Loaded<unknown>; children: ReactNode }) {
  if (state.loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading the details…
      </p>
    )
  }
  if (state.error) return <p className="text-sm text-destructive">Couldn't load the details. Close this and try again.</p>
  if (!state.data) return <p className="text-sm text-muted-foreground">No model calls were made.</p>
  return <div className="space-y-4">{children}</div>
}

/**
 * What one job spent, in full: totals, the stages they split into, and every
 * call, grouped by run when it ran more than once. Opened from a
 * UsageTrigger; the detail is fetched when it opens and given here.
 */
export function UsageModal({
  open,
  onClose,
  name,
  detail,
  loading,
  error,
}: { open: boolean; onClose: () => void; name: string } & Loaded<Detail> & { detail?: Detail | null }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Usage · ${name}`}
      width="table"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Body state={{ data: detail, loading, error }}>
        {detail && (
          <>
            <Totals total={detail.total} />
            <Breakdown detail={detail} />
          </>
        )}
      </Body>
    </Dialog>
  )
}

const kindLabels: Record<string, string> = {
  questions: 'Questions',
  ranking: 'Difficulty ranking',
  ask: 'Ask answers',
  reads: 'Assignment reads',
  import: 'Import',
}

/** What a whole book has cost: the total, a row for each kind of thing that
 *  spent it, then the import's own stages and calls. */
export function BookUsageDialog({
  open,
  onClose,
  title,
  data,
  loading,
  error,
}: { open: boolean; onClose: () => void; title: string } & Loaded<BookUsage>) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Usage · ${title}`}
      width="table"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Body state={{ data, loading, error }}>
        {data && (
          <>
            <Totals total={data.total} />
            <Section title="By kind">
              <Table
                dense
                caption="Usage by kind"
                columns={kindColumns}
                rows={data.kinds}
                rowKey={(k) => k.kind}
              />
            </Section>
            {data.import && (
              <>
                <h3 className={cn('pt-2 text-sm font-semibold')}>Import</h3>
                <Breakdown detail={data.import} />
              </>
            )}
          </>
        )}
      </Body>
    </Dialog>
  )
}

type KindRow = BookUsage['kinds'][number]

const kindColumns: TableColumn<KindRow>[] = [
  { key: 'kind', header: 'Kind', cell: (k) => kindLabels[k.kind] ?? k.kind },
  { key: 'items', header: 'Items', width: '5rem', numeric: true, cell: (k) => k.items },
  { key: 'calls', header: 'Calls', width: '4.5rem', numeric: true, cell: (k) => k.total.calls },
  { key: 'ms', header: 'Time', width: '5.5rem', numeric: true, cell: (k) => clock(k.total.ms) },
  { key: 'in', header: 'Tokens in', width: '6.5rem', numeric: true, cell: (k) => atLeast(tokens(k.total.tokensIn), !!k.total.uncounted) },
  { key: 'out', header: 'Tokens out', width: '6.5rem', numeric: true, cell: (k) => atLeast(tokens(k.total.tokensOut), !!k.total.uncounted) },
  { key: 'cost', header: 'Cost', width: '6.5rem', numeric: true, cell: (k) => atLeast(cost(k.total.cost), !!k.total.uncounted) },
]
