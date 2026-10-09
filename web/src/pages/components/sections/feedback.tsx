import { useEffect, useState } from 'react'
import { Check, Clock, TriangleAlert } from 'lucide-react'
import { Box, BoxRow } from '@/components/box'
import { Button } from '@/components/button'
import { Flash } from '@/components/flash'
import { HomeworkStatusLabel } from '@/components/homework-status'
import { Label } from '@/components/label'
import { Loaded } from '@/components/loaded'
import { ProgressBar } from '@/components/progress-bar'
import { Spinner } from '@/components/spinner'
import { Skeleton } from '@/components/skeleton'
import { Table, type TableColumn } from '@/components/table'
import { UsageTrigger } from '@/components/usage'
import { BookUsageDialog, UsageModal } from '@/components/usage-modal'
import { clock, cost, shortModel, timeOfDay, tokens } from '@/lib/usage-format'
import type { BookUsage, Detail as UsageDetail, Usage } from '@/api/gen/usage'
import type { ComponentEntry } from './types'
import { Shelf } from './shared'

/** What one walkthrough cost, as the server reports it: rows ordered by
 *  tokens, the headline model first. */
const USAGE: Usage = {
  rows: [
    { model: 'openai/gpt-6-luna', ms: 4000, tokens: 21034, cost: 0.0009, calls: 3 },
    { model: 'deepseek/deepseek-v4.1-flash', ms: 7900, tokens: 18554, cost: 0.0018, calls: 2 },
    { model: 'z-ai/perceptron-mk1.5', ms: 2100, tokens: 9412, cost: 0.0004, calls: 1 },
  ],
  total: { ms: 14000, tokens: 49000, cost: 0.0031, calls: 6 },
  failed: 0,
}

/** The same, when one call errored (the provider still bills what it wrote,
 *  and doesn't say how much) and one model reported no usage at all: the
 *  figures are a minimum, marked ≥, and a model with nothing counted is a
 *  dash, never a zero. */
const USAGE_FAILED: Usage = {
  rows: [
    { model: 'openai/gpt-6-luna', ms: 4000, tokens: 21034, cost: 0.0009, calls: 2, uncounted: 1 },
    { model: 'qwen/qwen4-235b', ms: 9300, calls: 1, uncounted: 1 },
  ],
  total: { ms: 13300, tokens: 21034, cost: 0.0009, calls: 3, uncounted: 2 },
  failed: 1,
}

/** The widest it gets: the longest model name, seven-digit tokens, minutes
 *  and dollars, and a paid call too small for four decimals (which must not
 *  read as free). The card grows to fit; it never spills out of itself. */
const USAGE_WIDE: Usage = {
  rows: [
    { model: 'deepseek/deepseek-v4.1-flash', ms: 187000, tokens: 1234567, cost: 12.3456, calls: 9 },
    { model: 'perceptron/perceptron-mk1.5', ms: 2100, tokens: 9412, cost: 0.0004, calls: 1 },
    { model: 'openai/gpt-6-luna', ms: 21000, tokens: 21034, cost: 0.00003, calls: 3 },
    { model: 'local/qwen', ms: 900, tokens: 310, cost: 0, calls: 1 },
  ],
  total: { ms: 211000, tokens: 1265323, cost: 12.34603, calls: 14 },
  failed: 0,
}

/** A question's usage as the modal shows it: two runs (the second a retry
 *  that hit a rate limit), a shared difficulty ranking, and a fallback that
 *  answered one call. */
