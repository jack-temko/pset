import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BookOpen, Check, ChevronDown, ChevronUp, Clock, Pencil, Plus, Printer, Settings, Trash2, TriangleAlert } from 'lucide-react'

import { AppShell, PageShell } from '@/components/shell'
import { BookCover, CoverPicker } from '@/components/book-cover'
import { BrandLockup, Mark } from '@/components/brand'
import { Box, BoxBody, BoxFooter, BoxHeader, BoxRow, Counter, RowValue } from '@/components/box'
import { Button, IconButton } from '@/components/button'
import { ImportRow } from '@/components/import-row'
import { Door } from '@/components/door'
import { Flash } from '@/components/flash'
import { HomeworkStatusLabel } from '@/components/homework-status'
import { Label } from '@/components/label'
import {
  AnswersCard,
  AssistantTurn,
  Callout,
  ConversationStart,
  DayDivider,
  FailedTurn,
  GuidePara,
  MathDisplay,
  MathInline,
  AnswerTable,
  CodeBlock,
  Note,
  PageRef,
  PartHeader,
  Plot,
  Statement,
  StepHeading,
  Steps,
  StoppedNote,
  Thinking,
  UserTurn,
  WorkedSteps,
} from '@/components/transcript'
import { Veil } from '@/components/veil'
import { ResizeHandle } from '@/components/resize-handle'
import { Spinner } from '@/components/spinner'
import { Skeleton } from '@/components/skeleton'
import { Menu, MenuCheckItem, MenuConfirmItem, MenuDivider, MenuItem } from '@/components/menu'
import { ConfirmPopover } from '@/components/confirm'
import { UsageLine } from '@/components/usage'
import { RadioRows } from '@/components/radio-rows'
import { SegmentedControl } from '@/components/segmented-control'
import { Checkbox } from '@/components/checkbox'
import { Dialog } from '@/components/dialog'
import { AutoTextarea, Field, Input } from '@/components/input'
import { DurationValue, StatTile } from '@/components/stat-tile'
import { observe } from '@/lib/eta'
import type { CoverHue } from '@/lib/covers'
import { ASSIGNMENT, ASSIGNMENT_SETS, BLOCKS, BOOKS, DUE, GUIDE, GUIDE_HINT, sampleBook } from '@/components/fixtures'
import { AnswersOf, BlockSkeleton, Document } from '@/components/document'
import type { Block } from '@/api/gen/doc'
import type { Usage } from '@/api/gen/usage'
import { PageMap, Pages } from '@/lib/pages'
import type { Run } from '@/api/gen/pagenum'
import { PageNumbersField } from '@/pages/workspace/page-numbers'
import { anchorsOf, choiceOf } from '@/pages/workspace/book-numbering'
import { ProblemStyleField } from '@/pages/workspace/problem-style'
import { BoxingBar, BoxingProvider, DrawnBox } from '@/pages/workspace/boxing'
import { useBoxing } from '@/pages/workspace/boxing-state'
import { AssignmentReview, AssignmentSourceFields } from '@/pages/workspace/add-homework'
import { AssignmentReadRow } from '@/pages/workspace/assignment-reads'
import { QuestionRows, emptyRow, type QuestionRow } from '@/pages/workspace/dialogs'
import { FigureReading } from '@/pages/workspace/reading'
import { reviewOf } from '@/pages/workspace/import-state'
import type { Style } from '@/api/gen/probnum'
import type { AssignmentRead, Question } from '@/api/homework'
import { BookTile } from '@/components/book-tile'
import { cn } from '@/lib/utils'

/** A paragraph of the phone-plan guide, as the server splits it. */
const PLAN_PARA: Block = {
  type: 'para',
  text: [
    { t: 'The plan charges 15 dollars a month plus 1 dollar a minute, so a month with ' },
    { m: 'M' },
    { t: ' minutes costs ' },
    { m: 'C = 15 + M' },
    { t: '. If each minute ends the call with probability ' },
    { m: 'p' },
    { t: ', then ' },
    { m: 'E[M] = 1/p' },
    { t: ' ' },
    { cite: 108 },
    { t: '.' },
  ],
}

// The reading row has a minute of pace behind it, so it shows its time
// left as a real import would (40 pages a minute, 172 to go).
observe('book:b89d3b72', 'import:read', { done: 100, total: 312 }, Date.now() - 60_000)
observe('book:b89d3b72', 'import:read', { done: 140, total: 312 }, Date.now())


/** Sample series for the Plot demo: logistic growth levelling at 100
 *  against the exponential it starts out as. */
const EXP: [number, number][] = [[0.0, 10.0], [0.5, 12.84], [1.0, 16.49], [1.5, 21.17], [2.0, 27.18], [2.5, 34.9], [3.0, 44.82], [3.5, 57.55], [4.0, 73.89], [4.5, 94.88]]
const LOGISTIC: [number, number][] = [[0.0, 10.0], [0.5, 12.49], [1.0, 15.48], [1.5, 19.04], [2.0, 23.2], [2.5, 27.94], [3.0, 33.24], [3.5, 39.0], [4.0, 45.09], [4.5, 51.32], [5.0, 57.51], [5.5, 63.48], [6.0, 69.06], [6.5, 74.13], [7.0, 78.63], [7.5, 82.53], [8.0, 85.85]]

/** The guide's plot: problem 3.7.8's new phone plan, 15 + 1/p, against the
 *  old one, 20 + (1-p)^30/(2p), for the same caller. They cross just under
 *  p = 0.2, where a caller averages five minutes a month. */
const PS = Array.from({ length: 37 }, (_, i) => 0.05 + i * 0.0125)
const COST: [number, number][] = PS.map((p) => [+p.toFixed(4), +(15 + 1 / p).toFixed(2)])
const OLD_PLAN: [number, number][] = PS.map((p) => [+p.toFixed(4), +(20 + (1 - p) ** 30 / (2 * p)).toFixed(2)])

/**
 * Every component and every variant, on one page, in the app itself.
 *
 * Not in the nav and not part of the product's three screens: it is the
 * page you open to see what a change did. Add a component here the moment
 * you build one; anything missing from this page is unreviewed.
 */

const readingLine = (t: string) => [{ t }]

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

/** 4.72's figure as read, for the Figure reading shelf. */
const READ_QUESTION: Question = {
  id: 'q-read', homeworkId: 'h1', position: 1, text: '4.72', inBook: true, label: '4.72',
  statement: [], page: 194, figures: [{ label: 'Figure 4.138' }], hint: [], walkthrough: [],
  state: 'ready', memory: [], readingEdited: false, readingDoubts: [], notes: [], boxes: [],
  revealed: [], done: false, activity: '', reason: '', updatedAt: '', rev: 1,
  reading: [
    'Node L: top of the 4 A source, top of the 2 Ω, left end of the 4 Ω.',
    'Node N: right end of the 4 Ω, left end of the 6 Ω, left end of the 2 A source.',
    'Node a: right end of the 6 Ω, right end of the 2 A source, top of R_L.',
    'Node D: bottom of the 4 A source, bottom of the 2 Ω, + of the 20 V source.',
    '4 A current source from D to L (its arrow points to L).',
    '2 A current source from N to a (its arrow points to a).',
    '20 V source between D and b, + at D.',
  ].map(readingLine),
}

const READING_DOUBTS = [
  'The 2 A source: two readings have its arrow pointing to a, one to N; it points to a.',
  'The 20 V source: two readings have + at D, one at b; + is at D.',
].map(readingLine)

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="space-y-1 border-b pb-3">
        <h2 className="font-heading text-xl">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

