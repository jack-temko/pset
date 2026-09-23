import { useState, type ReactNode } from 'react'
import { BookOpen, Check, Clock, Plus, Settings, TriangleAlert } from 'lucide-react'

import { AppShell, PageShell } from '@/components/shell'
import { BookCover } from '@/components/book-cover'
import { BrandLockup, Mark } from '@/components/brand'
import { Box, BoxBody, BoxFooter, BoxHeader, BoxRow, Counter, RowValue } from '@/components/box'
import { Button, IconButton } from '@/components/button'
import { ImportRow } from '@/components/import-row'
import { Door } from '@/components/door'
import { Flash } from '@/components/flash'
import { HomeworkStatusLabel } from '@/components/homework-status'
import { Label } from '@/components/label'
import {
  AssistantTurn,
  ConversationStart,
  DayDivider,
  FailedTurn,
  MathDisplay,
  MathInline,
  AnswerTable,
  CodeBlock,
  PageRef,
  Plot,
  Statement,
  Steps,
  StoppedNote,
  UserTurn,
  WorkedSteps,
} from '@/components/transcript'
import { Veil } from '@/components/veil'
import { Spinner } from '@/components/spinner'
import { Skeleton } from '@/components/skeleton'
import { Menu, MenuCheckItem, MenuDivider, MenuItem } from '@/components/menu'
import { SegmentedControl } from '@/components/segmented-control'
import { Checkbox } from '@/components/checkbox'
import { Dialog } from '@/components/dialog'
import { AutoTextarea, Field, Input } from '@/components/input'
import { DurationValue, StatTile } from '@/components/stat-tile'
import { coverHueFromSha } from '@/lib/covers'
import { BOOKS, DUE, SEGMENTS, sampleBook } from '@/components/fixtures'
import { CardSkeleton, Segments } from '@/components/segments'
import { PageOffset } from '@/lib/pages'
import { BookTile } from '@/components/book-tile'


/** Sample series for the Plot demo: logistic growth levelling at 100
 *  against the exponential it starts out as. */
const EXP: [number, number][] = [[0.0, 10.0], [0.5, 12.84], [1.0, 16.49], [1.5, 21.17], [2.0, 27.18], [2.5, 34.9], [3.0, 44.82], [3.5, 57.55], [4.0, 73.89], [4.5, 94.88]]
const LOGISTIC: [number, number][] = [[0.0, 10.0], [0.5, 12.49], [1.0, 15.48], [1.5, 19.04], [2.0, 23.2], [2.5, 27.94], [3.0, 33.24], [3.5, 39.0], [4.0, 45.09], [4.5, 51.32], [5.0, 57.51], [5.5, 63.48], [6.0, 69.06], [6.5, 74.13], [7.0, 78.63], [7.5, 82.53], [8.0, 85.85]]

/**
 * Every component and every variant, on one page, in the app itself.
 *
 * Not in the nav and not part of the product's three screens: it is the
 * page you open to see what a change did. Add a component here the moment
 * you build one; anything missing from this page is unreviewed.
 */

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
      <MenuDivider />
      <MenuCheckItem checked={on} onChange={() => setOn((v) => !v)}>
        Turned in
      </MenuCheckItem>
    </Menu>
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
          note="Six hues, derived from the sha and never chosen. Sized by its container at a 3:4 ratio."
        >
          <Shelf label="hues">
            <div className="grid w-full grid-cols-6 gap-4">
              {BOOKS.slice(0, 6).map((b) => (
                <div key={b.sha256} className="space-y-2">
                  <BookCover
                    title={b.title}
                    author={b.author}
                    hue={coverHueFromSha(b.sha256)}
                  />
                  <p className="font-mono text-xs text-muted-foreground">
                    {coverHueFromSha(b.sha256)}
                  </p>
                </div>
              ))}
            </div>
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
          note="A book on its way to the shelf. The engine's own phase names; a phase that can count fills a bar, one that can't spins. The row owns the controls for exactly its state."
        >
          <Shelf label="rows">
            <Box className="w-full">
              <ImportRow
                book={sampleBook({ sha256: 'b89d3b72', title: 'Introduction to the Theory of Computation', author: '', state: { kind: 'preparing', phase: 'read', done: 140, total: 312 } })}
              />
              <ImportRow
                book={sampleBook({ sha256: 'a41c09e2', title: 'Calculus', author: '', state: { kind: 'preparing', phase: 'search' } })}
              />
              <ImportRow
                book={sampleBook({ sha256: '7ce04a15', title: 'Griffiths Introduction To Electrodynamics', author: '', state: { kind: 'queued' } })}
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
            <div className="w-56">
              <StatTile label="Questions worked" value={14} context="across 3 problem sets" />
            </div>
          </Shelf>
          <Shelf label="empty week">
            <div className="w-56">
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
          title="Transcript"
          note="Asymmetric: you speak in a soft block, the book answers full-width. Steps are one line per tool call."
        >
          <Shelf label="turn">
            <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
              <UserTurn>Why does every operator have a minimal polynomial?</UserTurn>
              <Steps steps={['Searched ‘minimal polynomial’ · 6 pages', 'Read p. 142–145']} />
              <AssistantTurn>
                <p>
                  Because powers of <MathInline tex="T" /> cannot stay independent forever{' '}
                  <PageRef page={142} />: the space has dimension <MathInline tex="n^2" />.
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
                reason="There's no chat model set up yet. Add one in Settings, under Connections, then try again."
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
          <Shelf label="stopped">
            <div className="w-panel space-y-3 rounded-md border bg-rail p-card text-base">
              <p>An eigenvalue is a scalar λ for which some nonzero vector</p>
              <StoppedNote />
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
          title="Segments"
          note="An answer as the engine sends it: prose and every card kind, at the panel's width, with the book's page offset of 16. The raw block is a card that couldn't be repaired."
        >
          <PageOffset value={16}>
            <div id="segments" className="w-panel space-y-3 rounded-md border bg-rail p-card text-base">
              <Segments segments={SEGMENTS} onJump={() => {}} />
              <CardSkeleton kind="plot" repairing={false} />
              <CardSkeleton kind="steps" repairing />
            </div>
          </PageOffset>
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

        <Section title="Type" note="Nine steps. 14px is the floor. Nothing in the product is smaller.">
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