const DETAIL: UsageDetail = {
  total: { ms: 21_400, tokensIn: 31_000, tokensOut: 6_900, reasoning: 3_100, cached: 12_000, cost: 0.0049, calls: 7, failed: 1 },
  stages: [
    { name: 'Find', attempts: 1, calls: 1, ms: 2100, tokensIn: 8200, tokensOut: 1212, cost: 0.0004 },
    { name: 'Figures', attempts: 1, calls: 3, ms: 4000, tokensIn: 9400, tokensOut: 1900, cost: 0.0009 },
    { name: 'Guide', attempts: 2, calls: 3, failed: 1, ms: 14_000, tokensIn: 12_000, tokensOut: 3_700, reasoning: 3_100, cost: 0.0033 },
    { name: 'Rank', attempts: 1, calls: 1, ms: 1300, tokensIn: 1400, tokensOut: 88, cost: 0.0003, shared: 4 },
  ],
  runs: [
    {
      label: 'Run 1',
      calls: [
        { id: 1, at: '2026-10-08T14:02:11Z', stage: 'Find', asked: 'z-ai/perceptron-mk1.5', answered: 'z-ai/perceptron-mk1.5', ms: 2100, tokensIn: 8200, tokensOut: 1212, cost: 0.0004 },
        { id: 2, at: '2026-10-08T14:02:14Z', stage: 'Figures', asked: 'openai/gpt-6-luna', answered: 'openai/gpt-6-luna', ms: 1500, tokensIn: 5400, tokensOut: 900, cost: 0.0003 },
        { id: 3, at: '2026-10-08T14:02:17Z', stage: 'Figures', asked: 'openai/gpt-6-luna', answered: 'openai/gpt-6-luna', ms: 2500, tokensIn: 4000, tokensOut: 1000, cost: 0.0006 },
        { id: 4, at: '2026-10-08T14:02:20Z', stage: 'Guide', tools: 'search_pages,read_page', asked: 'anthropic/claude-haiku-5.5', answered: 'anthropic/claude-haiku-5.5', ms: 7000, tokensIn: 7000, tokensOut: 1800, reasoning: 1400, cached: 5000, cost: 0.0018 },
      ],
    },
    {
      label: 'Run 2',
      calls: [
        { id: 5, at: '2026-10-08T14:09:01Z', stage: 'Guide', asked: 'anthropic/claude-haiku-5.5', ms: 900, error: 'rate limited (429)' },
        { id: 6, at: '2026-10-08T14:09:03Z', stage: 'Guide', asked: 'anthropic/claude-haiku-5.5', answered: 'deepseek/deepseek-v4.1-flash', ms: 6100, tokensIn: 5000, tokensOut: 1900, reasoning: 1700, cached: 7000, cost: 0.0015 },
      ],
    },
    {
      label: 'Difficulty ranking, shared with 4 questions',
      shared: 4,
      calls: [{ id: 7, at: '2026-10-08T14:02:30Z', stage: 'Rank', asked: 'openai/gpt-6-luna', answered: 'openai/gpt-6-luna', ms: 1300, tokensIn: 1400, tokensOut: 88, cost: 0.0003 }],
    },
  ],
}

const BOOK_USAGE: BookUsage = {
  total: { ms: 96_000, tokensIn: 210_000, tokensOut: 31_000, cost: 0.0412, calls: 38, failed: 1 },
  kinds: [
    { kind: 'questions', items: 6, total: { ms: 51_000, tokensIn: 120_000, tokensOut: 19_000, cost: 0.0231, calls: 22, failed: 1 } },
    { kind: 'ranking', items: 1, total: { ms: 1300, tokensIn: 1400, tokensOut: 88, cost: 0.0003, calls: 1, failed: 0 } },
    { kind: 'ask', items: 4, total: { ms: 22_000, tokensIn: 52_000, tokensOut: 7_000, cost: 0.0118, calls: 9, failed: 0 } },
    { kind: 'reads', items: 1, total: { ms: 6_000, tokensIn: 9_000, tokensOut: 1_000, cost: 0.0022, calls: 1, failed: 0 } },
    { kind: 'import', items: 1, total: { ms: 15_700, tokensIn: 27_600, tokensOut: 3_900, cost: 0.0038, calls: 5, failed: 0 } },
  ],
  import: {
    total: { ms: 15_700, tokensIn: 27_600, tokensOut: 3_900, cost: 0.0038, calls: 5, failed: 0 },
    stages: [
      { name: 'Naming', attempts: 1, calls: 1, ms: 2_700, tokensIn: 4_600, tokensOut: 300, cost: 0.0006 },
      { name: 'Contents', attempts: 1, calls: 4, ms: 13_000, tokensIn: 23_000, tokensOut: 3_600, cost: 0.0032 },
    ],
    runs: [
      {
        label: 'Calls',
        calls: [
          { id: 8, at: '2026-10-07T09:00:02Z', stage: 'Naming', asked: 'anthropic/claude-haiku-5.5', answered: 'anthropic/claude-haiku-5.5', ms: 2700, tokensIn: 4600, tokensOut: 300, cost: 0.0006 },
          { id: 9, at: '2026-10-07T09:00:06Z', stage: 'Contents', asked: 'anthropic/claude-haiku-5.5', answered: 'anthropic/claude-haiku-5.5', ms: 13_000, tokensIn: 23_000, tokensOut: 3_600, cost: 0.0032 },
        ],
      },
    ],
  },
}

