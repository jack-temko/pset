import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowUp, Check, ChevronLeft, ChevronRight, Focus, Plus, Printer } from 'lucide-react'

import { AppShell } from '@/components/shell'
import { Box, BoxRow } from '@/components/box'
import { HomeworkStatusLabel, dueText } from '@/components/homework-status'
import { Button, IconButton } from '@/components/button'
import {
  AssistantTurn,
  ConversationStart,
  DayDivider,
  MathDisplay,
  MathInline,
  PageRef,
  Steps,
  UserTurn,
} from '@/components/transcript'
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav'
import { Veil } from '@/components/veil'
import {
  BOOK_HOMEWORK,
  PAGE_COUNT,
  TOC,
  bookBySha,
  type BookHomework,
  type TocChapter,
} from '@/lib/sample'
import { cn } from '@/lib/utils'

/**
 * The book workspace: the app's one filled screen. Contents rail, page
 * scan, Ask | Homework panel — each pane scrolls itself, the frame never
 * moves. Focus collapses the rail and hands its width to the panel.
 *
 * Spec: design/workspace.md.
 */

type Tab = 'ask' | 'homework'

/** The panel remembers which face it showed, per book. A blocked
 *  localStorage just means it forgets. */
function readTab(sha: string): Tab {
  try {
    return localStorage.getItem(`pset-panel-tab:${sha}`) === 'homework' ? 'homework' : 'ask'
  } catch {
    return 'ask'
  }
}
function writeTab(sha: string, tab: Tab) {
  try {
    localStorage.setItem(`pset-panel-tab:${sha}`, tab)
  } catch {
    /* forgetting is fine */
  }
}

// ---------------------------------------------------------------- rail

/** The book's contents as a tree of quiet rows; the reader's position
 *  highlights the section it is inside. A book with no TOC has no rail. */
