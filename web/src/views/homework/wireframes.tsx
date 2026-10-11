import { useState, type ReactNode } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Columns2,
  Pencil,
  Plus,
  Printer,
  SquareDashedMousePointer,
  Trash2,
  X,
} from 'lucide-react';

import { Box, BoxBody, BoxHeader, BoxRow, RowValue } from '@/components/box';
import { Button, IconButton } from '@/components/button';
import { DoorAction } from '@/components/door';
import { HomeworkStatusLabel } from '@/components/homework-status';
import { Menu, MenuCheckItem, MenuDivider, MenuItem } from '@/components/menu';
import { Spinner } from '@/components/spinner';
import { DurationValue, StatTile } from '@/components/stat-tile';
import { MathInline } from '@/components/transcript';
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav';
import { cn } from '@/lib/utils';
import { sampleFigure } from '@/views/mock/assets';
import { FailedQuestion } from './failed-question';
import { mockError } from '@/views/mock/errors';
import { makeQuestion } from './world';

/**
 * The homework redesign's wireframes (gate 2 of the grill), built from the
 * real component library on static sample data, so what is agreed is what
 * will be built. Everything here is a stand-in for the parts that don't
 * exist yet (the progress strip, the finish page); the rest is the app's
 * own components, live: the veils lift, the menus open.
 */

type Mark = 'done' | 'current' | 'waiting' | 'failed';
const QUESTIONS = [
  '4.27',
  '4.25',
  '4.32',
  '3.12',
  '2.31',
  '3.14',
  '4.30',
  '5.02',
];
const OPEN: Mark[] = [
  'done',
  'done',
  'current',
  'waiting',
  'waiting',
  'waiting',
  'waiting',
  'waiting',
];
const CURRENT_DONE: Mark[] = [
  'done',
  'done',
  'done',
  'waiting',
  'waiting',
  'waiting',
  'waiting',
  'waiting',
];

const MARK_FILL: Record<Mark, string> = {
  done: 'bg-primary',
  current: 'bg-primary/40',
  waiting: 'bg-muted',
  failed: 'bg-warning',
};

/** How hard each question is, relative to the set: the backend idea this
 *  bar uses (ideas/time-remaining-estimate.md). Mocked here. */
const DIFFICULTY = [2, 2, 4, 3, 1, 1, 3, 2];

/** The set's progress as a bar cut into its questions, each as wide as it is
 *  hard, so what is left is how much work is left, not how many questions.
 *  Not a control: jumping is the count's list. */
function WeightedBar({
  marks,
  className,
}: {
  marks: Mark[];
  className?: string;
}) {
  return (
    <span aria-hidden className={cn('flex gap-1', className)}>
      {marks.map((m, i) => (
        <span
          key={i}
          style={{ flexGrow: DIFFICULTY[i] ?? 1, flexBasis: 0 }}
          className={cn('h-1 rounded-full', MARK_FILL[m])}
        />
      ))}
    </span>
  );
}

const doneOf = (marks: Mark[]) =>
  `${marks.filter((m) => m === 'done').length} of ${marks.length}`;
const TIME_LEFT = 'about 1 h 40 m left';

/** The panel's column, under its Ask | Homework header, at a real width. */
function Panel({
  wide,
  height = 760,
  children,
}: {
  wide?: boolean;
  height?: number;
  children: ReactNode;
}) {
  return (
    <aside
      style={{ height }}
      className={cn(
        'flex shrink-0 flex-col overflow-hidden rounded-md border bg-rail',
        wide ? 'w-panel-wide' : 'w-panel',
      )}
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
          <Columns2 />
        </IconButton>
      </div>
      {children}
    </aside>
  );
}

function Frame({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <figure className="space-y-2">
      <figcaption className="max-w-panel space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </figcaption>
      {children}
    </figure>
  );
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
  );
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
          This isn&apos;t the right problem
        </MenuItem>
        <MenuItem icon={<Pencil />} onSelect={() => {}}>
          Edit the professor&apos;s instructions
        </MenuItem>
      </Menu>
    </div>
  );
}