/** One labelled shelf of specimens. The label is mono so it never reads as
 *  part of the thing being shown. */
function Shelf({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] items-start gap-6">
      <div className="pt-2 font-mono text-xs text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

/** Two panes and the seam between them, live: the left one sizes. */
function ResizeDemo() {
  const [width, setWidth] = useState(200)
  return (
    <div className="flex h-40 w-full max-w-layout-reading overflow-hidden rounded-md border">
      <div style={{ width }} className="shrink-0 border-r bg-rail p-card text-sm text-muted-foreground">
        {width}px
      </div>
      <ResizeHandle
        label="Resize the demo pane"
        pane="before"
        value={width}
        min={120}
        max={400}
        onChange={setWidth}
        onCommit={() => {}}
        onReset={() => setWidth(200)}
      />
      <div className="min-w-0 flex-1 bg-background p-card text-sm text-muted-foreground">
        Drag the grip, or tab to it and use the arrows. Double-click or Enter puts it back.
      </div>
    </div>
  )
}

/** The Book dialog's page numbers, live: one run, or a scan that lost a
 *  page (Boyce's printed 85). */
function PageNumbersDemo({ runs }: { runs: Run[] }) {
  const [anchors, setAnchors] = useState(() => anchorsOf(runs))
  return <PageNumbersField anchors={anchors} pageCount={640} onChange={setAnchors} />
}

/** The Book dialog's problem numbering, live, from what import found. */
function ProblemStyleDemo({ style }: { style: Style | undefined }) {
  const [value, setValue] = useState(() => choiceOf(style))
  const [touched, setTouched] = useState(false)
  return (
    <ProblemStyleField
      style={style}
      value={value}
      confirmed={touched}
      onChange={(v) => {
        setValue(v)
        setTouched(true)
      }}
      onConfirm={() => setTouched(true)}
    />
  )
}

/** The boxing bar, in a session with a box already drawn. */
function BoxingDemo() {
  return (
    <BoxingProvider onDone={async () => {}}>
      <StartBoxing />
      <BoxingBar />
    </BoxingProvider>
  )
}

function StartBoxing() {
  const b = useBoxing()
  useEffect(() => {
    if (!b.target) {
      b.start({ kind: 'find', questionId: 'q', label: '3.1 #7' })
      b.add({ page: 123, x: 0.1, y: 0.6, w: 0.4, h: 0.1, kind: 'text' })
    }
  }, [b])
  return null
}

/** Reads in the Homework list: reading (still thinking, then finding
 *  lines), read, an update read, failed. */
const READS: AssignmentRead[] = [
  {
    id: 'r1',
    bookId: 'b',
    source: 'https://people.example.edu/~prof/202/homework.htm',
    state: 'reading',
    activity: 'Thinking it over…',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r0',
    bookId: 'b',
    source: 'Syllabus and homework.pdf',
    state: 'reading',
    activity: 'Found 12 lines so far…',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r2',
    bookId: 'b',
    source: 'Assignment 3.pdf',
    state: 'ready',
    assignment: ASSIGNMENT,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r3',
    bookId: 'b',
    source: 'pasted',
    setId: 'set-sep11',
    state: 'ready',
    assignment: ASSIGNMENT,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r4',
    bookId: 'b',
    source: 'https://canvas.example.edu/courses/461/assignments',
    state: 'failed',
    error: 'That page answered 401. A page behind a login can be pasted or photographed instead.',
    createdAt: '',
    updatedAt: '',
  },
]

/** Importing an assignment's review, live, on a course page checked
 *  in mid-September. */
function AssignmentReviewDemo() {
  const [groups, setGroups] = useState(() => reviewOf(ASSIGNMENT, '2026-09-18'))
  return (
    <div className="w-dialog-wide rounded-lg border bg-card p-card">
      <AssignmentReview
        source={ASSIGNMENT.source}
        title={ASSIGNMENT.title}
        groups={groups}
        titles={ASSIGNMENT_SETS}
        onChange={setGroups}
        onLeave={() => {}}
      />
    </div>
  )
}

/** Where an assignment comes from, each way in, with a failed read. */
function AssignmentSourceDemo({ failed, toSet }: { failed?: boolean; toSet?: boolean }) {
  const [mode, setMode] = useState<'write' | 'file' | 'page' | 'paste'>(failed ? 'page' : 'write')
  const [url, setUrl] = useState(failed ? 'https://canvas.example.edu/courses/461/assignments' : '')
  const [text, setText] = useState('')
  const [rows, setRows] = useState<QuestionRow[]>(() => [
    { ...emptyRow(), text: '2.1: 1, 4, 6 (do c)' },
    { ...emptyRow(), text: 'A tank holds 100 L of brine…', inBook: false },
  ])
  return (
    <div className="w-dialog-wide rounded-lg border bg-card p-card">
      <AssignmentSourceFields
        mode={mode}
        onMode={setMode}
        url={url}
        onUrl={setUrl}
        remembered={false}
        updating={toSet ? 'Homework due Sep 11' : undefined}
        text={text}
        onText={setText}
        error={failed ? 'That page answered 401. A page behind a login can be pasted or photographed instead.' : ''}
        onSubmit={() => {}}
        onLeave={() => {}}
        write={
          <div className="space-y-4">
            {!toSet && (
              <div className="flex items-start gap-2">
                <Field label="Title" className="min-w-0 flex-1">
                  <Input placeholder="Problem set 4" />
                </Field>
                <Field label="Due date" className="w-40">
                  <Input type="date" />
                </Field>
              </div>
            )}
            <QuestionRows rows={rows} onRows={setRows} readingOf={() => undefined} onSubmit={() => {}} />
          </div>
        }
      />
    </div>
  )
}

/** The Door needs state to be worth looking at, so it gets a live demo. */
function DoorDemo() {
  const [open, setOpen] = useState(false)
  const rows = open ? DUE : DUE.slice(0, 2)
  return (
    <Box>
      {rows.map((d) => (
        <BoxRow key={d.id} href="#" title={d.title} description={d.book} />
      ))}
      <Door
        className="border-t border-border-muted"
        open={open}
        total={DUE.length}
        onToggle={() => setOpen((o) => !o)}
      />
    </Box>
  )
}

/** The Veil needs state to be worth looking at. */
function VeilDemo() {
  const [shown, setShown] = useState(false)
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase">walkthrough</p>
      <Veil label="Show walkthrough" revealed={shown} onReveal={() => setShown(true)}>
        <div className="space-y-3 text-base">
          <p>
            With <MathInline tex="\dim V = 1" /> a nonzero <MathInline tex="w" /> spans, so{' '}
            <MathInline tex="Tw = \lambda w" /> for some scalar. Any{' '}
            <MathInline tex="v = c\,w" /> then gives
          </p>
          <MathDisplay tex="Tv = T(c\,w) = c\,Tw = c\,\lambda w = \lambda v." />
        </div>
      </Veil>
      {shown && (
        <button
          type="button"
          onClick={() => setShown(false)}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          Reset the demo
        </button>
      )}
    </div>
  )
}

function SegmentedDemo() {
  const [v, setV] = useState<'light' | 'dark' | 'system'>('system')
  return (
    <SegmentedControl
      label="Theme"
      value={v}
      onChange={setV}
      options={[
        { value: 'light', label: 'Paper' },
        { value: 'dark', label: 'Night' },
        { value: 'system', label: 'System' },
      ]}
    />
  )
}