/** The trigger and the modal it opens, with a fixture standing in for the
 *  server. */
function UsageModalDemo({ book }: { book?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {book ? 'Open the book dialog' : 'Open the modal'}
      </Button>
      {book ? (
        <BookUsageDialog open={open} onClose={() => setOpen(false)} title="Circuits and Systems" data={BOOK_USAGE} />
      ) : (
        <UsageModal open={open} onClose={() => setOpen(false)} name="Problem 3.14" detail={DETAIL} />
      )}
    </>
  )
}

type DemoCall = UsageDetail['runs'][number]['calls'][number]
const DEMO_STAGES = DETAIL.stages
const STAGE_COLUMNS: TableColumn<(typeof DEMO_STAGES)[number]>[] = [
  { key: 'stage', header: 'Stage', cell: (s) => s.name },
  { key: 'attempts', header: 'Attempts', numeric: true, cell: (s) => s.attempts },
  { key: 'calls', header: 'Calls', numeric: true, cell: (s) => s.calls },
  { key: 'ms', header: 'Time', numeric: true, cell: (s) => clock(s.ms) },
  { key: 'in', header: 'Tokens in', numeric: true, cell: (s) => tokens(s.tokensIn) },
  { key: 'out', header: 'Tokens out', numeric: true, cell: (s) => tokens(s.tokensOut) },
  { key: 'cost', header: 'Cost', numeric: true, cell: (s) => cost(s.cost) },
]
const DEMO_CALLS: DemoCall[] = DETAIL.runs[1].calls
const CALL_COLUMNS: TableColumn<DemoCall>[] = [
  { key: 'at', header: 'At', mono: true, errorInk: true, cell: (c) => timeOfDay(c.at) },
  { key: 'stage', header: 'Stage', cell: (c) => c.stage, secondary: (c) => c.error },
  {
    key: 'model',
    header: 'Model',
    mono: true,
    cell: (c) => shortModel(c.answered || c.asked),
    secondary: (c) => (c.answered && c.answered !== c.asked ? `asked ${shortModel(c.asked)}` : undefined),
  },
  { key: 'ms', header: 'ms', numeric: true, cell: (c) => c.ms.toLocaleString('en-US') },
  { key: 'in', header: 'Tokens in', numeric: true, cell: (c) => tokens(c.tokensIn) },
  { key: 'cost', header: 'Cost', numeric: true, cell: (c) => cost(c.cost) },
]