function Statement() {
  return (
    <div className="space-y-4">
      <p className="text-base">
        Use superposition to find <MathInline tex="v_o" /> in the circuit of
        Fig. 4.109, with the professor’s sources{' '}
        <MathInline tex="V_s = 10\ \text{V}" /> and{' '}
        <MathInline tex="I_s = 2\ \text{A}" />.
      </p>
      <figure className="space-y-1">
        <img
          src={sampleFigure('Fig. 4.109')}
          alt="Fig. 4.109"
          className="w-full rounded-md border bg-card"
        />
        <figcaption className="text-xs text-muted-foreground">
          Fig. 4.109
        </figcaption>
      </figure>
      <Box>
        <BoxHeader>From your professor</BoxHeader>
        <BoxBody className="text-sm">no PSpice or MultiSim</BoxBody>
      </Box>
    </div>
  );
}

/** The three stages as compact rows that open in place: the length said in
 *  words, a tap opens one and it stays. While the guide is still being written
 *  the rows it has not reached show a spinner and cannot be opened. */
function Help({ writing }: { writing?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows: { name: string; meta: string; body: ReactNode }[] = [
    {
      name: 'Hint',
      meta: '2 lines',
      body: (
        <p>
          Go around the loop once and write that the voltage rises equal the
          drops. The resistors are in series, so they share one current.
        </p>
      ),
    },
    {
      name: 'Walkthrough',
      meta: '5 steps',
      body: (
        <p>
          Going clockwise, the source gives a rise of{' '}
          <MathInline tex="10\ \text{V}" /> and the two resistors are drops, so{' '}
          <MathInline tex="10 = 4i + 8i" />.
        </p>
      ),
    },
    {
      name: 'Answers',
      meta: '2 answers',
      body: (
        <p>
          <MathInline tex="i = 0.83\ \text{A}" /> clockwise;{' '}
          <MathInline tex="P = 5.6\ \text{W}" />.
        </p>
      ),
    },
  ];
  return (
    <Box>
      {rows.map((r) => (
        <div key={r.name}>
          <BoxRow
            onClick={
              writing && r.name !== 'Hint'
                ? undefined
                : () => {
                    setOpen(open === r.name ? null : r.name);
                  }
            }
            title={r.name}
            trailing={
              writing && r.name !== 'Hint' ? (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  Writing
                  <Spinner className="size-3" />
                </span>
              ) : (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {r.meta}
                  <ChevronDown
                    className={cn(
                      'size-4 transition-transform duration-100 motion-reduce:transition-none',
                      open === r.name && 'rotate-180',
                    )}
                  />
                </span>
              )
            }
          />
          {open === r.name && (
            <BoxBody className="border-t border-border-muted text-base">
              {r.body}
            </BoxBody>
          )}
        </div>
      ))}
    </Box>
  );
}

function Footer({ done, skip }: { done?: boolean; skip?: boolean }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-t p-card">
      <Button variant="ghost" size="sm">
        Ask about this
      </Button>
      {done ? (
        <Button variant="outline">Mark incomplete</Button>
      ) : skip ? (
        <Button variant="outline">Skip for now</Button>
      ) : (
        <Button>Next question</Button>
      )}
    </div>
  );
}

/** The states a question passes through or ends in, in the same frame. */
function StateWalkthrough({ state }: { state: 'writing' | 'failed' }) {
  return (
    <>
      <ProgressHeader marks={OPEN} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-card">
        <QuestionHead />
        <p className="text-base">
          Determine the Thevenin equivalent of the circuit seen from terminals{' '}
          <MathInline tex="a\text{-}b" />.
        </p>
        {state === 'writing' ? (
          <>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3" />
              Writing the guide · about a minute left
            </p>
            <Help writing />
          </>
        ) : (
          <FailedQuestion
            q={makeQuestion({
              homeworkId: 'w',
              position: 3,
              label: '4.32',
              state: 'failed',
              error: mockError(['homework.guide_failed', 'model.busy'], {
                name: 'problem 4.32',
              }),
            })}
            onRetry={() => {}}
          />
        )}
      </div>
      <Footer skip />
    </>
  );
}