function MenuDemo() {
  const [on, setOn] = useState(false)
  return (
    <Menu label="Homework actions">
      <MenuItem icon={<Plus />} onSelect={() => {}}>
        Add questions
      </MenuItem>
      <MenuItem onSelect={() => {}}>Edit homework</MenuItem>
      <MenuItem icon={<Printer />} hint="3 still being found" onSelect={() => {}}>
        Print worksheet
      </MenuItem>
      <MenuDivider />
      <MenuCheckItem checked={on} onChange={() => setOn((v) => !v)}>
        Turned in
      </MenuCheckItem>
    </Menu>
  )
}

/** The confirm in its three homes: a control in a row (a question's
 *  trash), a menu's last item (Delete homework), a button in a Box
 *  (Settings' Reset). */
function QuestionHeaderDemo() {
  const [asking, setAsking] = useState(false)
  const trash = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex w-96 items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-lg font-semibold">3.A.4</span>
      <IconButton variant="ghost" size="sm" aria-label="Move this question up">
        <ChevronUp />
      </IconButton>
      <IconButton variant="ghost" size="sm" aria-label="Move this question down">
        <ChevronDown />
      </IconButton>
      <IconButton
        ref={trash}
        variant="ghost"
        size="sm"
        aria-label="Remove this question"
        aria-expanded={asking}
        className={cn(asking && 'bg-muted/50 text-foreground')}
        onClick={() => setAsking(true)}
      >
        <Trash2 />
      </IconButton>
      {asking && (
        <ConfirmPopover
          anchor={trash}
          question="Remove 3.A.4?"
          detail="Its guide, what you revealed and its Complete go with it."
          action="Remove"
          onConfirm={() => setAsking(false)}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  )
}

function HomeworkMenuDemo() {
  return (
    <Menu label="Homework actions">
      <MenuItem icon={<Plus />} onSelect={() => {}}>
        Add questions
      </MenuItem>
      <MenuItem icon={<Pencil />} onSelect={() => {}}>
        Edit homework
      </MenuItem>
      <MenuItem icon={<Printer />} onSelect={() => {}}>
        Print worksheet
      </MenuItem>
      <MenuDivider />
      <MenuCheckItem checked={false} onChange={() => {}}>
        Turn in
      </MenuCheckItem>
      <MenuDivider />
      <MenuConfirmItem
        icon={<Trash2 />}
        question="Delete Set 3?"
        detail="Its 8 questions go with it, with their guides and what you checked off."
        action="Delete homework"
        onConfirm={() => {}}
      >
        Delete homework
      </MenuConfirmItem>
    </Menu>
  )
}

function ResetDemo() {
  const [asking, setAsking] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  return (
    <Box tone="destructive" className="w-full">
      <BoxBody className="flex min-h-control items-center gap-3 text-sm">
        <span className="min-w-0 flex-1 text-muted-foreground">Erase every book, set, conversation and setting.</span>
        <Button ref={button} variant="outline" size="sm" className="text-destructive" onClick={() => setAsking(true)}>
          Reset everything
        </Button>
        {asking && (
          <ConfirmPopover
            anchor={button}
            question="Reset everything?"
            detail="Deletes 4 books, 12 homework sets and 2 conversations, and your settings, API key included."
            action="Reset everything"
            onConfirm={() => setAsking(false)}
            onCancel={() => setAsking(false)}
          />
        )}
      </BoxBody>
    </Box>
  )
}

/** Radio rows, live: a choice that needs explaining, and one not made
 *  yet. The Book dialog's numbering is the real one, above. */
function RadioRowsDemo({ start }: { start: 'section' | 'chapter' | '' }) {
  const [v, setV] = useState<'section' | 'chapter' | ''>(start)
  return (
    <RadioRows
      label="Where the problems are"
      value={v}
      onChange={setV}
      options={[
        { value: 'section', label: 'After each section', hint: 'A short Problems list closes every section.' },
        {
          value: 'chapter',
          label: "At the chapter's end",
          hint: "One long list after the chapter's last section, headed by section.",
        },
      ]}
    />
  )
}

function CheckboxDemo() {
  const [on, setOn] = useState(true)
  return (
    <Checkbox checked={on} onChange={() => setOn((v) => !v)}>
      In this book
    </Checkbox>
  )
}

function DialogDemo({ width }: { width: 'default' | 'wide' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open the {width === 'wide' ? '560' : '400'} dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        width={width}
        title={width === 'wide' ? 'Add questions' : 'New homework'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>
              {width === 'wide' ? 'Add 2 questions' : 'Create'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Cancel and Esc close it. The scrim does not: a dialog holding half a
          pasted assignment must not vanish to a stray click.
        </p>
      </Dialog>
    </>
  )
}

export function Components() {
  return (
    <AppShell middle={<span className="text-muted-foreground">Components</span>}>
      <PageShell>
        <div className="space-y-3">
          <h1 className="font-heading text-3xl">Components</h1>
          <p className="font-heading text-lg text-muted-foreground italic">
            Every part of the interface, and every variant of it, on one page.
          </p>
        </div>

        <Section title="Button" note="Five variants, three sizes. 32px by default; all radius-md.">
          <Shelf label="variant">
            <Button variant="primary">New homework</Button>
            <Button variant="outline">Try again</Button>
            <Button variant="secondary">Start over</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Remove book</Button>
          </Shelf>
          <Shelf label="size">
            <Button size="sm">Small · 28</Button>
            <Button>Default · 32</Button>
            <Button size="lg">Large · 40</Button>
          </Shelf>
          <Shelf label="with icon">
            <Button>
              <Plus />
              New homework
            </Button>
            <Button variant="outline">
              <BookOpen />
              Open reader
            </Button>
          </Shelf>
          <Shelf label="icon only">
            <IconButton variant="ghost" aria-label="Settings">
              <Settings className="size-5" />
            </IconButton>
            <IconButton variant="outline" aria-label="Settings">
              <Settings className="size-4" />
            </IconButton>
            <IconButton variant="outline" size="sm" aria-label="Add">
              <Plus className="size-4" />
            </IconButton>
          </Shelf>
          <Shelf label="disabled">
            <Button disabled>New homework</Button>
            <Button variant="outline" disabled>
              Try again
            </Button>
          </Shelf>
        </Section>

        <Section
          title="Box"
          note="The one container: header band, rows, body, footer. Hairline border, no shadow, never nested."
        >
          <Shelf label="header + rows">
            <div className="w-full max-w-xl">
              <Box>
                <BoxHeader>
                  <span>
                    Due
                    <Counter>9</Counter>
                  </span>
                  <Button variant="outline" size="sm">
                    New homework
                  </Button>
                </BoxHeader>
                <BoxRow
                  leading={<BookOpen />}
                  title="Problem set 4"
                  description="Linear Algebra Done Right · 8 questions · due today"
                  trailing={<HomeworkStatusLabel status="soon" />}
                />
                <BoxRow
                  leading={<BookOpen />}
                  title="Chapter 3 exercises"
                  description="Nonlinear Dynamics and Chaos · 5 questions · due tomorrow"
                  trailing={<HomeworkStatusLabel />}
                />
                <BoxFooter>
                  <span>Showing 2 of 9</span>
                </BoxFooter>
              </Box>
            </div>
          </Shelf>
          <Shelf label="rows, no description">
            <div className="w-full max-w-xl">
              <Box>
                <BoxRow title="1 · Vector Spaces" trailing={<RowValue>1</RowValue>} />
                <BoxRow title="2 · Finite-Dimensional Spaces" trailing={<RowValue>27</RowValue>} />
                <BoxRow title="3 · Linear Maps" trailing={<RowValue>51</RowValue>} selected />
              </Box>
            </div>
          </Shelf>
          <Shelf label="body">
            <div className="w-full max-w-xl">
              <Box>
                <BoxHeader>About this book</BoxHeader>
                <BoxBody>
                  Prepared yesterday from a 312-page digital PDF. Sections came from the PDF&apos;s
                  own outline.
                </BoxBody>
                <BoxFooter>
                  <RowValue>sha256:4f1a9c2e</RowValue>
                  <RowValue>18.4 MB</RowValue>
                </BoxFooter>
              </Box>
            </div>
          </Shelf>
          <Shelf label="tone">
            <div className="flex w-full max-w-xl flex-col gap-4">
              <Box tone="warning">
                <BoxBody>Not ready · reading the pages, 62%.</BoxBody>
              </Box>
              <Box tone="destructive">
                <BoxBody>Couldn&apos;t prepare this book. The PDF has no extractable text.</BoxBody>
              </Box>
            </div>
          </Shelf>
        </Section>

        <Section
          title="Door"
          note="The way through truncated content. It opens in place, the same everywhere. Nothing scrolls by itself."
        >
          <Shelf label="in a Box">
            <div className="w-full max-w-xl">
              <DoorDemo />
            </div>
          </Shelf>
        </Section>

        <Section
          title="Flash"
          note="A full-width strip under the top bar: one sentence about the whole screen, at most one action."
        >
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
        </Section>

        <Section
          title="BookCover"
          note="Six hues. A book's is picked when it's added (the one fewest books wear, seeded by its hash) and kept; the Book dialog changes it with the picker. Sized by its container at a 3:4 ratio."
        >
          <Shelf label="hues">
            <div className="grid w-full grid-cols-6 gap-4">
              {BOOKS.slice(0, 6).map((b) => (
                <div key={b.sha256} className="space-y-2">
                  <BookCover
                    title={b.title}
                    author={b.author}
                    hue={b.cover}
                  />
                  <p className="font-mono text-xs text-muted-foreground">
                    {b.cover}
                  </p>
                </div>
              ))}
            </div>
          </Shelf>
          <Shelf label="picker">
            <CoverPickerDemo />
          </Shelf>
          <Shelf label="book tile">
            <div className="grid w-full grid-cols-6 gap-4">
              {BOOKS.filter((b) => b.state.kind === 'ready').slice(0, 3).map((b) => (
                <BookTile key={b.sha256} book={b} />
              ))}
            </div>
          </Shelf>
        </Section>

        <Section
          title="Menu"
          note="The actions a bar has room to name but not to show. Closes on Esc, outside, or after an item runs; arrows move between items."
        >
          <Shelf label="overflow">
            <MenuDemo />
          </Shelf>
        </Section>

        <Section
          title="Confirm"
          note="A destructive act asks where you asked: a small card under the control, one sentence of what goes, Cancel focused, the act never under the pointer. From a menu, the menu stays open behind it."
        >
          <Shelf label="from a control">
            <QuestionHeaderDemo />
          </Shelf>
          <Shelf label="from a menu">
            <HomeworkMenuDemo />
          </Shelf>
          <Shelf label="from a button">
            <ResetDemo />
          </Shelf>
        </Section>

        <Section
          title="Usage"
          note="What a finished job spent, on one quiet line: model · time, a light popover behind it that informs rather than asks. One row per model, a Total with the call count, a footnote when a call failed."
        >
          <Shelf label="the line">
            <div className="py-1">
              <UsageLine usage={USAGE} />
            </div>
          </Shelf>
          <Shelf label="open">
            <div className="h-64">
              <UsageLine usage={USAGE} defaultOpen />
            </div>
          </Shelf>
          <Shelf label="a failed call, and one the provider didn't count">
            <div className="py-1">
              <UsageLine usage={USAGE_FAILED} />
            </div>
          </Shelf>
          <Shelf label="open: a minimum">
            <div className="h-64">
              <UsageLine usage={USAGE_FAILED} defaultOpen />
            </div>
          </Shelf>
          <Shelf label="open: the widest">
            <div className="h-64">
              <UsageLine usage={USAGE_WIDE} defaultOpen />
            </div>
          </Shelf>
        </Section>

        <Section
          title="Skeleton"
          note="The shape of what's coming, at its real size, so nothing moves when it lands. It doesn't pulse: the Spinner is the only loop."
        >
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
        </Section>

        <Section
          title="ResizeHandle"
          note="The seam between two panes, made draggable. A grip at its middle says the edge moves; hover, a drag or focus turn it to ring."
        >
          <Shelf label="pane before">
            <ResizeDemo />
          </Shelf>
        </Section>

        <Section
          title="Spinner"
          note="The one looping animation in the system. A repeating motion means ‘waiting’, so nothing that isn't waiting may borrow it."
        >
          <Shelf label="spinner">
            <Spinner />
            <Spinner className="size-3 text-warning" />
            <Spinner className="size-5 text-muted-foreground" />
          </Shelf>
        </Section>

        <Section
          title="ImportRow"
          note="A book on its way to the shelf. The engine's own phase names; a phase that can count fills a bar, one that can't spins. Once there's an honest estimate, the time left follows in rounded words (lib/eta): from the pace of a counted phase, from past imports for one that can't count. The row owns the controls for exactly its state."
        >
          <Shelf label="rows">
            <Box className="w-full">
              <ImportRow
                book={sampleBook({ sha256: 'b89d3b72', title: 'Introduction to the Theory of Computation', author: '', state: { kind: 'preparing', phase: 'read', done: 140, total: 312 } })}
              />
              <ImportRow
                book={sampleBook({ sha256: 'a41c09e2', title: 'Calculus', author: '', state: { kind: 'preparing', phase: 'contents' } })}
              />
              <ImportRow
                book={sampleBook({ sha256: '7ce04a15', title: 'Griffiths Introduction To Electrodynamics', author: '', state: { kind: 'queued' } })}
              />
              <ImportRow
                book={sampleBook({
                  sha256: '5e2b7f90',
                  title: 'Foundations of Brontolithics',
                  author: '',
                  kind: 'scanned',
                  state: { kind: 'queued', phase: 'read', done: 140, total: 312 },
                })}
              />
              <ImportRow
                book={sampleBook({ sha256: '3a80b5d4', title: 'Organic Chemistry', author: '', state: { kind: 'failed', reason: "This PDF can't be read. PSet couldn't open it." } })}
              />
            </Box>
          </Shelf>
        </Section>

        <Section
          title="StatTile"
          note="A label, a big serif value, one quiet line of context. Reports, never nags."
        >
          <Shelf label="time">
            <div className="grid w-full max-w-2xl grid-cols-3 gap-4">
              <StatTile
                label="Homework"
                chart={1}
                value={<DurationValue minutes={263} />}
                context="so far this week"
              />
              <StatTile
                label="Reading"
                chart={2}
                value={<DurationValue minutes={70} />}
                context="so far this week"
              />
              <StatTile
                label="Asking"
                chart={3}
                value={<DurationValue minutes={40} />}
                context="so far this week"
              />
            </div>
          </Shelf>
          <Shelf label="count">
            <div className="grid w-full max-w-2xl grid-cols-3 gap-4">
              <StatTile label="Questions worked" value={14} context="across 3 problem sets" />
            </div>
          </Shelf>
          <Shelf label="empty week">
            <div className="grid w-full max-w-2xl grid-cols-3 gap-4">
              <StatTile label="Homework" chart={1} value="0" context="nothing yet this week" />
            </div>
          </Shelf>
        </Section>

        <Section
          title="Label"
          note="Outlined by default: border and text share one ink. A status label always carries a word."
        >
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
        </Section>

        <Section
          title="Veil"
          note="Frosted glass over content that exists but shouldn't be read yet. Click anywhere to lift it."
        >
          <Shelf label="veiled">
            <div className="w-panel">
              <VeilDemo />
            </div>
          </Shelf>
        </Section>

        <Section
          title="Dialog"
          note="The one modal: a native <dialog>, two widths, an inert scrim. Cancel and Esc are the only ways out. No X in the corner."
        >
          <Shelf label="400">
            <DialogDemo width="default" />
          </Shelf>
          <Shelf label="560">
            <DialogDemo width="wide" />
          </Shelf>
        </Section>

        <Section
          title="Form controls"
          note="A darker `input` border, because a field has to look like something you can type into. The date picker is the browser's."
        >
          <Shelf label="input">
            <div className="w-80 space-y-4">
              <Field label="Title">
                <Input placeholder="Problem set 4" />
              </Field>
              <Field label="Due date" hint="Optional.">
                <Input type="date" />
              </Field>
              <Field label="API key" error="The endpoint refused this key (401)">
                <Input defaultValue="sk-wrong" className="font-mono" />
              </Field>
              <Field label="Question" hint="Grows as you type; never scrolls.">
                <AutoTextarea placeholder="A reference like 3.B.4, or paste the question" />
              </Field>
            </div>
          </Shelf>
          <Shelf label="page numbers">
            <div className="w-dialog">
              <PageNumbersDemo runs={[{ from: 1, offset: 16 }]} />
            </div>
          </Shelf>
          <Shelf label="lost page">
            <div className="w-dialog">
              <PageNumbersDemo
                runs={[
                  { from: 1, offset: 12 },
                  { from: 97, offset: 11 },
                ]}
              />
            </div>
          </Shelf>
          <Shelf label="problems, sure">
            <div className="w-dialog">
              <ProblemStyleDemo
                style={{
                  form: 'local',
                  where: 'section',
                  heading: 'Problems',
                  example: { label: '3.1 #7', page: 139 },
                  sure: true,
                  confirmed: false,
                }}
              />
            </div>
          </Shelf>
          <Shelf label="problems, unsure">
            <div className="w-dialog">
              <ProblemStyleDemo style={{ form: 'section', where: 'chapter', sure: false, confirmed: false }} />
            </div>
          </Shelf>
          <Shelf label="problems, unknown">
            <div className="w-dialog">
              <ProblemStyleDemo style={undefined} />
            </div>
          </Shelf>
          <Shelf label="radio rows">
            <div className="w-dialog">
              <RadioRowsDemo start="section" />
            </div>
          </Shelf>
          <Shelf label="radio rows, unanswered">
            <div className="w-dialog">
              <RadioRowsDemo start="" />
            </div>
          </Shelf>
          <Shelf label="segmented">
            <SegmentedDemo />
          </Shelf>
          <Shelf label="checkbox">
            <CheckboxDemo />
            <Checkbox checked={false} onChange={() => {}}>
              Unchecked
            </Checkbox>
            <Checkbox checked disabled onChange={() => {}}>
              Disabled
            </Checkbox>
          </Shelf>
        </Section>

        <Section
          title="Boxing on the page"
          note="Drawing a problem's boxes on the scan: solid for its words, dashed for a figure, numbered in the order they're read, each with its kind (click to switch) and a way to take it back. The bar takes the scan pill's place while boxing."
        >
          <Shelf label="boxes">
            <div className="relative h-64 w-dialog rounded-sm border bg-card">
              <DrawnBox box={{ page: 1, x: 0.08, y: 0.2, w: 0.84, h: 0.25, kind: 'text' }} n={1} />
              <DrawnBox box={{ page: 1, x: 0.25, y: 0.62, w: 0.5, h: 0.3, kind: 'figure' }} n={2} />
            </div>
          </Shelf>
          <Shelf label="narrow, right, top">
            <div className="relative h-64 w-dialog overflow-hidden rounded-sm border bg-card">
              <DrawnBox box={{ page: 1, x: 0.06, y: 0.45, w: 0.1, h: 0.3, kind: 'text' }} n={3} />
              <DrawnBox box={{ page: 1, x: 0.82, y: 0.35, w: 0.12, h: 0.3, kind: 'figure' }} n={4} />
              <DrawnBox box={{ page: 1, x: 0.3, y: 0.01, w: 0.3, h: 0.2, kind: 'text' }} n={5} />
            </div>
          </Shelf>
          <Shelf label="bar">
            <div className="relative h-40 w-panel">
              <BoxingDemo />
            </div>
          </Shelf>
        </Section>

        <Section
          title="Adding homework"
          note="New homework and Add questions are one dialog with four ways in: Write (for a new set its title and due date, then the questions, a row each, each saying what it reads as), a file, a course web page, or pasted text. For a document, the review: a block a due date, ticked to become a set; its lines below, ticked to become questions, each saying what it reads as. Dates gone by or already added fold away behind one button; a line that isn't homework shows as one quiet line, unticked. A date matching a set made before is an update: what's new, whose instructions changed, what it no longer lists. In the list, a read waits: reading, ready to review, or failed with why."
        >
          <Shelf label="source">
            <AssignmentSourceDemo />
          </Shelf>
          <Shelf label="adding to a set">
            <AssignmentSourceDemo toSet />
          </Shelf>
          <Shelf label="failed read">
            <AssignmentSourceDemo failed />
          </Shelf>
          <Shelf label="review">
            <AssignmentReviewDemo />
          </Shelf>
          <Shelf label="in the list">
            <div className="w-panel">
              <Box>
                {READS.map((r) => (
                  <AssignmentReadRow
                    key={r.id}
                    r={r}
                    setTitle={r.setId ? 'Homework due Sep 11' : undefined}
                    onReview={() => {}}
                  />
                ))}
              </Box>
            </div>
          </Shelf>
        </Section>

        <Section
          title="Transcript"
          note="Asymmetric: you speak in a soft block, the book answers full-width. Steps are one line per tool call: the live one in full ink with its spinner, fading back to quiet ink when the next begins or the answer ends. Thinking… is the wait on the model when nothing else says so."
        >
          <Shelf label="turn">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <UserTurn>Why does every operator have a minimal polynomial?</UserTurn>
              <Steps steps={['Searched ‘minimal polynomial’ · 6 pages', 'Read p. 142–145']} />
              <AssistantTurn>
                <p>
                  Because powers of <MathInline tex="T" /> cannot stay independent forever{' '}
                  <PageRef pdf={142} />: the space has dimension <MathInline tex="n^2" />.
                </p>
                <MathDisplay tex="I,\;T,\;T^2,\;\dots,\;T^{n^2}" />
              </AssistantTurn>
            </div>
          </Shelf>
          <Shelf label="failed">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <Steps steps={['Searched ‘spectral theorem’ · 5 pages']} />
              <FailedTurn reason="The model connection dropped." />
            </div>
          </Shelf>
          <Shelf label="failed: setup">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <FailedTurn
                reason="There's no OpenRouter key yet. Add yours in Settings, under Connections, then try again."
                onSetup={() => {}}
              />
            </div>
          </Shelf>
          <Shelf label="marks">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <ConversationStart />
              <DayDivider label="Yesterday" />
            </div>
          </Shelf>
          <Shelf label="running">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <Steps running steps={['Searched ‘eigenvalue’ · 6 pages', 'Reading p. 132–134…']} />
            </div>
          </Shelf>
          <Shelf label="thinking">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <UserTurn>What does the damping term do to the spring?</UserTurn>
              <Thinking />
            </div>
          </Shelf>
          <Shelf label="thinking after steps">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <Steps thinking steps={['Searched ‘damped vibrations’ · 6 pages', 'Read p. 150–155']} />
            </div>
          </Shelf>
          <Shelf label="stopped">
            <div className="w-panel space-y-3 rounded-md border bg-rail p-card text-base">
              <p>An eigenvalue is a scalar λ for which some nonzero vector</p>
              <StoppedNote />
            </div>
          </Shelf>
        </Section>

        <Section
          title="Figure reading"
          note="The words a guide is written from, one fact a line, which the student can correct. Where the figure's three readings disagreed, the Box says Check it and names each point, with what the readings said and what was settled: readings that agree are nearly always right, ones that don't nearly always hold a wrong one. Correcting it, or reading it again, clears them."
        >
          <Shelf label="agreed">
            <div className="w-panel">
              <FigureReading q={READ_QUESTION} onCorrect={() => {}} onReread={() => {}} />
            </div>
          </Shelf>
          <Shelf label="disagreed">
            <div className="w-panel">
              <FigureReading q={{ ...READ_QUESTION, readingDoubts: READING_DOUBTS }} onCorrect={() => {}} onReread={() => {}} />
            </div>
          </Shelf>
          <Shelf label="corrected">
            <div className="w-panel">
              <FigureReading q={{ ...READ_QUESTION, readingEdited: true }} onCorrect={() => {}} onReread={() => {}} />
            </div>
          </Shelf>
        </Section>

        <Section
          title="Answer cards"
          note="A short list on purpose: what the book says, how to do it, what it looks like. Tables and code are plain blocks. Everything else is prose."
        >
          <Shelf label="statement">
            <div className="w-panel">
              <Statement kind="Definition" number="2.17" name="linearly independent" page={32}>
                <p>
                  A list <MathInline tex="v_1, \dots, v_m" /> in <MathInline tex="V" /> is linearly
                  independent if the only choice of <MathInline tex="a_1, \dots, a_m" /> that makes{' '}
                  <MathInline tex="a_1 v_1 + \dots + a_m v_m = 0" /> is{' '}
                  <MathInline tex="a_1 = \dots = a_m = 0" />.
                </p>
              </Statement>
            </div>
          </Shelf>
          <Shelf label="worked steps">
            <div className="w-panel">
              <WorkedSteps
                steps={[
                  { math: '\\int_0^1 x e^{x}\\,dx', why: 'Integrate by parts with u = x, dv = eˣ dx.' },
                  { math: '= \\big[x e^{x}\\big]_0^1 - \\int_0^1 e^{x}\\,dx' },
                  { math: '= e - (e - 1)' },
                  { math: '= 1' },
                ]}
              />
            </div>
          </Shelf>
          <Shelf label="plot">
            <div className="w-panel">
              <Plot
                title="Logistic growth against pure exponential"
                x={{ label: 't' }}
                y={{ label: 'population' }}
                series={[
                  { label: 'Exponential', points: EXP },
                  { label: 'Logistic', points: LOGISTIC },
                ]}
              />
            </div>
          </Shelf>
          <Shelf label="table">
            <div className="w-panel">
              <AnswerTable
                columns={['', 'Injective', 'Surjective']}
                rows={[
                  ['Means', 'null T = {0}', 'range T = W'],
                  ['Needs', 'dim V ≤ dim W', 'dim V ≥ dim W'],
                ]}
              />
            </div>
          </Shelf>
          <Shelf label="code">
            <div className="w-panel">
              <CodeBlock
                language="scheme"
                code={`(define (fib n)\n  (if (< n 2)\n      n\n      (+ (fib (- n 1)) (fib (- n 2)))))`}
              />
            </div>
          </Shelf>
        </Section>

        <Section
          title="Guide"
          note="What a structured guide is made of, at the panel's width: a part's eyebrow over a serif title, numbered serif steps, prose at 18/30 with the math a little larger, small muted notes, callouts on their status tints, plots with marks, and the answers card. Content from the phone-plan and eigenvalue examples in ideas/structured-guides.md."
        >
          <Shelf label="part header">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <PartHeader first label="Problem 3.7.8" title="What the new plan costs" />
              <GuidePara>The first part of a guide has no hairline above it. Every later part does.</GuidePara>
              <PartHeader label="(b)" title="When the new plan is cheaper" />
            </div>
          </Shelf>
          <Shelf label="step heading">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <StepHeading number={1} title="Where the sum from 31 comes from" />
              <StepHeading number={2} title="Collect the probability onto each cost" />
              <StepHeading number={12} title="Numbers stay in a column of their own width" />
            </div>
          </Shelf>
          <Shelf label="note">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <Note>
                A quick check: the eigenvalues add to the trace, <MathInline tex="2 + 2 = 4" />, and multiply to the
                determinant, <MathInline tex="4 - 1 = 3" />.
              </Note>
            </div>
          </Shelf>
          <Shelf label="callout">
            <div className="w-panel space-y-4 rounded-md border bg-rail p-card">
              <Callout tone="insight" title="Why the 15 doesn't move">
                <p>
                  The flat fee is paid whatever you say, so it can only shift the answer, never change how it grows
                  with <MathInline tex="p" />.
                </p>
              </Callout>
              <Callout tone="caveat" title="A common slip">
                <p>
                  <MathInline tex="E[1/X]" /> is not <MathInline tex="1/E[X]" />. Here it works only because the
                  minutes are the geometric variable itself.
                </p>
              </Callout>
              <Callout tone="check" title="Check your answer">
                <p>
                  Put <MathInline tex="p = 0.2" /> back in: <MathInline tex="15 + 1/0.2 = 20" /> dollars a month.
                </p>
              </Callout>
              <Callout tone="insight">
                <p>Without a title, the text stands alone.</p>
              </Callout>
            </div>
          </Shelf>
          <Shelf label="answers card">
            <div className="w-panel space-y-4 rounded-md border bg-rail p-card">
              <AnswersCard
                title="Answers"
                answers={[
                  {
                    label: '(a)',
                    children: (
                      <p>
                        <MathInline tex="E[C] = 15 + 1/p" />
                      </p>
                    ),
                  },
                  {
                    label: '(b)',
                    children: (
                      <p>
                        <MathInline tex="p \ge 0.2" /> keeps the new plan the cheaper one.
                      </p>
                    ),
                  },
                  { label: '3.7.7', children: <p>The 3.6.6 caller pays $25.42 a month on the old plan.</p> },
                ]}
              />
              <AnswersCard
                answers={[
                  { children: <p>No, <MathInline tex="F_T" /> is not a valid CDF: it falls after <MathInline tex="t = 1 + \sqrt{2}" />.</p> },
                ]}
              />
            </div>
          </Shelf>
          <Shelf label="answers card, narrow">
            <div className="w-48 rounded-md border bg-rail p-card">
              <AnswersCard
                answers={[
                  { label: '(a)', children: <p><MathInline tex="\lambda_1 = 1" /> and <MathInline tex="\lambda_2 = 3" />.</p> },
                  { label: '(b)', children: <p>Eigenvectors <MathInline tex="(1, -1)" /> and <MathInline tex="(1, 1)" />.</p> },
                ]}
              />
            </div>
          </Shelf>
          <Shelf label="plot with marks">
            <div className="w-panel">
              <Plot
                title="Expected monthly cost against p"
                x={{ label: 'p' }}
                y={{ label: 'dollars' }}
                series={[
                  { label: 'New plan, 15 + 1/p', points: COST },
                  { label: 'Old plan', points: OLD_PLAN },
                ]}
                marks={[
                  { x: 0.2, y: 20, label: 'p ≈ 0.2' },
                  { x: 1 / 30, label: 'p = 1/30' },
                ]}
              />
            </div>
          </Shelf>
          <Shelf label="plot with marks, wide">
            <div className="w-panel-wide">
              <Plot
                title="Expected monthly cost against p"
                x={{ label: 'p' }}
                y={{ label: 'dollars' }}
                series={[{ label: 'New plan, 15 + 1/p', points: COST }]}
                marks={[
                  { x: 0.1, y: 25, label: 'One call in ten ends each minute' },
                  { x: 0.25, y: 19, label: 'p = 0.25' },
                  { x: 0.4, y: 17.5 },
                ]}
              />
            </div>
          </Shelf>
          <Shelf label="prose: reading">
            <div className="w-panel space-y-3 rounded-md border bg-rail p-card">
              <Pages value={PageMap.single(16)}>
                <Document reading blocks={[PLAN_PARA]} />
              </Pages>
            </div>
          </Shelf>
          <Shelf label="prose: ask (unchanged)">
            <div className="w-panel space-y-3 rounded-md border bg-rail p-card text-base">
              <Pages value={PageMap.single(16)}>
                <Document blocks={[PLAN_PARA]} />
              </Pages>
            </div>
          </Shelf>
          <Pages value={PageMap.single(16)}>
            <Shelf label="a guide: phone plan">
              <div className="w-panel space-y-4 rounded-md border bg-rail p-card">
                <PartHeader first label="Problem 3.7.8" title="What the new plan costs" />
                <StepHeading number={1} title="What one minute is worth" />
                <GuidePara>
                  Each minute a caller talks ends the call with probability <MathInline tex="p" />, so the length{' '}
                  <MathInline tex="M" /> of a call is geometric and <MathInline tex="E[M] = 1/p" />{' '}
                  <PageRef pdf={108} />. At $1 a minute, <MathInline tex="1/p" /> minutes is <MathInline tex="1/p" />{' '}
                  dollars.
                </GuidePara>
                <StepHeading number={2} title="Add the flat fee" />
                <GuidePara>The $15 is paid whatever the caller says, so it simply adds on:</GuidePara>
                <MathDisplay tex="E[C] = 15 + \frac{1}{p}" />
                <Callout tone="insight" title="Why it is obviously right">
                  <p>
                    Talkative callers (small <MathInline tex="p" />) cost a lot; a caller who hangs up at once costs
                    just the $15 plus a dollar.
                  </p>
                </Callout>
                <Note>
                  Reading: both plans are priced for the same caller. Pricing the old plan at the 3.6.6
                  caller&apos;s $25.42 instead would give <MathInline tex="p > 0.0959" />.
                </Note>
                <PartHeader label="(b)" title="When the new plan is cheaper" />
                <StepHeading number={1} title="Put the same caller on both plans" />
                <WorkedSteps
                  steps={[
                    { math: '15 + \\frac{1}{p} < 20 + \\frac{(1-p)^{30}}{2p}', why: 'The new plan must cost less for this caller.' },
                    { math: '15 + \\frac{1}{p} < 20', why: 'From p = 0.2 up, the overage term is under a cent.' },
                    { math: 'p > 0.2', why: 'Subtract 15 and take reciprocals; the exact crossing is 0.1999.' },
                  ]}
                />
                <Plot
                  title="Expected monthly cost against p"
                  x={{ label: 'p' }}
                  y={{ label: 'dollars' }}
                  series={[
                    { label: 'New plan', points: COST },
                    { label: 'Old plan', points: OLD_PLAN },
                  ]}
                  marks={[{ x: 0.2, y: 20, label: 'p ≈ 0.2' }]}
                />
                <Callout tone="caveat" title="A common slip">
                  <p>
                    Don't compare the plans at one caller's <MathInline tex="p" /> and then quote the answer for all
                    callers.
                  </p>
                </Callout>
                <AnswersCard
                  title="Answers"
                  answers={[
                    { label: '(a)', children: <p><MathInline tex="E[C] = 15 + 1/p" /></p> },
                    { label: '(b)', children: <p><MathInline tex="p > 0.2" /> (exactly 0.1999): under five minutes a month</p> },
                  ]}
                />
              </div>
            </Shelf>
          </Pages>
          <Shelf label="a guide: eigenvalues, wide">
            <div className="w-panel-wide space-y-4 rounded-md border bg-rail p-card">
              <PartHeader first label="(a)" title="The eigenvalues of A" />
              <StepHeading number={1} title="Turn eigenvalues into a determinant" />
              <GuidePara>
                A nonzero <MathInline tex="v" /> with <MathInline tex="Av = \lambda v" /> exists exactly when{' '}
                <MathInline tex="A - \lambda I" /> sends some nonzero vector to zero, that is, when it is{' '}
                <strong>singular</strong>. So we need
              </GuidePara>
              <MathDisplay tex="\det(A - \lambda I) = 0" />
              <StepHeading number={2} title="Solve the characteristic equation" />
              <WorkedSteps
                steps={[
                  {
                    math: '\\det\\begin{pmatrix} 2-\\lambda & 1 \\\\ 1 & 2-\\lambda \\end{pmatrix} = (2-\\lambda)^2 - 1',
                    why: 'The determinant of a 2 by 2 matrix is ad - bc.',
                  },
                  { math: '(2-\\lambda)^2 - 1 = (\\lambda - 1)(\\lambda - 3)', why: 'A difference of squares.' },
                  { math: '\\lambda = 1 \\quad\\text{or}\\quad \\lambda = 3', why: 'A product is zero when a factor is.' },
                ]}
              />
              <Note>
                A quick check: the eigenvalues add to the trace, <MathInline tex="2 + 2 = 4" />, and multiply to the
                determinant, <MathInline tex="4 - 1 = 3" />.
              </Note>
              <PartHeader label="(b)" title="An eigenvector for each" />
              <StepHeading number={1} title="Find what each shifted matrix sends to zero" />
              <GuidePara>
                For each <MathInline tex="\lambda" />, an eigenvector is any nonzero solution of{' '}
                <MathInline tex="(A - \lambda I)v = 0" />.
              </GuidePara>
              <Callout tone="insight" title="Why they're perpendicular">
                <p>
                  <MathInline tex="A" /> is symmetric, and a symmetric matrix always has perpendicular eigenvectors for
                  different eigenvalues.
                </p>
              </Callout>
              <AnswersCard
                title="Answers"
                answers={[
                  { label: '(a)', children: <p><MathInline tex="\lambda_1 = 1" /> and <MathInline tex="\lambda_2 = 3" />.</p> },
                  { label: '(b)', children: <p><MathInline tex="\lambda = 3" />: <MathInline tex="v = (1, 1)" />. <MathInline tex="\lambda = 1" />: <MathInline tex="v = (1, -1)" />.</p> },
                ]}
              />
            </div>
          </Shelf>
        </Section>

        <Section
          title="Document"
          note="What the engine writes, as the page draws it: a document of blocks, text split into runs by the server (math, marks, citations), so nothing here parses anything. Ask's answer is compact at the panel's width; a guide reads at the reading size, with its hint, walkthrough and answers as three veiled stages, the tree built from its part and step markers (steps number from 1 in each part), and each answer in place at the end of its part. Math that would not parse, and a block that could not be made valid, show as their source, muted, never red. Pages are PDF pages, with the book's offset of 16."
        >
          <Pages value={PageMap.single(16)}>
            <Shelf label="Ask's answer: every block type">
              <div id="document" className="w-panel space-y-3 rounded-md border bg-rail p-card text-base">
                <Document blocks={BLOCKS} onJump={() => {}} />
              </div>
            </Shelf>
            <Shelf label="a guide: the hint, the walkthrough, the answers">
              <div className="w-panel-wide space-y-5 rounded-md border bg-rail p-card text-base">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">hint</p>
                  <Document reading blocks={GUIDE_HINT} onJump={() => {}} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">walkthrough</p>
                  <Document reading blocks={GUIDE} onJump={() => {}} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">answers</p>
                  <AnswersOf blocks={GUIDE} onJump={() => {}} />
                </div>
              </div>
            </Shelf>
            <Shelf label="blocks being written: a paragraph streaming, a plot, worked steps, tidying">
              <div className="w-panel space-y-3 rounded-md border bg-rail p-card text-base">
                <BlockSkeleton
                  type="para"
                  runs={[{ t: 'Each minute a caller talks ends the call with probability ' }, { m: 'p' }, { t: ', so the length' }]}
                  repairing={false}
                />
                <BlockSkeleton type="para" repairing={false} />
                <BlockSkeleton type="step" repairing={false} />
                <BlockSkeleton type="plot" repairing={false} />
                <BlockSkeleton type="derivation" repairing />
              </div>
            </Shelf>
          </Pages>
        </Section>

        <Section title="Brand" note="The mark is fixed-color and never recolored for a theme.">
          <Shelf label="mark">
            <Mark />
            <Mark className="size-12" />
          </Shelf>
          <Shelf label="lockup">
            <BrandLockup />
          </Shelf>
        </Section>

        <Section title="Type" note="Nine steps. 15px is the floor. Nothing in the product is smaller.">
          <Shelf label="display">
            <div className="space-y-2">
              <p className="font-heading text-4xl">Good evening, Jack.</p>
              <p className="font-heading text-3xl">Settings</p>
              <p className="font-heading text-2xl">Problem set 4</p>
              <p className="font-heading text-xl">Due this week</p>
              <p className="font-heading text-lg text-muted-foreground italic">
                Three books, one due tomorrow.
              </p>
            </div>
          </Shelf>
          <Shelf label="text">
            <div className="space-y-2">
              <p className="text-lg font-semibold">Linear Algebra Done Right</p>
              <p className="max-w-layout-reading text-reading">
                A vector space is a set V along with an addition on V and a scalar multiplication on
                V such that the following properties hold.
              </p>
              <p className="text-base">Default UI copy: descriptions, list rows, settings labels.</p>
              <p className="text-sm">Dense · buttons, rail rows, tabs, table cells.</p>
              <p className="text-xs text-muted-foreground">12 pages · prepared yesterday</p>
            </div>
          </Shelf>
          <Shelf label="mono">
            <div className="space-y-2">
              <p className="font-mono text-sm">https://api.example.com/v1</p>
              <p className="font-mono text-xs text-muted-foreground">v0.5.0 · p. 142</p>
            </div>
          </Shelf>
        </Section>

        <Section
          title="Color"
          note="Every token, on its own ground. Status colors are ink; each has one soft tint."
        >
          <Shelf label="surfaces">
            <Swatch name="background" className="bg-background" />
            <Swatch name="card" className="bg-card" />
            <Swatch name="card-header" className="bg-card-header" />
            <Swatch name="rail" className="bg-rail" />
            <Swatch name="muted" className="bg-muted" />
            <Swatch name="accent" className="bg-accent" />
          </Shelf>
          <Shelf label="ink on background">
            <Ink name="foreground" className="text-foreground" />
            <Ink name="muted-foreground" className="text-muted-foreground" />
            <Ink name="primary" className="text-primary" />
            <Ink name="success" className="text-success" />
            <Ink name="warning" className="text-warning" />
            <Ink name="destructive" className="text-destructive" />
          </Shelf>
          <Shelf label="ink on its tint">
            <Ink name="primary" className="bg-primary-soft px-2 text-primary" />
            <Ink name="success" className="bg-success-soft px-2 text-success" />
            <Ink name="warning" className="bg-warning-soft px-2 text-warning" />
            <Ink name="destructive" className="bg-destructive-soft px-2 text-destructive" />
          </Shelf>
          <Shelf label="lines">
            <Swatch name="border" className="bg-border" />
            <Swatch name="border-muted" className="bg-border-muted" />
            <Swatch name="input" className="bg-input" />
            <Swatch name="ring" className="bg-ring" />
          </Shelf>
          <Shelf label="charts">
            <Swatch name="chart-1" className="bg-chart-1" />
            <Swatch name="chart-2" className="bg-chart-2" />
            <Swatch name="chart-3" className="bg-chart-3" />
            <Swatch name="chart-4" className="bg-chart-4" />
            <Swatch name="chart-5" className="bg-chart-5" />
          </Shelf>
        </Section>

        <Section
          title="Geometry"
          note="Every spacing step and radius that exists. A gap in this row is a token that doesn't compile."
        >
          <Shelf label="spacing">
            <div className="flex flex-wrap items-end gap-3">
              {/* Literal classes on purpose: this row proves the UTILITY
                  compiles, which is what app code depends on. A step whose
                  token is missing renders no bar. */}
              <Step label="1" className="h-1" />
              <Step label="2" className="h-2" />
              <Step label="3" className="h-3" />
              <Step label="4" className="h-4" />
              <Step label="5" className="h-5" />
              <Step label="6" className="h-6" />
              <Step label="7" className="h-7" />
              <Step label="8" className="h-8" />
              <Step label="9" className="h-9" />
              <Step label="10" className="h-10" />
              <Step label="11" className="h-11" />
              <Step label="12" className="h-12" />
              <Step label="14" className="h-14" />
              <Step label="16" className="h-16" />
              <Step label="20" className="h-20" />
              <Step label="24" className="h-24" />
            </div>
          </Shelf>
          <Shelf label="semantic">
            <div className="flex flex-wrap items-end gap-3">
              <Step label="card" className="h-card" />
              <Step label="page" className="h-page" />
              <Step label="section" className="h-section" />
              <Step label="mark" className="h-mark" />
              <Step label="control-sm" className="h-control-sm" />
              <Step label="control" className="h-control" />
              <Step label="control-lg" className="h-control-lg" />
              <Step label="row" className="h-row" />
              <Step label="topbar" className="h-topbar" />
            </div>
          </Shelf>
          <Shelf label="radius">
            <div className="flex flex-wrap items-end gap-4">
              <Radius label="sm" className="rounded-sm" />
              <Radius label="md" className="rounded-md" />
              <Radius label="lg" className="rounded-lg" />
              <Radius label="full" className="rounded-full" />
            </div>
          </Shelf>
        </Section>
      </PageShell>
    </AppShell>
  )
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`size-12 rounded-md border ${className}`} />
      <span className="font-mono text-xs text-muted-foreground">{name}</span>
    </div>
  )
}

function Ink({ name, className }: { name: string; className: string }) {
  return <span className={`rounded-md py-1 text-sm ${className}`}>{name}</span>
}

function Step({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-4 bg-primary ${className}`} />
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Radius({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`size-12 border bg-card ${className}`} />
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

/** The Book dialog's colour picker, live. */
function CoverPickerDemo() {
  const [hue, setHue] = useState<CoverHue>('rose')
  return <CoverPicker value={hue} onChange={setHue} />
}
