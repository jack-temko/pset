import type { ReactNode } from 'react'

import type { BookUsage, Call, Detail, DetailTotal, Stage } from '@/api/gen/usage'
import { Button } from '@/components/button'
import { Dialog } from '@/components/dialog'
import { Loaded } from '@/components/loaded'
import { Skeleton } from '@/components/skeleton'
import { Table, type TableColumn } from '@/components/table'
import { useLastCount, useLastShape } from '@/lib/last-count'
import { callSeconds, clock, cost, shortModel, timeOfDay, tokens } from '@/lib/usage-format'
import { cn } from '@/lib/utils'

/** What a modal is showing: the detail, still on its way, or not coming. */
type State<T> = { data?: T | null; loading?: boolean; error?: boolean }

/** A figure that is a minimum, because a call reported nothing, wears a small
 *  "≥" hung to the left of its number: absolutely positioned, so it never
 *  moves the digits or takes the cell's right padding, and the digits of a
 *  cell with the mark line up with those of one without. A dash (nothing
 *  counted) has no mark. */
export function Fig({ text, partial, inline }: { text: string; partial: boolean; inline?: boolean }) {
  if (!partial || text === '–') return <>{text}</>
  // Left-aligned values (the totals) have no padding to hang into: the mark
  // goes before the number, so the value starts flush with its label.
  if (inline) {
    return (
      <>
        <span aria-hidden className="font-sans leading-none text-muted-foreground">
          ≥{' '}
        </span>
        <span className="sr-only">at least </span>
        {text}
      </>
    )
  }
  return (
    <span className="relative inline-block">
      {text}
      <span aria-hidden className="absolute top-1/2 right-full mr-1 -translate-y-1/2 font-sans leading-none text-muted-foreground">
        ≥
      </span>
      <span className="sr-only"> at least</span>
    </span>
  )
}

const figure = (n: number | undefined, partial: boolean, inline?: boolean) => <Fig text={tokens(n)} partial={partial} inline={inline} />
const money = (d: number | undefined, partial: boolean, inline?: boolean) => <Fig text={cost(d)} partial={partial} inline={inline} />

const totalLabels = ['Time', 'Calls', 'Failed', 'Cost', 'Tokens in', 'Tokens out', 'Cached', 'Reasoning']

/** The totals' grid before its figures arrive: two rows of four, the labels
 *  already there. */