export const feedbackSections: ComponentEntry[] = [
  {
    id: 'table',
    title: 'Table',
    group: 'Feedback',
    note: 'A quiet table for figures you read across a row: muted header, compact rows, right-aligned tabular numbers, an optional second line, and a soft error row. It scrolls sideways inside its own frame when too wide.',
    docs: ['table'],
    Demo: () => (
      <>
        <Shelf label="numeric columns">
          <div className="w-full min-w-0">
            <Table caption="Stages" columns={STAGE_COLUMNS} rows={DEMO_STAGES} rowKey={(s) => s.name} />
          </div>
        </Shelf>
        <Shelf label="secondary line, error row">
          <div className="w-full min-w-0">
            <Table caption="Calls" columns={CALL_COLUMNS} rows={DEMO_CALLS} rowKey={(c) => String(c.id)} error={(c) => !!c.error} />
          </div>
        </Shelf>
        <Shelf label="too wide: scrolls">
          <div className="w-panel min-w-0">
            <Table caption="Stages, narrow" columns={STAGE_COLUMNS} rows={DEMO_STAGES} rowKey={(s) => s.name} />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'usage-modal',
    title: 'Usage modal',
    group: 'Feedback',
    note: 'What one job spent, in full: totals, stages and every call grouped by run, opened from the usage line. The book dialog is the same for a whole book, with a row for each kind of thing that spent.',
    docs: ['usage-modal'],
    Demo: () => (
      <>
        <Shelf label="a question">
          <UsageModalDemo />
        </Shelf>
        <Shelf label="a book">
          <UsageModalDemo book />
        </Shelf>
        <Shelf label="loading, failed, none">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Loading the details… (a spinner)</p>
            <p>Couldn't load the details. Close this and try again.</p>
            <p>No model calls were made.</p>
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'flash',
    title: 'Flash',
    group: 'Feedback',
    note: 'A full-width strip under the top bar: one sentence about the whole screen, at most one action.',
    docs: ['flash'],
    Demo: () => (
      <>
        <Shelf label="warning">
          <div className="w-full max-w-xl overflow-hidden rounded-md border">
            <Flash tone="warning">Lost touch with PSet. Reconnecting…</Flash>
          </div>
        </Shelf>
        <Shelf label="default, with action">
          <div className="w-full max-w-xl overflow-hidden rounded-md border">
            <Flash
              onDismiss={() => {}}
              action={
                <Button variant="outline" size="sm">
                  Edit the title
                </Button>
              }
            >
              This book is named after its file.
            </Flash>
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'usage',
    title: 'Usage trigger',
    group: 'Feedback',
    note: 'What a finished job spent, as one muted line (the model and the cost) with a chevron, and a button: it opens the usage modal. A ≥ marks a minimum when a call reported nothing.',
    docs: ['usage'],
    Demo: () => (
      <>
        <Shelf label="the line">
          <div className="py-1">
            <UsageTrigger usage={USAGE} source={{ kind: 'question', id: 'demo' }} name="Problem 3.14" detail={DETAIL} />
          </div>
        </Shelf>
        <Shelf label="a failed call, and one the provider didn't count">
          <div className="py-1">
            <UsageTrigger usage={USAGE_FAILED} source={{ kind: 'question', id: 'demo' }} name="Problem 3.15" detail={DETAIL} />
          </div>
        </Shelf>
        <Shelf label="the widest">
          <div className="py-1">
            <UsageTrigger usage={USAGE_WIDE} source={{ kind: 'question', id: 'demo' }} name="Problem 12.7" detail={DETAIL} />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'loaded',
    title: 'Loaded',
    group: 'Feedback',
    note: 'The one way anything that waits on data is drawn: a skeleton that holds the content\'s space, a 150ms fade when it arrives, one line when it fails.',
    docs: ['loaded'],
    Demo: () => <LoadedDemo />,
  },
  {
    id: 'skeleton',
    title: 'Skeleton',
    group: 'Feedback',
    note: "The shape of what's coming, at its real size, so nothing moves when it lands. It shimmers while it waits, the one loop besides the Spinner.",
    docs: ['skeleton'],
    Demo: () => (
      <>
        <Shelf label="row">
          <Box className="w-full">
            <BoxRow
              leading={<Skeleton className="size-4 rounded-full" />}
              title="Database"
              description={<Skeleton className="h-3 w-48" />}
            />
          </Box>
        </Shelf>
        <Shelf label="prose">
          <div className="w-panel space-y-1 text-base">
            <p><Skeleton className="h-3 w-full" /></p>
            <p><Skeleton className="h-3 w-full" /></p>
            <p><Skeleton className="h-3 w-2/3" /></p>
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'spinner',
    title: 'Spinner',
    group: 'Feedback',
    note: "The one looping animation in the system. A repeating motion means ‘waiting’, so nothing that isn't waiting may borrow it.",
    docs: ['spinner'],
    Demo: () => (
      <>
        <Shelf label="spinner">
          <Spinner />
          <Spinner className="size-3 text-warning" />
          <Spinner className="size-5 text-muted-foreground" />
        </Shelf>
      </>
    ),
  },
  {
    id: 'label',
    title: 'Label',
    group: 'Feedback',
    note: 'Outlined by default: border and text share one ink. A status label always carries a word.',
    docs: ['label'],
    Demo: () => (
      <>
        <Shelf label="tone">
          <Label>Scanned</Label>
          <Label tone="primary">Due Sep 21</Label>
          <Label tone="success">
            <Check />
            Turned in
          </Label>
          <Label tone="warning">
            <Clock />
            Due today
          </Label>
          <Label tone="danger">Overdue · Sep 12</Label>
        </Shelf>
        <Shelf label="filled">
          <Label tone="danger" filled>
            <TriangleAlert />
            Needs you
          </Label>
          <Label tone="success" filled>
            Ready
          </Label>
        </Shelf>
        <Shelf label="homework status">
          <HomeworkStatusLabel status="soon" />
          <HomeworkStatusLabel status="overdue" />
          <HomeworkStatusLabel status="turned-in" />
        </Shelf>
      </>
    ),
  },
  {
    id: 'progress-bar',
    title: 'ProgressBar',
    group: 'Feedback',
    note: 'How far along a set is, as a slim bar cut into its questions, each as wide as it is hard. It says; the count beside it is the control.',
    docs: ['progress-bar'],
    Demo: () => (
      <>
        <Shelf label="weighted by difficulty">
          <div className="w-panel space-y-2">
            <ProgressBar
              label="2 of 8 done"
              segments={[
                { mark: 'done', weight: 2 },
                { mark: 'done', weight: 2 },
                { mark: 'current', weight: 4 },
                { mark: 'waiting', weight: 3 },
                { mark: 'waiting', weight: 1 },
                { mark: 'failed', weight: 1 },
                { mark: 'waiting', weight: 3 },
                { mark: 'waiting', weight: 2 },
              ]}
            />
            <p className="text-xs text-muted-foreground">Done, current, waiting and failed; wider means harder.</p>
          </div>
        </Shelf>
        <Shelf label="no weights">
          <div className="w-panel">
            <ProgressBar label="3 of 6 done" segments={['done', 'done', 'done', 'current', 'waiting', 'waiting'].map((mark) => ({ mark: mark as 'done' }))} />
          </div>
        </Shelf>
      </>
    ),
  },
]

type LoadedState = 'pending' | 'loaded' | 'cached' | 'error'

/** Loaded with a query faked by four buttons. Each press remounts it, so the
 *  first render is the state pressed: pending waits (the grace, then the
 *  shimmer), loaded waits 1.2s then arrives and fades, cached is there at
 *  once, error fails. */
function LoadedDemo() {
  const [run, setRun] = useState<{ n: number; state: LoadedState }>({ n: 0, state: 'pending' })
  const press = (state: LoadedState) => setRun((r) => ({ n: r.n + 1, state }))
  return (
    <>
      <Shelf label="state">
        <div className="flex gap-2">
          {(['pending', 'loaded', 'cached', 'error'] as const).map((state) => (
            <Button key={state} variant={run.state === state ? 'primary' : 'outline'} onClick={() => press(state)}>
              {state}
            </Button>
          ))}
        </div>
      </Shelf>
      <Shelf label="the box">
        <LoadedBox key={run.n} state={run.state} />
      </Shelf>
    </>
  )
}

function LoadedBox({ state }: { state: LoadedState }) {
  const [arrived, setArrived] = useState(state === 'cached')
  useEffect(() => {
    if (state !== 'loaded') return
    const t = setTimeout(() => setArrived(true), 1200)
    return () => clearTimeout(t)
  }, [state])
  const query = {
    data: arrived ? ['Problem 3.14', 'Problem 3.15', 'Problem 3.16'] : undefined,
    isPending: state === 'pending' || (state === 'loaded' && !arrived),
    isError: state === 'error',
  }
  return (
    <Loaded
      className="w-panel space-y-2"
      query={query}
      skeleton={[0, 1, 2].map((i) => (
        <p key={i} className="text-sm">
          <Skeleton className="h-3 w-full" />
        </p>
      ))}
    >
      {(rows) => rows.map((r) => <p key={r} className="text-sm">{r}</p>)}
    </Loaded>
  )
}
