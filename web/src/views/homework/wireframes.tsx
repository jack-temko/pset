import { useState, type ReactNode } from 'react'
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Focus,
  Pencil,
  Plus,
  Printer,
  SquareDashedMousePointer,
  Trash2,
  X,
} from 'lucide-react'

import { Box, BoxBody, BoxHeader, BoxRow, RowValue } from '@/components/box'
import { Button, IconButton } from '@/components/button'
import { DoorAction } from '@/components/door'
import { HomeworkStatusLabel } from '@/components/homework-status'
import { Menu, MenuCheckItem, MenuDivider, MenuItem } from '@/components/menu'
import { Spinner } from '@/components/spinner'
import { DurationValue, StatTile } from '@/components/stat-tile'
import { MathInline } from '@/components/transcript'
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav'
import { Veil } from '@/components/veil'
import { cn } from '@/lib/utils'
import { sampleFigure } from '@/views/mock/assets'

/**
 * The homework redesign's wireframes (gate 2 of the grill), built from the
 * real component library on static sample data, so what is agreed is what
 * will be built. Everything here is a stand-in for the parts that don't
 * exist yet (the progress strip, the finish page); the rest is the app's
 * own components, live: the veils lift, the menus open.
 */

type Mark = 'done' | 'current' | 'waiting' | 'failed'
const QUESTIONS = ['4.27', '4.25', '4.32', '3.12', '2.31', '3.14', '4.30', '5.02']
const OPEN: Mark[] = ['done', 'done', 'current', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting']
const CURRENT_DONE: Mark[] = ['done', 'done', 'done', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting']

const MARK_CLASS: Record<Mark, string> = {
  done: 'bg-primary',
  current: 'bg-primary-soft ring-2 ring-primary',
  waiting: 'bg-muted',
  failed: 'bg-warning',
}
const MARK_WORD: Record<Mark, string> = { done: 'done', current: 'current', waiting: 'waiting', failed: 'failed' }

/** One segment per question. In the pinned strip each is a button with the
 *  strip's full height as its target; on a list row they are only marks. */
function Segments({ marks, jump }: { marks: Mark[]; jump?: boolean }) {
  return (
    <div className="flex gap-1">
      {marks.map((m, i) =>
        jump ? (
          <button
            key={i}
            type="button"
            aria-label={`Go to ${QUESTIONS[i]}, ${MARK_WORD[m]}`}
            aria-current={m === 'current' || undefined}
            className="flex h-control-sm flex-1 cursor-pointer items-center"
          >
            <span className={cn('h-2 w-full rounded-full', MARK_CLASS[m])} />
          </button>
        ) : (
          <span key={i} className={cn('h-2 flex-1 rounded-full', MARK_CLASS[m])} />
        ),
      )}
    </div>
  )
}

const progressText = (marks: Mark[]) => `${marks.filter((m) => m === 'done').length} of ${marks.length} done · about 1 h 40 m left`

/** The panel's column, under its Ask | Homework header, at a real width. */
function Panel({ wide, height = 760, children }: { wide?: boolean; height?: number; children: ReactNode }) {
  return (
    <aside
      style={{ height }}
      className={cn('flex shrink-0 flex-col overflow-hidden rounded-md border bg-rail', wide ? 'w-panel-wide' : 'w-panel')}
    >
      <div className="flex h-row shrink-0 items-center justify-between border-b px-card">
        <UnderlineNav className="-mb-px h-full">
          <UnderlineTab active={false} onClick={() => {}}>
            Ask
          </UnderlineTab>
          <UnderlineTab active onClick={() => {}}>
            Homework
          </UnderlineTab>
        </UnderlineNav>
        <IconButton variant="ghost" size="sm" aria-label="Focus on the panel">
          <Focus />
        </IconButton>
      </div>
      {children}
    </aside>
  )
}

function Frame({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <figure className="space-y-2">
      <figcaption className="max-w-panel space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </figcaption>
      {children}
    </figure>
  )
}

function SetMenu() {
  return (
      <Menu label="Homework actions">
        <MenuItem icon={<Plus />} onSelect={() => {}}>
          Add questions
        </MenuItem>
        <MenuItem icon={<SquareDashedMousePointer />} onSelect={() => {}}>
          Box one on the page
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
        <MenuItem icon={<Trash2 />} onSelect={() => {}}>
          Delete homework
        </MenuItem>
      </Menu>
  )
}

function SetHeader() {
  return (
    <div className="flex h-row shrink-0 items-center gap-2 border-b px-2">
      <IconButton variant="ghost" size="sm" aria-label="Back to homework">
        <ChevronLeft />
      </IconButton>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">Problem set 4</span>
      <SetMenu />
    </div>
  )
}

/** The pinned progress: a segment per question, and what it adds up to. */
function Progress({ marks }: { marks: Mark[] }) {
  return (
    <div className="shrink-0 space-y-1 border-b px-card pt-1 pb-2">
      <Segments marks={marks} jump />
      <p className="text-xs text-muted-foreground tabular-nums">{progressText(marks)}</p>
    </div>
  )
}

function QuestionHead({ done }: { done?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-semibold">4.25</span>
      {done && <Check aria-label="Done" className="size-4 text-success" />}
      <span className="flex-1" />
      <Button variant="outline" size="sm">
        <BookOpen />
        Show in book
      </Button>
      <Menu label="Question actions">
        <MenuItem icon={<ChevronUp />} onSelect={() => {}}>
          Move up
        </MenuItem>
        <MenuItem icon={<ChevronDown />} onSelect={() => {}}>
          Move down
        </MenuItem>
        <MenuItem icon={<Trash2 />} onSelect={() => {}}>
          Remove this question
        </MenuItem>
        <MenuDivider />
        <MenuItem icon={<SquareDashedMousePointer />} onSelect={() => {}}>
          This isn't the right problem
        </MenuItem>
        <MenuItem icon={<Pencil />} onSelect={() => {}}>
          Edit the professor's instructions
        </MenuItem>
      </Menu>
    </div>
  )
}

function Statement() {
  return (
    <div className="space-y-4">
      <p className="text-base">
        Use superposition to find <MathInline tex="v_o" /> in the circuit of Fig. 4.109, with the professor’s sources{' '}
        <MathInline tex="V_s = 10\ \text{V}" /> and <MathInline tex="I_s = 2\ \text{A}" />.
      </p>
      <figure className="space-y-1">
        <img src={sampleFigure('Fig. 4.109')} alt="Fig. 4.109" className="w-full rounded-md border bg-card" />
        <figcaption className="text-xs text-muted-foreground">Fig. 4.109</figcaption>
      </figure>
      <Box>
        <BoxHeader>From your professor</BoxHeader>
        <BoxBody className="text-sm">no PSpice or MultiSim</BoxBody>
      </Box>
    </div>
  )
}

function HelpStage({ label, children }: { label: string; children: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <Veil label={`Show ${label.toLowerCase()}`} revealed={revealed} onReveal={() => setRevealed(true)}>
        <div className="space-y-3 text-base">{children}</div>
      </Veil>
    </div>
  )
}

function Help() {
  return (
    <div className="space-y-5">
      <HelpStage label="Hint">
        <p>Go around the loop once and write that the voltage rises equal the drops. The resistors are in series, so they share one current.</p>
      </HelpStage>
      <HelpStage label="Walkthrough">
        <p>
          Going clockwise, the source gives a rise of <MathInline tex="10\ \text{V}" /> and the two resistors are drops, so{' '}
          <MathInline tex="10 = 4i + 8i" />.
        </p>
        <p>
          Add the drops and divide by <MathInline tex="12\ \Omega" /> to get the current, then use <MathInline tex="P = i^2 R" /> for the power in the{' '}
          <MathInline tex="8\ \Omega" /> resistor.
        </p>
      </HelpStage>
      <HelpStage label="Answers">
        <p>
          <MathInline tex="i = 0.83\ \text{A}" /> clockwise; <MathInline tex="P = 5.6\ \text{W}" />.
        </p>
      </HelpStage>
    </div>
  )
}

function Footer({ done }: { done?: boolean }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-t p-card">
      <Button variant="ghost" size="sm">
        Ask about this
      </Button>
      {done ? <Button variant="outline">Mark incomplete</Button> : <Button>Next question</Button>}
    </div>
  )
}

function Walkthrough({ done }: { done?: boolean }) {
  const marks = done ? CURRENT_DONE : OPEN
  return (
    <>
      <SetHeader />
      <Progress marks={marks} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-card">
        <QuestionHead done={done} />
        <Statement />
        <Help />
      </div>
      <Footer done={done} />
    </>
  )
}

/** Focus: the question stays put on the left while the help scrolls. */
function FocusWalkthrough() {
  return (
    <>
      <SetHeader />
      <Progress marks={OPEN} />
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <div className="min-h-0 space-y-5 overflow-y-auto border-r p-card">
          <QuestionHead />
          <Statement />
        </div>
        <div className="min-h-0 overflow-y-auto p-card">
          <Help />
        </div>
      </div>
      <Footer />
    </>
  )
}

const MINUTES = [18, 14, 41, 33, 9, 12, 27, 20]

/** How hard each question is, relative to the set: the backend idea this
 *  bar would use (ideas/time-remaining-estimate.md). Mocked here. */
const DIFFICULTY = [2, 2, 4, 3, 1, 1, 3, 2]

/** The count that opens the list of the questions: with the marks gone it is
 *  how you jump. A stand-in list, built from Box rows. */
function Switcher({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const rows: { q: string; state: Mark; word: string }[] = QUESTIONS.slice(0, 5).map((q, i) => ({
    q,
    state: OPEN[i],
    word: OPEN[i] === 'done' ? 'Done' : OPEN[i] === 'current' ? 'Here' : 'Waiting',
  }))
  return (
    <span className="relative">
      <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="tabular-nums">
        {children}
        <ChevronDown />
      </Button>
      {open && (
        <Box className="absolute top-full left-0 z-10 mt-1 w-64 shadow-floating">
          {rows.map((r) => (
            <BoxRow
              key={r.q}
              selected={r.state === 'current'}
              onClick={() => setOpen(false)}
              leading={r.state === 'done' ? <Check className="text-success" /> : undefined}
              title={r.q}
              trailing={<span className="text-xs text-muted-foreground">{r.word}</span>}
            />
          ))}
        </Box>
      )}
    </span>
  )
}

const DONE_FRACTION = 3 / 8

function OptionBody() {
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-hidden p-card">
      <QuestionHead />
      <Statement />
    </div>
  )
}

/** A: no extra row. The count sits in the header and the header's bottom edge is the bar. */
function ProgressA() {
  return (
    <>
      <div className="relative flex h-row shrink-0 items-center gap-1 border-b px-2">
        <IconButton variant="ghost" size="sm" aria-label="Back to homework">
          <ChevronLeft />
        </IconButton>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">Problem set 4</span>
        <Switcher>3 of 8 · about 1 h 40 m</Switcher>
        <SetMenu />
        <span aria-hidden className="absolute inset-x-0 -bottom-px h-1 bg-muted">
          <span className="block h-full bg-primary" style={{ width: `${DONE_FRACTION * 100}%` }} />
        </span>
      </div>
      <OptionBody />
    </>
  )
}

/** B: one slim row: the count, a plain bar, the time left. */
function ProgressB() {
  return (
    <>
      <SetHeader />
      <div className="flex shrink-0 items-center gap-3 border-b px-2 py-1">
        <Switcher>3 of 8</Switcher>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${DONE_FRACTION * 100}%` }} />
        </span>
        <span className="pr-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">about 1 h 40 m left</span>
      </div>
      <OptionBody />
    </>
  )
}

/** C: B's one row, with the bar cut into the questions, each as wide as it is
 *  hard, so what is left is how much work is left, not how many questions. */
function ProgressC() {
  return (
    <>
      <SetHeader />
      <div className="flex shrink-0 items-center gap-3 border-b px-2 py-1">
        <Switcher>3 of 8</Switcher>
        <span className="flex flex-1 gap-1">
          {OPEN.map((m, i) => (
            <span
              key={i}
              style={{ flexGrow: DIFFICULTY[i], flexBasis: 0 }}
              className={cn('h-1 rounded-full', m === 'done' ? 'bg-primary' : m === 'current' ? 'bg-primary/40' : 'bg-muted')}
            />
          ))}
        </span>
        <span className="pr-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">about 1 h 40 m left</span>
      </div>
      <OptionBody />
    </>
  )
}

/** D: no extra row either. A small ring beside the title, and the time left. */
function ProgressD() {
  const r = 9
  const c = 2 * Math.PI * r
  return (
    <>
      <div className="flex h-row shrink-0 items-center gap-1 border-b px-2">
        <IconButton variant="ghost" size="sm" aria-label="Back to homework">
          <ChevronLeft />
        </IconButton>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">Problem set 4</span>
        <Switcher>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden className="-rotate-90">
            <circle cx="12" cy="12" r={r} fill="none" strokeWidth="3" stroke="currentColor" className="text-muted" />
            <circle
              cx="12"
              cy="12"
              r={r}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              stroke="currentColor"
              className="text-primary"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - DONE_FRACTION)}
            />
          </svg>
          3 of 8 · 1 h 40 m
        </Switcher>
        <SetMenu />
      </div>
      <OptionBody />
    </>
  )
}

function Finish() {
  const hardest = Math.max(...MINUTES)
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto p-card py-8 text-center">
      <div className="space-y-2">
        <h2 className="font-heading text-4xl">Long night. It shows.</h2>
        <p className="font-heading text-lg text-muted-foreground italic">All 8 done in Problem set 4.</p>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 text-left">
        <StatTile label="Total time" value={<DurationValue minutes={174} />} context="across 8 questions" />
        <StatTile label="Per question" value={<DurationValue minutes={22} />} context="about, on average" />
      </div>
      <div className="w-full space-y-2 text-left">
        <p className="text-xs text-muted-foreground">Time per question</p>
        <div className="flex h-24 items-end gap-1">
          {MINUTES.map((m, i) => (
            <span
              key={i}
              style={{ height: `${(m / hardest) * 100}%` }}
              className={cn('flex-1 rounded-sm', m === hardest ? 'bg-primary' : 'bg-foreground/25')}
            />
          ))}
        </div>
        <div className="flex gap-1 text-xs text-muted-foreground tabular-nums">
          {QUESTIONS.map((q) => (
            <span key={q} className="flex-1 text-center">
              {q}
            </span>
          ))}
        </div>
      </div>
      <Box className="w-full text-left">
        <BoxHeader>The hardest</BoxHeader>
        <BoxRow title="4.32" description="Longest, and the highest difficulty in the set" trailing={<RowValue>41m</RowValue>} />
        <BoxRow title="3.12" description="Second longest" trailing={<RowValue>33m</RowValue>} />
      </Box>
      <div className="flex items-center gap-3">
        <Button size="lg">Turn in</Button>
        <Button variant="ghost" size="lg">
          Back to list
        </Button>
      </div>
    </div>
  )
}

function List() {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-card">
      <Box>
        <BoxRow
          leading={<Spinner className="size-4" label="Reading" />}
          title="Reading EECS 202 Homework"
          description="Thinking it over… · about a minute left"
          trailing={
            <IconButton variant="ghost" size="sm" aria-label="Stop reading">
              <X />
            </IconButton>
          }
        />
      </Box>
      <Box>
        <BoxRow
          onClick={() => {}}
          title="Problem set 4"
          description={
            <span className="block space-y-1 pt-1">
              <Segments marks={OPEN} />
              <span className="block tabular-nums">{progressText(OPEN)}</span>
            </span>
          }
          trailing={<HomeworkStatusLabel status="soon" />}
        />
        <BoxRow
          onClick={() => {}}
          title="Chapter 3 exercises"
          description={
            <span className="block space-y-1 pt-1">
              <Segments marks={['waiting', 'waiting']} />
              <span className="block tabular-nums">0 of 2 done · due Tuesday</span>
            </span>
          }
        />
        <DoorAction icon={<Plus aria-hidden />} onClick={() => {}} className="border-t border-border-muted">
          New homework
        </DoorAction>
      </Box>
      <p className="text-xs text-muted-foreground">Turned in</p>
      <Box>
        <BoxRow onClick={() => {}} title="Problem set 3" description="1 of 1 done" trailing={<HomeworkStatusLabel status="turned-in" />} />
      </Box>
    </div>
  )
}

function Group({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1 border-b pb-3">
        <h2 className="font-heading text-xl">{title}</h2>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="flex flex-wrap items-start gap-8">{children}</div>
    </section>
  )
}

export function HomeworkWireframes() {
  return (
    <div className="space-y-section">
      <Group
        title="Progress, four options"
        note="The marks cost two rows and told you little beyond 3 of 8. In every option the count opens a list of the questions, which is how you jump now. Click the count."
      >
        <Frame title="A. In the header" note="Costs no extra row: the count sits in the header and its bottom edge is the bar. A long set title truncates.">
          <Panel height={420}>
            <ProgressA />
          </Panel>
        </Frame>
        <Frame title="B. One slim row" note="Costs one 36px row: the count, a plain bar, the time left. Clearest, nothing truncates.">
          <Panel height={420}>
            <ProgressB />
          </Panel>
        </Frame>
        <Frame title="C. Bar weighted by difficulty" note="Costs the same one row as B. Each question is as wide as it is hard, so the bar shows how much work is left, not how many questions. Without a difficulty index it is B.">
          <Panel height={420}>
            <ProgressC />
          </Panel>
        </Frame>
        <Frame title="D. A ring in the header" note="Costs no extra row: a small ring with the count and time beside the title. A long set title truncates.">
          <Panel height={420}>
            <ProgressD />
          </Panel>
        </Frame>
      </Group>
      <Group
        title="Walkthrough, panel width"
        note="The progress strip and the footer are pinned; only the middle scrolls. Lift a veil, open a menu, hover a segment: these are the real components."
      >
        <Frame title="A question with a written guide" note="The one primary is Next question. Tapping a segment jumps to that question.">
          <Panel>
            <Walkthrough />
          </Panel>
        </Frame>
        <Frame title="A completed question" note="The same button turns into Mark incomplete: undo in place, no toast.">
          <Panel>
            <Walkthrough done />
          </Panel>
        </Frame>
      </Group>
      <Group title="Focus, 800px" note="Two columns: the question stays pinned on the left while the help scrolls on the right.">
        <Frame title="The panel in Focus" note="Strip and footer are unchanged.">
          <Panel wide>
            <FocusWalkthrough />
          </Panel>
        </Frame>
      </Group>
      <Group title="Finish page and list" note="The finish page fills the pane after the last question. The list is where you switch sets.">
        <Frame title="Finish page" note="A greeting line like Home's, total and per-question time, the hardest, Turn in as the one primary.">
          <Panel>
            <Finish />
          </Panel>
        </Frame>
        <Frame title="The list" note="Each set carries the same strip and time left; tapping opens it on the first incomplete question.">
          <Panel>
            <List />
          </Panel>
        </Frame>
      </Group>
    </div>
  )
}