function Walkthrough({ done }: { done?: boolean }) {
  const marks = done ? CURRENT_DONE : OPEN;
  return (
    <>
      <ProgressHeader marks={marks} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-card">
        <QuestionHead done={done} />
        <Statement />
        <Help />
      </div>
      <Footer done={done} />
    </>
  );
}

/** Focus: the question stays put on the left while the help scrolls. */
function FocusWalkthrough() {
  return (
    <>
      <ProgressHeader marks={OPEN} />
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
  );
}

const MINUTES = [18, 14, 41, 33, 9, 12, 27, 20];

/** The count, which opens the list of the questions: with the marks gone it
 *  is how you jump. The real Menu, with a labelled trigger and a current row. */
function QuestionList({ marks }: { marks: Mark[] }) {
  return (
    <Menu label="Questions" trigger={doneOf(marks)}>
      {QUESTIONS.map((q, i) => (
        <MenuItem
          key={q}
          current={marks[i] === 'current'}
          icon={
            marks[i] === 'done' ? (
              <Check className="text-success!" />
            ) : undefined
          }
          onSelect={() => {}}
        >
          {q}
        </MenuItem>
      ))}
    </Menu>
  );
}

function OptionBody() {
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-hidden p-card">
      <QuestionHead />
      <Statement />
    </div>
  );
}

/** The walkthrough's header: back, the set's title, the count (which opens the
 *  questions), the time left in gray, the set's menu, and the bar as its bottom
 *  edge. No extra row. */
function ProgressHeader({
  marks,
  title = 'Problem set 4',
}: {
  marks: Mark[];
  title?: string;
}) {
  return (
    <div className="relative flex h-row shrink-0 items-center gap-1 border-b px-2">
      <IconButton variant="ghost" size="sm" aria-label="Back to homework">
        <ChevronLeft />
      </IconButton>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {title}
      </span>
      <QuestionList marks={marks} />
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {TIME_LEFT}
      </span>
      <SetMenu />
      <WeightedBar marks={marks} className="absolute inset-x-0 -bottom-px" />
    </div>
  );
}

function Finish() {
  const hardest = Math.max(...MINUTES);
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto p-card py-8 text-center">
      <div className="space-y-2">
        <h2 className="font-heading text-4xl">Long night. It shows.</h2>
        <p className="font-heading text-lg text-muted-foreground italic">
          All 8 done in Problem set 4.
        </p>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 text-left">
        <StatTile
          label="Total time"
          value={<DurationValue minutes={174} />}
          context="across 8 questions"
        />
        <StatTile
          label="Per question"
          value={<DurationValue minutes={22} />}
          context="about, on average"
        />
      </div>
      <div className="w-full space-y-2 text-left">
        <p className="text-xs text-muted-foreground">Time per question</p>
        <div className="flex h-24 items-end gap-1">
          {MINUTES.map((m, i) => (
            <span
              key={i}
              style={{ height: `${(m / hardest) * 100}%` }}
              className={cn(
                'flex-1 rounded-sm',
                m === hardest ? 'bg-primary' : 'bg-foreground/25',
              )}
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
        <BoxRow
          title="4.32"
          description="Longest, and the highest difficulty in the set"
          trailing={<RowValue>41m</RowValue>}
        />
        <BoxRow
          title="3.12"
          description="Second longest"
          trailing={<RowValue>33m</RowValue>}
        />
      </Box>
      <div className="flex items-center gap-3">
        <Button size="lg">Turn in</Button>
        <Button variant="ghost" size="lg">
          Back to list
        </Button>
      </div>
    </div>
  );
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
              <WeightedBar marks={OPEN} />
              <span className="block tabular-nums">
                {doneOf(OPEN)} done · {TIME_LEFT}
              </span>
            </span>
          }
          trailing={<HomeworkStatusLabel status="soon" />}
        />
        <BoxRow
          onClick={() => {}}
          title="Chapter 3 exercises"
          description={
            <span className="block space-y-1 pt-1">
              <WeightedBar marks={['waiting', 'waiting']} />
              <span className="block tabular-nums">
                0 of 2 done · due Tuesday
              </span>
            </span>
          }
        />
        <DoorAction
          icon={<Plus aria-hidden />}
          onClick={() => {}}
          className="border-t border-border-muted"
        >
          New homework
        </DoorAction>
      </Box>
      <p className="text-xs text-muted-foreground">Turned in</p>
      <Box>
        <BoxRow
          onClick={() => {}}
          title="Problem set 3"
          description="1 of 1 done"
          trailing={<HomeworkStatusLabel status="turned-in" />}
        />
      </Box>
    </div>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1 border-b pb-3">
        <h2 className="font-heading text-xl">{title}</h2>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="flex flex-wrap items-start gap-8">{children}</div>
    </section>
  );
}