function Rail({
  toc,
  currentPage,
  onJump,
}: {
  toc: TocChapter[]
  currentPage: number
  onJump: (page: number) => void
}) {
  // The current section is the last one that starts at or before the page
  // the scan is showing.
  let currentId: string | undefined
  for (const c of toc)
    for (const s of c.sections) if (s.page <= currentPage) currentId = s.id

  return (
    <aside className="w-rail shrink-0 overflow-y-auto border-r bg-rail py-4">
      <nav aria-label="Contents" className="space-y-4">
        {toc.map((c) => (
          <div key={c.id}>
            <button
              type="button"
              onClick={() => onJump(c.page)}
              className="flex w-full items-center px-4 py-1 text-left text-sm font-medium"
            >
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
            </button>
            {c.sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onJump(s.page)}
                aria-current={s.id === currentId ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-2 py-1 pr-4 pl-8 text-left text-sm transition-colors duration-150 ease-out motion-reduce:transition-none',
                  s.id === currentId
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums">{s.page}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

// ---------------------------------------------------------------- scan

/**
 * Pages stack in one scrolling pane, edge-to-edge paper. Until the backend
 * serves rendered pages, each is a placeholder at print proportions. The
 * only chrome is the floating pill: page · zoom, fading when idle.
 */
function Scan({
  pageCount,
  currentPage,
  onPageChange,
  scrollRef,
  pageRefs,
}: {
  pageCount: number
  currentPage: number
  onPageChange: (p: number) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  pageRefs: React.RefObject<Map<number, HTMLDivElement>>
}) {
  const [pillAwake, setPillAwake] = useState(false)
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const wake = () => {
    setPillAwake(true)
    clearTimeout(sleepTimer.current)
    sleepTimer.current = setTimeout(() => setPillAwake(false), 1200)
  }
  useEffect(() => () => clearTimeout(sleepTimer.current), [])

  const onScroll = () => {
    wake()
    const el = scrollRef.current
    if (!el) return
    // The current page is the one crossing the pane's vertical middle.
    const middle = el.scrollTop + el.clientHeight / 2
    let page = 1
    for (const [n, node] of pageRefs.current) {
      if (node.offsetTop <= middle) page = Math.max(page, n)
    }
    if (page !== currentPage) onPageChange(page)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto bg-muted/40">
        <div className="mx-auto max-w-layout-reading space-y-6 px-6 py-6">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              ref={(node) => {
                if (node) pageRefs.current.set(n, node)
                else pageRefs.current.delete(n)
              }}
              className="grid place-items-center rounded-sm border bg-card"
              style={{ aspectRatio: '8.5 / 11' }}
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums">{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        onMouseEnter={wake}
        className={cn(
          'absolute bottom-6 left-1/2 flex h-control-sm -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-4 font-mono text-xs text-muted-foreground shadow-floating tabular-nums transition-opacity duration-150 ease-out motion-reduce:transition-none',
          pillAwake ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span>
          p. {currentPage} of {pageCount}
        </span>
        <span aria-hidden>·</span>
        <span>100%</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- panel

/** Sample history until the loop backend exists — it exercises every
 *  transcript piece the spec names. */
function SampleConversation({ onJump }: { onJump: (page: number) => void }) {
  return (
    <div className="space-y-5">
      <ConversationStart />
      <DayDivider label="Yesterday" />
      <UserTurn>Where does the book define linear independence?</UserTurn>
      <Steps steps={['Searched ‘linear independence’ · 4 pages', 'Read p. 27–33']} />
      <AssistantTurn>
        <p>
          In section 2.A <PageRef page={32} onJump={onJump} />: a list{' '}
          <MathInline tex="v_1,\dots,v_m" /> is linearly independent when the only way to write{' '}
          <MathInline tex="0" /> as a combination of the list is to take every coefficient to be{' '}
          <MathInline tex="0" />. The lead-up on <PageRef page={28} onJump={onJump} /> builds the
          span first, so independence arrives as “no vector is wasted.”
        </p>
      </AssistantTurn>
      <DayDivider label="Today" />
      <UserTurn>Why does every operator have a minimal polynomial?</UserTurn>
      <Steps
        steps={[
          'Searched ‘minimal polynomial’ · 6 pages',
          'Read p. 142–145',
          'Solved · 3 steps',
        ]}
      />
      <AssistantTurn>
        <p>
          Because powers of <MathInline tex="T" /> cannot stay independent forever. On{' '}
          <PageRef page={142} onJump={onJump} /> the argument is a dimension count: the operator
          space <MathInline tex="\mathcal{L}(V)" /> has dimension <MathInline tex="n^2" />, so
          the list
        </p>
        <MathDisplay tex="I,\;T,\;T^2,\;\dots,\;T^{n^2}" />
        <p>
          has <MathInline tex="n^2+1" /> entries and must be dependent. The first dependence
          gives a monic polynomial with <MathInline tex="p(T)=0" />; uniqueness of the smallest
          one follows from the division algorithm <PageRef page={144} onJump={onJump} />.
        </p>
      </AssistantTurn>
    </div>
  )
}

/** Ask: the transcript over the composer. An empty conversation is a
 *  prompt line and one sentence of capability — no generated suggestions. */
function AskTab({ onJump }: { onJump: (page: number) => void }) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-card">
        <SampleConversation onJump={onJump} />
      </div>
      <div className="shrink-0 border-t p-card">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <textarea
            rows={1}
            placeholder="Ask about this book…"
            className="min-h-control flex-1 resize-none rounded-md border border-input bg-card px-3 py-1 text-base placeholder:text-muted-foreground"
          />
          <IconButton type="submit" variant="primary" aria-label="Send">
            <ArrowUp />
          </IconButton>
        </form>
      </div>
    </>
  )
}

/** Sample walkthrough content until the backend lands. Statements are
 *  extracted text with math rendered; stages reuse the transcript's
 *  pieces, per the spec. */
type SampleQuestion = {
  label: string
  page: number
  statement: ReactNode
  hint: ReactNode
  /** The worked walkthrough, solution included — one stage, not two. */
  walkthrough: ReactNode
  figure?: string
}

const QUESTIONS: SampleQuestion[] = [
  {
    label: '3.A.4',
    page: 57,
    statement: (
      <>
        Suppose <MathInline tex="T \in \mathcal{L}(V, W)" /> and{' '}
        <MathInline tex="v_1, \dots, v_m" /> is a list of vectors in <MathInline tex="V" /> such
        that <MathInline tex="Tv_1, \dots, Tv_m" /> is linearly independent in{' '}
        <MathInline tex="W" />. Prove that <MathInline tex="v_1, \dots, v_m" /> is linearly
        independent.
      </>
    ),
    hint: <>Start from a dependence among the {'​'}<MathInline tex="v_k" /> and apply{' '}<MathInline tex="T" /> to it.</>,
    walkthrough: (
      <>
        <p>
          Suppose <MathInline tex="a_1 v_1 + \dots + a_m v_m = 0" />. Linearity moves the whole
          equation across <MathInline tex="T" />:{' '}
          <MathInline tex="0 = T(0) = a_1 Tv_1 + \dots + a_m Tv_m" />.
        </p>
        <p>
          Since the <MathInline tex="Tv_k" /> are independent, each <MathInline tex="a_k = 0" /> —
          which is exactly the statement that the <MathInline tex="v_k" /> are independent.
        </p>
      </>
    ),
  },
  {
    label: '3.A.7',
    page: 57,
    statement: (
      <>
        Show that every linear map from a one-dimensional vector space to itself is
        multiplication by some scalar: if <MathInline tex="\dim V = 1" /> and{' '}
        <MathInline tex="T \in \mathcal{L}(V)" />, then there exists{' '}
        <MathInline tex="\lambda \in \mathbf{F}" /> with <MathInline tex="Tv = \lambda v" /> for
        all <MathInline tex="v \in V" />.
      </>
    ),
    hint: <>Pick any nonzero <MathInline tex="w \in V" /> — what does <MathInline tex="Tw" /> have to be?</>,
    walkthrough: (
      <>
        <p>
          With <MathInline tex="\dim V = 1" />, a nonzero <MathInline tex="w" /> spans:{' '}
          <MathInline tex="V = \operatorname{span}(w)" />, so{' '}
          <MathInline tex="Tw = \lambda w" /> for some <MathInline tex="\lambda" />. Any{' '}
          <MathInline tex="v = c\,w" /> then gives
        </p>
        <MathDisplay tex="Tv = T(c\,w) = c\,Tw = c\,\lambda w = \lambda v." />
      </>
    ),
  },
  {
    label: '3.B.12',
    page: 63,
    figure: 'figure · p. 63',
    statement: (
      <>
        Suppose <MathInline tex="V" /> is finite-dimensional and{' '}
        <MathInline tex="T \in \mathcal{L}(V, W)" />. Prove that{' '}
        <MathInline tex="\dim V = \dim \operatorname{null} T + \dim \operatorname{range} T" />{' '}
        using the diagram of the quotient map shown in the margin.
      </>
    ),
    hint: <>Extend a basis of the null space to a basis of <MathInline tex="V" />.</>,
    walkthrough: (
      <p>
        Take <MathInline tex="u_1, \dots, u_k" /> a basis of{' '}
        <MathInline tex="\operatorname{null} T" />, extend by{' '}
        <MathInline tex="v_1, \dots, v_r" /> to a basis of <MathInline tex="V" />. The images{' '}
        <MathInline tex="Tv_1, \dots, Tv_r" /> span the range and stay independent, so they form
        a basis of it — and <MathInline tex="\dim V = k + r" />.
      </p>
    ),
  },
  {
    label: '3.B.20',
    page: 64,
    statement: (
      <>
        Suppose <MathInline tex="W" /> is finite-dimensional and{' '}
        <MathInline tex="T \in \mathcal{L}(V, W)" />. Prove that <MathInline tex="T" /> is
        injective if and only if there exists <MathInline tex="S \in \mathcal{L}(W, V)" /> such
        that <MathInline tex="ST" /> is the identity on <MathInline tex="V" />.
      </>
    ),
    hint: <>One direction is immediate — which one, and why?</>,
    walkthrough: (
      <>
        <p>
          If <MathInline tex="ST = I" /> then <MathInline tex="T" /> kills nothing, so it is
          injective. Conversely, given injectivity <MathInline tex="T^{-1}" /> exists on{' '}
          <MathInline tex="\operatorname{range} T" />; write{' '}
          <MathInline tex="W = \operatorname{range} T \oplus U" /> and define{' '}
          <MathInline tex="S" /> as the inverse on the first summand, <MathInline tex="0" /> on{' '}
          <MathInline tex="U" />. Then <MathInline tex="STv = v" /> for every{' '}
          <MathInline tex="v" />.
        </p>
      </>
    ),
  },
]

/** A stage of the guide: the content is there from the start, behind
 *  frosted glass. One click lifts the veil — no buttons to sequence, and
 *  nothing spoiled by accident. */
function Stage({
  label,
  revealed,
  onReveal,
  children,
}: {
  label: string
  revealed: boolean
  onReveal: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <Veil label={`Show ${label}`} revealed={revealed} onReveal={onReveal}>
        <div className="space-y-3 text-base">{children}</div>
      </Veil>
    </div>
  )
}

const STAGE_NAMES = ['hint', 'walkthrough'] as const

/** One question at a time. Both stages sit veiled below the statement —
 *  the walkthrough carries the solution — and Complete is a checkbox:
 *  checking advances, unchecking is the undo. Spec: design/workspace.md. */
function Walkthrough({
  title,
  onBack,
  onJump,
  onAskAbout,
}: {
  title: string
  onBack: () => void
  onJump: (page: number) => void
  onAskAbout: () => void
}) {
  const [index, setIndex] = useState(0)
  // Per-question progress, sample-local until the backend persists it.
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [done, setDone] = useState<boolean[]>(() => QUESTIONS.map(() => false))

  const q = QUESTIONS[index]
  const isDone = done[index]

  const reveal = (name: string) => setRevealed((r) => new Set(r).add(`${index}:${name}`))

  const toggleDone = () => {
    const next = done.map((d, i) => (i === index ? !d : d))
    setDone(next)
    if (!next[index]) return // unchecking is the undo — stay put
    // Advance to the next unfinished question; the last one closes quietly.
    const ahead = QUESTIONS.findIndex((_, i) => !next[i])
    if (ahead === -1) onBack()
    else setIndex(ahead)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-row shrink-0 items-center gap-2 border-b px-2">
        <IconButton variant="ghost" size="sm" aria-label="Back to homework" onClick={onBack}>
          <ChevronLeft />
        </IconButton>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {index + 1} of {QUESTIONS.length}
        </span>
        <IconButton variant="ghost" size="sm" aria-label="Print this homework">
          <Printer />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-card">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{q.label}</span>
          <PageRef page={q.page} onJump={onJump} />
          {isDone && <Check aria-label="Done" className="size-4 text-success" />}
        </div>
        <div className="space-y-3 text-base">{q.statement}</div>
        {q.figure && (
          <div className="grid h-32 place-items-center rounded-md border bg-card font-mono text-xs text-muted-foreground">
            {q.figure}
          </div>
        )}

        {STAGE_NAMES.map((name) => (
          <Stage
            key={name}
            label={name}
            revealed={revealed.has(`${index}:${name}`)}
            onReveal={() => reveal(name)}
          >
            {q[name]}
          </Stage>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t p-card">
        <Button variant="ghost" size="sm" onClick={onAskAbout}>
          Ask about this
        </Button>
        <div className="flex items-center gap-2">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Previous question"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Next question"
            disabled={index === QUESTIONS.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            <ChevronRight />
          </IconButton>
          {/* A checkbox, because done must be as easy to take back as to
              claim. Checking advances; unchecking stays put. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={isDone}
            onClick={toggleDone}
            className="flex h-control-sm cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors duration-150 ease-out hover:bg-muted/50 motion-reduce:transition-none"
          >
            <span
              aria-hidden
              className={cn(
                'grid size-4 shrink-0 place-items-center rounded-sm border transition-colors duration-150 ease-out motion-reduce:transition-none',
                isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card',
              )}
            >
              {isDone && <Check className="size-3" />}
            </span>
            Complete
          </button>
        </div>
      </div>
    </div>
  )
}

/** The homework list: active sets, then turned-in ones under a quiet
 *  label. Opening a set fills the panel with its walkthrough. */
function HomeworkTab({
  items,
  onJump,
  onAskAbout,
}: {
  items: BookHomework[]
  onJump: (page: number) => void
  onAskAbout: () => void
}) {
  const [openSet, setOpenSet] = useState<BookHomework | null>(null)
  const active = items.filter((h) => h.status !== 'turned-in')
  const turnedIn = items.filter((h) => h.status === 'turned-in')

  if (openSet) {
    return (
      <Walkthrough
        title={openSet.title}
        onBack={() => setOpenSet(null)}
        onJump={onJump}
        onAskAbout={onAskAbout}
      />
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-card">
      <Button variant="outline" size="sm" className="w-full">
        <Plus />
        New homework
      </Button>
      <Box>
        {active.map((h) => (
          <BoxRow
            key={h.id}
            onClick={() => setOpenSet(h)}
            title={h.title}
            description={`${h.done} of ${h.total} questions · ${dueText(h.due, h.status)}`}
            trailing={<HomeworkStatusLabel status={h.status} />}
          />
        ))}
      </Box>
      {turnedIn.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">Turned in</p>
          <Box>
            {turnedIn.map((h) => (
              <BoxRow
                key={h.id}
                onClick={() => setOpenSet(h)}
                title={h.title}
                description={`${h.done} of ${h.total} questions · ${dueText(h.due, h.status)}`}
                trailing={<HomeworkStatusLabel status={h.status} />}
              />
            ))}
          </Box>
        </>
      )}
    </div>
  )
}

function Panel({
  sha,
  focus,
  onFocusToggle,
  onJump,
}: {
  sha: string
  focus: boolean
  onFocusToggle: () => void
  onJump: (page: number) => void
}) {
  const [tab, setTab] = useState<Tab>(() => readTab(sha))
  const pick = (t: Tab) => {
    setTab(t)
    writeTab(sha, t)
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-l bg-rail',
        focus ? 'w-panel-wide' : 'w-panel',
      )}
    >
      <div className="flex h-row shrink-0 items-center justify-between border-b px-card">
        <UnderlineNav className="-mb-px h-full">
          <UnderlineTab active={tab === 'ask'} onClick={() => pick('ask')}>
            Ask
          </UnderlineTab>
          <UnderlineTab active={tab === 'homework'} onClick={() => pick('homework')}>
            Homework
          </UnderlineTab>
        </UnderlineNav>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={focus ? 'Leave focus' : 'Focus on the panel'}
          aria-pressed={focus}
          onClick={onFocusToggle}
          className={cn(focus && 'bg-muted/50 text-foreground')}
        >
          <Focus />
        </IconButton>
      </div>
      {tab === 'ask' ? (
        <AskTab onJump={onJump} />
      ) : (
        <HomeworkTab items={BOOK_HOMEWORK} onJump={onJump} onAskAbout={() => pick('ask')} />
      )}
    </aside>
  )
}

// ------------------------------------------------------------ workspace

export function Workspace() {
  const { sha } = useParams<{ sha: string }>()
  const book = bookBySha(sha ?? '')

  const [focus, setFocus] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())

  if (!book) {
    return (
      <AppShell>
        <div className="grid h-full place-items-center">
          <p className="text-base text-muted-foreground">There is no book here.</p>
        </div>
      </AppShell>
    )
  }

  const jump = (page: number) => {
    pageRefs.current.get(page)?.scrollIntoView()
  }

  return (
    <AppShell scroll="fill" middle={<span>{book.title}</span>}>
      <div className="flex h-full">
        {!focus && <Rail toc={TOC} currentPage={currentPage} onJump={jump} />}
        <Scan
          pageCount={PAGE_COUNT}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          scrollRef={scrollRef}
          pageRefs={pageRefs}
        />
        <Panel
          sha={book.sha256}
          focus={focus}
          onFocusToggle={() => setFocus((f) => !f)}
          onJump={jump}
        />
      </div>
    </AppShell>
  )
}