function TotalsSkeleton() {
  return (
    <dl className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm">
      {totalLabels.map((k) => (
        <div key={k}>
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="figure font-medium">
            <Skeleton className="h-3 w-12" />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** A table's header with `rows` placeholder rows, laid out as the real one is. */
function TableSkeleton<T>({ columns, rows, caption }: { columns: TableColumn<T>[]; rows: number | number[]; caption: string }) {
  // `rows` is a count, or one flag per row: 1 when the row had a second line.
  const flags = (typeof rows === 'number' ? Array.from({ length: rows }, () => 0) : rows).map((flag, i) => ({ flag, i }))
  const bare = columns.map((c, i) => ({
    key: c.key,
    header: c.header,
    width: c.width,
    numeric: c.numeric,
    cell: () => <Skeleton className="h-3 w-10" />,
    secondary: i === 0 ? (r: { flag: number }) => (r.flag ? <Skeleton className="h-2 w-24" /> : undefined) : undefined,
  }))
  return <Table dense caption={caption} columns={bare} rows={flags} rowKey={(r) => String(r.i)} />
}

function Totals({ total }: { total: DetailTotal }) {
  const partial = (total.uncounted ?? 0) > 0
  // Two rows of four: what happened, then the tokens. Counts a provider left
  // out are left out, without a hole.
  const cells: [string, ReactNode][] = [
    ['Time', clock(total.ms)],
    ['Calls', String(total.calls)],
    ['Failed', String(total.failed)],
    ['Cost', money(total.cost, partial, true)],
    ['Tokens in', figure(total.tokensIn, partial, true)],
    ['Tokens out', figure(total.tokensOut, partial, true)],
    ['Cached', total.cached === undefined ? undefined : figure(total.cached, partial, true)],
    ['Reasoning', total.reasoning === undefined ? undefined : figure(total.reasoning, partial, true)],
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
  { key: 'in', header: 'Tokens in', width: '7rem', numeric: true, cell: (s) => figure(s.tokensIn, !!s.uncounted) },
  { key: 'out', header: 'Tokens out', width: '7rem', numeric: true, cell: (s) => figure(s.tokensOut, !!s.uncounted) },
  { key: 'cost', header: 'Cost', width: '7.5rem', numeric: true, cell: (s) => money(s.cost, !!s.uncounted) },
]

/** One call's model: the one that answered, with the one asked for under
 *  it when a fallback served. A call nobody answered shows the one asked. */
const modelOf = (c: Call) => shortModel(c.answered || c.asked)

/** The tools a round called, on one line. */
function ToolList({ tools }: { tools: string }) {
  const list = tools.split(',').join(', ')
  return (
    <span className="block truncate" title={list}>
      {list}
    </span>
  )
}

const callColumns = (withReasoning: boolean): TableColumn<Call>[] => [
  { key: 'at', header: 'At', width: '7rem', mono: true, errorInk: true, cell: (c) => timeOfDay(c.at) },
  {
    key: 'stage',
    header: 'Stage',
    width: '9rem',
    wrapSecondary: true,
    cell: (c) => c.stage,
    // The error may wrap (it matters); the tools stay on one line, cut with an
    // ellipsis and whole in the tooltip.
    secondary: (c) => c.error || (c.tools ? <ToolList tools={c.tools} /> : undefined),
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
  { key: 'cost', header: 'Cost', width: '7rem', numeric: true, cell: (c) => cost(c.cost) },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** A job's totals and breakdown, the loaded body without the dialog around it
 *  (the /components demo of what loading used to look like uses it). */
export function DetailBody({ detail }: { detail: Detail }) {
  return (
    <>
      <Totals total={detail.total} />
      <Breakdown detail={detail} />
    </>
  )
}

/** What a breakdown looked like, for the skeleton: per stage row and per call
 *  row, 1 when it had a second line (a shared mark, an error, tools). */
type Shape = { stages: number[]; runs: number[][] }
const fallbackShape: Shape = { stages: [0, 0, 0], runs: [[0, 0, 0]] }
const MAX_ROWS = 12
const MAX_RUNS = 4
const shapeOf = (d: Detail): Shape => ({
  stages: d.stages.slice(0, MAX_ROWS).map((st) => (st.shared ? 1 : 0)),
  runs: d.runs.slice(0, MAX_RUNS).map((r) => r.calls.slice(0, MAX_ROWS).map((c) => (c.error || c.tools ? 1 : 0))),
})
const flags = (x: unknown): x is number[] => Array.isArray(x) && x.length <= MAX_ROWS && x.every((f) => f === 0 || f === 1)
/** Whether a saved value is a shape within the caps. */
export const isShape = (x: unknown): x is Shape =>
  typeof x === 'object' && x !== null && flags((x as Shape).stages) && Array.isArray((x as Shape).runs) && (x as Shape).runs.length <= MAX_RUNS && (x as Shape).runs.every(flags)
const isImportShape = (x: unknown): x is Shape | null => x === null || isShape(x)

/** The breakdown before it arrives: the stages table and a table for each run. */
function BreakdownSkeleton({ shape }: { shape: Shape }) {
  return (
    <>
      <Section title="Stages">
        <TableSkeleton columns={stageColumns} rows={shape.stages} caption="Stages" />
      </Section>
      {shape.runs.map((calls, i) => (
        <Section key={i} title="Calls">
          <TableSkeleton columns={callColumns(false)} rows={calls} caption="Calls" />
        </Section>
      ))}
    </>
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

/** The dialog's body: a skeleton the size of the table while the data is
 *  on its way, then the data fading in. */
function Body<T>({ state, skeleton, children }: { state: State<T>; skeleton: ReactNode; children: (data: T) => ReactNode }) {
  return (
    <Loaded
      className="space-y-4"
      errorText="Couldn't load the details. Close this and try again."
      query={{ data: state.data, isPending: !!state.loading, isError: !!state.error }}
      skeleton={skeleton}
    >
      {(data) => (data ? children(data as T) : <p className="text-sm text-muted-foreground">No model calls were made.</p>)}
    </Loaded>
  )
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
  kind = 'job',
  detail,
  loading,
  error,
}: { open: boolean; onClose: () => void; name: string; kind?: string } & State<Detail> & { detail?: Detail | null }) {
  const shape = useLastShape<Shape>(`usage-shape-${kind}`, detail ? shapeOf(detail) : undefined, fallbackShape, isShape)
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
      <Body
        state={{ data: detail, loading, error }}
        skeleton={
          <>
            <TotalsSkeleton />
            <BreakdownSkeleton shape={shape} />
          </>
        }
      >
        {(d) => (
          <>
            <Totals total={d.total} />
            <Breakdown detail={d} />
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
}: { open: boolean; onClose: () => void; title: string } & State<BookUsage>) {
  const kindRows = useLastCount('usage-book-kinds', data ? Math.min(data.kinds.length, 12) : undefined)
  const importShape = useLastShape<Shape | null>('usage-book-import', data ? (data.import ? shapeOf(data.import) : null) : undefined, null, isImportShape)
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
      <Body
        state={{ data, loading, error }}
        skeleton={
          <>
            <TotalsSkeleton />
            <Section title="By kind">
              <TableSkeleton columns={kindColumns} rows={kindRows} caption="Usage by kind" />
            </Section>
            {importShape && (
              <>
                <h3 className="pt-2 text-sm font-semibold">Import</h3>
                <BreakdownSkeleton shape={importShape} />
              </>
            )}
          </>
        }
      >
        {(d) => (
          <>
            <Totals total={d.total} />
            <Section title="By kind">
              <Table
                dense
                caption="Usage by kind"
                columns={kindColumns}
                rows={d.kinds}
                rowKey={(k) => k.kind}
              />
            </Section>
            {d.import && (
              <>
                <h3 className={cn('pt-2 text-sm font-semibold')}>Import</h3>
                <Breakdown detail={d.import} />
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
  { key: 'in', header: 'Tokens in', width: '7rem', numeric: true, cell: (k) => figure(k.total.tokensIn, !!k.total.uncounted) },
  { key: 'out', header: 'Tokens out', width: '7rem', numeric: true, cell: (k) => figure(k.total.tokensOut, !!k.total.uncounted) },
  { key: 'cost', header: 'Cost', width: '7.5rem', numeric: true, cell: (k) => money(k.total.cost, !!k.total.uncounted) },
]