export function HomeworkWireframes() {
  return (
    <div className="space-y-section">
      <Group
        title="Progress in the header"
        note="No extra row. The header's bottom edge is the bar, cut into the questions and as wide as each is hard; the count opens the list of questions (click it); the time left is gray beside it."
      >
        <Frame title="A short set title" note="Problem set 4">
          <Panel height={420}>
            <ProgressHeader marks={OPEN} />
            <OptionBody />
          </Panel>
        </Frame>
        <Frame
          title="A long set title"
          note="It truncates to make room for the count and the time; the count and bar never move."
        >
          <Panel height={420}>
            <ProgressHeader
              marks={OPEN}
              title="Chapter 3 exercises: nodal analysis and superposition"
            />
            <OptionBody />
          </Panel>
        </Frame>
      </Group>
      <Group
        title="Walkthrough, panel width"
        note="The header and the footer are pinned; only the middle scrolls. Open a row, open a menu, click the count: these are the real components."
      >
        <Frame
          title="A question with a written guide"
          note="The one primary is Next question. The count in the header opens the list of questions."
        >
          <Panel>
            <Walkthrough />
          </Panel>
        </Frame>
        <Frame
          title="A completed question"
          note="The same button turns into Mark incomplete: undo in place, no toast."
        >
          <Panel>
            <Walkthrough done />
          </Panel>
        </Frame>
        <Frame
          title="Still being written"
          note="The hint has landed and opens; the rest say Writing. The button is Skip for now: it moves on without marking the question done."
        >
          <Panel>
            <StateWalkthrough state="writing" />
          </Panel>
        </Frame>
        <Frame
          title="Failed"
          note="The real failed-question block, with its ways out. The button is Skip for now."
        >
          <Panel>
            <StateWalkthrough state="failed" />
          </Panel>
        </Frame>
      </Group>
      <Group
        title="Focus, 800px"
        note="Two columns: the question stays pinned on the left while the help scrolls on the right."
      >
        <Frame
          title="The panel in Focus"
          note="Header and footer are unchanged."
        >
          <Panel wide>
            <FocusWalkthrough />
          </Panel>
        </Frame>
      </Group>
      <Group
        title="Finish page and list"
        note="The finish page fills the pane after the last question. The list is where you switch sets."
      >
        <Frame
          title="Finish page"
          note="A greeting line like Home's, total and per-question time, the hardest, Turn in as the one primary."
        >
          <Panel>
            <Finish />
          </Panel>
        </Frame>
        <Frame
          title="The list"
          note="Each set carries the same bar and time left; tapping opens it on the first incomplete question."
        >
          <Panel>
            <List />
          </Panel>
        </Frame>
      </Group>
    </div>
  );
}
