import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Focus,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react'

import { AppShell } from '@/components/shell'
import { Box, BoxHeader, BoxRow } from '@/components/box'
import { Checkbox } from '@/components/checkbox'
import { AutoTextarea, Field, Input } from '@/components/input'
import { HomeworkStatusLabel, dueText } from '@/components/homework-status'
import { Button, IconButton } from '@/components/button'
import { Tooltip } from '@/components/tooltip'
import {
  AboutChip,
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
import { Skeleton } from '@/components/skeleton'
import { Spinner } from '@/components/spinner'
import { AddQuestionsDialog, BookDialog, HomeworkDialog } from './dialogs'
import {
  BOOK_HOMEWORK,
  PAGE_COUNT,
  PAGE_OFFSET,
  TOC,
  bookBySha,
  type BookHomework,
  type TocChapter,
} from '@/lib/sample'
import { PageOffset, pdfOf, printedLabel, usePageOffset } from '@/lib/pages'
import { cn } from '@/lib/utils'

/**
 * The book workspace: the app's one filled screen. Contents rail, page
 * scan, Ask | Homework panel: each pane scrolls itself, the frame never
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
  const offset = usePageOffset()
  // The current section is the last one that starts at or before the page
  // the scan is showing. Both are printed numbers.
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
                <Tooltip label={`PDF page ${pdfOf(s.page, offset)}`} side="left">
                  <span className="shrink-0 font-mono text-xs tabular-nums">{s.page}</span>
                </Tooltip>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

// ---------------------------------------------------------------- scan

/** Zoom is relative to fitting the pane's width: 1 is fit, and the
 *  percentage in the pill says so. */
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3

/**
 * Pages stack in one scrolling pane, edge-to-edge paper. Until the backend
 * serves rendered pages, each is a placeholder at print proportions,
 * labelled with its printed number. The only chrome is the floating pill:
 * the printed page (the PDF page on hover) and the zoom, fading when idle.
 *
 * Pinch on a trackpad zooms around the pointer; past the pane's width a
 * click-drag pans, and only then is the cursor a hand. Clicking the
 * percentage snaps back to fit.
 */
function Scan({
  pageCount,
  currentPage,
  onPageChange,
  scrollRef,
  pageRefs,
}: {
  pageCount: number
  /** A PDF index: the scan is the one place that counts in those. */
  currentPage: number
  onPageChange: (p: number) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  pageRefs: React.RefObject<Map<number, HTMLDivElement>>
}) {
  const offset = usePageOffset()
  const [pillAwake, setPillAwake] = useState(false)
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [zoom, setZoom] = useState(1)
  const [paneWidth, setPaneWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; y: number } | null>(null)
  // Where the fingers were, and the zoom it was measured at, so the point
  // under them stays put once the new size has been laid out.
  const anchor = useRef<{ px: number; py: number; from: number } | null>(null)

  const wake = () => {
    setPillAwake(true)
    clearTimeout(sleepTimer.current)
    sleepTimer.current = setTimeout(() => setPillAwake(false), 1200)
  }
  useEffect(() => () => clearTimeout(sleepTimer.current), [])

  // The fit width follows the pane, which Focus mode resizes.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPaneWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [scrollRef])

  // A trackpad pinch arrives as a ctrl+wheel. It has to be a non-passive
  // listener to stop the browser zooming the whole app instead.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      wake()
      const r = el.getBoundingClientRect()
      setZoom((z) => {
        if (!anchor.current)
          anchor.current = { px: e.clientX - r.left, py: e.clientY - r.top, from: z }
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * Math.exp(-e.deltaY * 0.01)))
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scrollRef])

  // After layout, before paint: scale the scroll position by the zoom
  // change around the anchor, so the page doesn't jump.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const a = anchor.current
    if (!el || !a) return
    const k = zoom / a.from
    el.scrollLeft = (el.scrollLeft + a.px) * k - a.px
    el.scrollTop = (el.scrollTop + a.py) * k - a.py
    anchor.current = null
  }, [zoom, scrollRef])

  const fitWidth = Math.min(768, Math.max(paneWidth - 48, 0))
  const width = fitWidth * zoom
  // Panning only means something once the pages are wider than the pane.
  const canPan = width + 48 > paneWidth + 1

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
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onPointerDown={(e) => {
          if (!canPan || e.button !== 0) return
          drag.current = { x: e.clientX, y: e.clientY }
          setDragging(true)
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const el = e.currentTarget
          el.scrollLeft -= e.clientX - drag.current.x
          el.scrollTop -= e.clientY - drag.current.y
          drag.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={() => {
          drag.current = null
          setDragging(false)
        }}
        className={cn(
          // Both axes: a zoomed page is content that can't reflow, the one
          // case the system allows a sideways scroll for.
          'h-full overflow-auto bg-muted/40 select-none',
          canPan && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
        )}
      >
        <div
          className="mx-auto space-y-6 px-6 py-6"
          style={{ width: width ? width + 48 : undefined }}
        >
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
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {printedLabel(n, offset)}
              </span>
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
        <Tooltip label={`PDF page ${currentPage} of ${pageCount}`}>
          <span tabIndex={0} className="rounded-sm">
            p. {printedLabel(currentPage, offset)}
          </span>
        </Tooltip>
        <span aria-hidden>·</span>
        <Tooltip label="Fit to width">
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="cursor-pointer rounded-sm transition-colors duration-150 ease-out hover:text-foreground motion-reduce:transition-none"
          >
            {Math.round(zoom * 100)}%
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- panel

/** Sample history until the loop backend exists: it exercises every
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
 *  prompt line and one sentence of capability: no generated suggestions. */
function AskTab({
  about,
  onClearAbout,
  onJump,
}: {
  /** The homework question "Ask about this" brought along, if any. */
  about: string | null
  onClearAbout: () => void
  onJump: (page: number) => void
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-card">
        <SampleConversation onJump={onJump} />
      </div>
      <div className="shrink-0 border-t p-card">
        {/* The question rides above the composer as a chip, so the box
            stays empty for your own words. */}
        {about && (
          <div className="mb-2">
            <AboutChip label={about} onRemove={onClearAbout} />
          </div>
        )}
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
  /** Absent when the question isn't in this book: it loses the page chip
   *  and the scan jump, and nothing else. */
  page?: number
  statement: ReactNode
  hint: ReactNode
  /** The worked walkthrough, solution included: one stage, not two. */
  walkthrough: ReactNode
  figure?: string
  /** A just-added question, still being located and written. */
  pending?: boolean
  /** Added with "In this book" unchecked: the engine never looks for it. */
  offBook?: boolean
  /** Why the engine couldn't write a guide. Replaces the stages. */
  failed?: string
}

/** Identity survives reorder, so reveals and completions key off it. */
type Question = SampleQuestion & { id: number }

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
          Since the <MathInline tex="Tv_k" /> are independent, each <MathInline tex="a_k = 0" />,
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
    hint: <>Pick any nonzero <MathInline tex="w \in V" />. What does <MathInline tex="Tw" /> have to be?</>,
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
        a basis of it, and <MathInline tex="\dim V = k + r" />.
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
    hint: <>One direction is immediate. Which one, and why?</>,
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
  {
    label: '3.C.14',
    // As typed: a failed question has only what you gave it.
    statement: '3.C.14',
    failed: "Couldn't find 3.C.14 in the book. No exercise with that number turned up.",
    hint: null,
    walkthrough: null,
  }
]

/** A stage of the guide: the content is there from the start, behind
 *  frosted glass. One click lifts the veil: no buttons to sequence, and
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

/**
 * A question the engine couldn't write a guide for. It says why in one
 * line, then offers both ways out at once: tell it the page (you know
 * where it is; the search didn't), or paste the question and let the
 * guide be written from your text alone, off the book.
 */
function FailedQuestion({
  q,
  onRetry,
}: {
  q: Question
  onRetry: (patch: Partial<Question>) => void
}) {
  const [page, setPage] = useState('')
  const [text, setText] = useState('')
  // A plain text field, not a number spinner: people type "57", "p. 57"
  // or "page 57", and all of them mean the first number in it.
  const pageNumber = Number(page.match(/\d+/)?.[0] ?? 0)

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 text-sm text-destructive">
        <span className="flex h-5 shrink-0 items-center">
          <CircleAlert className="size-4" />
        </span>
        {q.failed}
      </p>

      {/* Only an in-book question has a page to find. */}
      {!q.offBook && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (pageNumber > 0) onRetry({ page: pageNumber })
          }}
        >
          <Field label="It's on printed page" className="w-40">
            <Input
              inputMode="numeric"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Button type="submit" variant="outline" disabled={!(pageNumber > 0)}>
            Try again
          </Button>
        </form>
      )}

      <div className={cn('space-y-2', !q.offBook && 'border-t pt-5')}>
        <p className="text-sm font-medium">{q.offBook ? 'Try again' : 'Not in this book?'}</p>
        <p className="text-xs text-muted-foreground">
          Paste the question, and the guide is written from your text alone.
        </p>
        {/* A real text box: a whole question gets pasted here, so it
            starts four lines tall and grows from there. */}
        <AutoTextarea
          rows={4}
          value={text}
          placeholder="Paste the question"
          className="py-2"
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!text.trim()}
          onClick={() =>
            onRetry({ statement: text.trim(), offBook: true, page: undefined })
          }
        >
          Use this text
        </Button>
      </div>
    </div>
  )
}

const STAGE_NAMES = ['hint', 'walkthrough'] as const

/**
 * A question still being written: the two stages it will have, at their
 * usual size, so the guide lands in space already made for it rather than
 * pushing in. The spinner says the work is running; the skeletons say
 * where it will go.
 */
function PendingStages({ offBook }: { offBook: boolean }) {
  return (
    <div className="space-y-5">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3" />
        {offBook ? 'Writing the guide…' : 'Finding it in the book…'}
      </p>
      {STAGE_NAMES.map((name, i) => (
        <div key={name} className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase">{name}</p>
          <div className="space-y-1 text-base">
            {/* A hint runs two lines, a walkthrough about five; the last
                line of each stops short, as prose does. */}
            {Array.from({ length: i === 0 ? 2 : 5 }, (_, j) => (
              <p key={j}>
                <Skeleton className={cn('h-3', j === (i === 0 ? 1 : 4) ? 'w-2/3' : 'w-full')} />
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

let nextQuestionId = QUESTIONS.length

/** A freshly added draft, as the walkthrough sees it before the engine has
 *  located it and written its guide. The sample flips it to ready on a
 *  timer; the backend will do it on an event. */
function draftQuestion(text: string, inBook: boolean): Question {
  return {
    id: nextQuestionId++,
    // The first line of what you typed stands in for a label until the
    // engine names the question properly.
    label: text.split('\n')[0].slice(0, 40),
    page: inBook ? 57 : undefined,
    offBook: !inBook,
    pending: true,
    statement: text,
    hint: null,
    walkthrough: null,
  }
}

/** One question at a time. Both stages sit veiled below the statement:
 *  the walkthrough carries the solution, and Complete is a checkbox that
 *  does exactly one thing. Spec: design/workspace.md. */
function Walkthrough({
  set,
  onToggleTurnedIn,
  onEdit,
  onBack,
  onJump,
  onAskAbout,
}: {
  set: BookHomework
  onToggleTurnedIn: () => void
  onEdit: () => void
  onBack: () => void
  onJump: (page: number) => void
  onAskAbout: (label: string) => void
}) {
  // A set you just made has no questions; the sample ones belong to the
  // sets that were already there.
  const [questions, setQuestions] = useState<Question[]>(() =>
    set.total > 0 ? QUESTIONS.map((q, i) => ({ ...q, id: i })) : [],
  )
  // Per-question progress, sample-local until the backend persists it.
  // Keyed by question id, so reordering never moves a reveal or a tick.
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [done, setDone] = useState<Set<number>>(
    () => new Set(questions.slice(0, set.done).map((q) => q.id)),
  )
  // Open where you'd pick up: the first question not yet complete.
  const [index, setIndex] = useState(() => {
    const i = questions.findIndex((q) => !done.has(q.id))
    return i === -1 ? 0 : i
  })
  const [adding, setAdding] = useState(false)

  const q = questions[index] as Question | undefined
  const isDone = !!q && done.has(q.id)

  const reveal = (name: string) => setRevealed((r) => new Set(r).add(`${q?.id}:${name}`))

  // Marking a question complete does exactly that and nothing else. You
  // move on when you decide to, not when the app decides for you, and
  // unchecking is the undo.
  const toggleDone = () => {
    if (!q) return
    setDone((d) => {
      const next = new Set(d)
      if (!next.delete(q.id)) next.add(q.id)
      return next
    })
  }

  const move = (by: number) =>
    setQuestions((qs) => {
      const to = index + by
      if (to < 0 || to >= qs.length) return qs
      const next = [...qs]
      const [row] = next.splice(index, 1)
      next.splice(to, 0, row)
      // Follow the question you just moved, not the slot it left.
      setIndex(to)
      return next
    })

  const remove = () =>
    setQuestions((qs) => {
      const next = qs.filter((_, i) => i !== index)
      setIndex(Math.min(index, Math.max(next.length - 1, 0)))
      return next
    })

  /** The sample's stand-in for the engine finishing a question: after a
   *  beat it becomes ready, with a placeholder guide. */
  const resolveLater = (id: number, delay: number, patch: Partial<Question> = {}) =>
    window.setTimeout(
      () =>
        setQuestions((qs) =>
          qs.map((existing) =>
            existing.id === id
              ? {
                  ...existing,
                  ...patch,
                  pending: false,
                  failed: undefined,
                  hint: <>Work from the definition before reaching for a theorem.</>,
                  walkthrough: (
                    <p>
                      The engine writes this once the question is located. Sample text stands in
                      for it.
                    </p>
                  ),
                }
              : existing,
          ),
        ),
      delay,
    )

  const add = (drafts: { text: string; inBook: boolean }[]) => {
    const fresh = drafts.map((d) => draftQuestion(d.text, d.inBook))
    setQuestions((qs) => [...qs, ...fresh])
    // Progressive: each lands pending and resolves in turn, the way the
    // engine's locate → write phases will report them.
    fresh.forEach((row, i) => resolveLater(row.id, 800 * (i + 1)))
  }

  /** Both ways out of a failed question put it back in the queue: with a
   *  page you know it's on, or as your own text, off the book. */
  const retry = (patch: Partial<Question>) => {
    if (!q) return
    setQuestions((qs) =>
      qs.map((x) => (x.id === q.id ? { ...x, ...patch, pending: true, failed: undefined } : x)),
    )
    resolveLater(q.id, 900, patch)
  }

  const dialog = (
    <AddQuestionsDialog open={adding} onClose={() => setAdding(false)} onAdd={add} />
  )

  const header = (
    <div className="flex h-row shrink-0 items-center gap-2 border-b px-2">
      <IconButton variant="ghost" size="sm" aria-label="Back to homework" onClick={onBack}>
        <ChevronLeft />
      </IconButton>
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className="min-w-0 truncate text-sm font-medium">{set.title}</span>
        {/* The same pencil as the book's: "edit this" looks one way. */}
        <IconButton variant="ghost" size="sm" aria-label="Edit this homework" onClick={onEdit}>
          <Pencil />
        </IconButton>
      </span>
      {questions.length > 0 && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {index + 1} of {questions.length}
        </span>
      )}
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Add questions"
        onClick={() => setAdding(true)}
      >
        <Plus />
      </IconButton>
      {/* A worksheet: statements and figures with room to work, nothing
          revealed. The engine renders it as a PDF (hwpdf.go) and it opens
          in a new tab, wired with the backend pass. */}
      <IconButton variant="ghost" size="sm" aria-label="Print a worksheet">
        <Printer />
      </IconButton>
      {/* The set-level twin of Complete: a fact you can take back. */}
      <Checkbox
        checked={set.status === 'turned-in'}
        onChange={onToggleTurnedIn}
        className="shrink-0"
      >
        Turned in
      </Checkbox>
    </div>
  )

  if (!q) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-card text-center">
          <p className="text-sm text-muted-foreground">
            No questions yet. Paste a reference or the question itself, one per row.
          </p>
          <Button onClick={() => setAdding(true)}>
            <Plus />
            Add questions
          </Button>
        </div>
        {dialog}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-card">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-lg font-semibold">{q.label}</span>
          {/* A question that isn't in this book has nothing to jump to. */}
          {q.page !== undefined && <PageRef page={q.page} onJump={onJump} />}
          {isDone && <Check aria-label="Done" className="size-4 text-success" />}
          {/* Order and removal, inline and quiet: the set is editable from
              the question you are looking at. */}
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Move this question up"
            disabled={index === 0}
            onClick={() => move(-1)}
          >
            <ChevronUp />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Move this question down"
            disabled={index === questions.length - 1}
            onClick={() => move(1)}
          >
            <ChevronDown />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Remove this question"
            onClick={remove}
          >
            <Trash2 />
          </IconButton>
        </div>

        {/* A bare reference ("3.C.14") is already the label; saying it
            twice isn't a statement. */}
        {q.statement !== q.label && <div className="space-y-3 text-base">{q.statement}</div>}
        {q.figure && (
          <div className="grid h-32 place-items-center rounded-md border bg-card font-mono text-xs text-muted-foreground">
            {q.figure}
          </div>
        )}

        {q.failed ? (
          <FailedQuestion q={q} onRetry={retry} />
        ) : q.pending ? (
          <PendingStages offBook={!!q.offBook} />
        ) : (
          STAGE_NAMES.map((name) => (
            <Stage
              key={name}
              label={name}
              revealed={revealed.has(`${q.id}:${name}`)}
              onReveal={() => reveal(name)}
            >
              {q[name]}
            </Stage>
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t p-card">
        <Button variant="ghost" size="sm" onClick={() => onAskAbout(q.label)}>
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
            disabled={index === questions.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            <ChevronRight />
          </IconButton>
          {/* Done must be as easy to take back as to claim, so it is a
              checkbox and it does not advance. */}
          <Checkbox checked={isDone} onChange={toggleDone}>
            Complete
          </Checkbox>
        </div>
      </div>

      {dialog}
    </div>
  )
}

/** The homework list: active sets, then turned-in ones under a quiet
 *  label. Opening a set fills the panel with its walkthrough. */
function HomeworkTab({
  items,
  initialSet,
  onJump,
  onAskAbout,
}: {
  items: BookHomework[]
  /** From the URL: Home's due list opens a set directly. */
  initialSet?: string
  onJump: (page: number) => void
  onAskAbout: (label: string) => void
}) {
  const [sets, setSets] = useState<BookHomework[]>(items)
  // An id, not a copy: the open set's status changes under it.
  const [openId, setOpenId] = useState<string | null>(
    () => items.find((h) => h.id === initialSet)?.id ?? null,
  )
  const openSet = sets.find((h) => h.id === openId) ?? null
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const active = sets.filter((h) => h.status !== 'turned-in')
  const turnedIn = sets.filter((h) => h.status === 'turned-in')

  // A new set is a container and nothing else: it exists the moment you
  // name it, and you land in its empty walkthrough to fill it.
  const create = (title: string, due: string) => {
    const set: BookHomework = {
      id: `hw-${Date.now()}`,
      title,
      due: due || 'no date',
      done: 0,
      total: 0,
    }
    setSets((s) => [set, ...s])
    setOpenId(set.id)
  }

  const editDialogFor = (openSet: BookHomework) => (
    <HomeworkDialog
      open={editing}
      // The sample's due is already words ("today"); only a real date can
      // seed the date field.
      editing={{
        title: openSet.title,
        due: /^\d{4}-\d{2}-\d{2}$/.test(openSet.due) ? openSet.due : '',
        questions: openSet.total,
      }}
      onClose={() => setEditing(false)}
      onSave={(title, due) =>
        setSets((ss) =>
          ss.map((h) => (h.id === openSet.id ? { ...h, title, due: due || h.due } : h)),
        )
      }
      onDelete={() => {
        setSets((ss) => ss.filter((h) => h.id !== openSet.id))
        setOpenId(null)
      }}
    />
  )

  if (openSet) {
    return (
      <>
      <Walkthrough
        key={openSet.id}
        set={openSet}
        onToggleTurnedIn={() =>
          // Turning back in un-does it; due-ness is the backend's to
          // recompute from the date, so the sample simply clears it.
          setSets((ss) =>
            ss.map((h) =>
              h.id === openSet.id
                ? { ...h, status: h.status === 'turned-in' ? undefined : 'turned-in' }
                : h,
            ),
          )
        }
        onEdit={() => setEditing(true)}
        onBack={() => setOpenId(null)}
        onJump={onJump}
        onAskAbout={onAskAbout}
      />
      {editDialogFor(openSet)}
      </>
    )
  }


  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-card">
      <Box>
        {/* The one way to make homework, and it's a `+`: the same gesture
            as importing a book on Home. Nothing lives at a list's bottom
            but the Door. */}
        <BoxHeader className="text-sm">
          Assignments
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="New homework"
            onClick={() => setCreating(true)}
          >
            <Plus />
          </IconButton>
        </BoxHeader>
        {active.map((h) => (
          <BoxRow
            key={h.id}
            onClick={() => setOpenId(h.id)}
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
                onClick={() => setOpenId(h.id)}
                title={h.title}
                description={`${h.done} of ${h.total} questions · ${dueText(h.due, h.status)}`}
                trailing={<HomeworkStatusLabel status={h.status} />}
              />
            ))}
          </Box>
        </>
      )}

      <HomeworkDialog open={creating} onClose={() => setCreating(false)} onSave={create} />
    </div>
  )
}

function Panel({
  sha,
  homework,
  focus,
  onFocusToggle,
  onJump,
}: {
  sha: string
  /** A homework set named in the URL opens the Homework tab on it. */
  homework?: string
  focus: boolean
  onFocusToggle: () => void
  onJump: (page: number) => void
}) {
  const [tab, setTab] = useState<Tab>(() => (homework ? 'homework' : readTab(sha)))
  const [about, setAbout] = useState<string | null>(null)
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
        <AskTab about={about} onClearAbout={() => setAbout(null)} onJump={onJump} />
      ) : (
        <HomeworkTab
          items={BOOK_HOMEWORK}
          initialSet={homework}
          onJump={onJump}
          onAskAbout={(label) => {
            setAbout(label)
            pick('ask')
          }}
        />
      )}
    </aside>
  )
}

// ------------------------------------------------------------ workspace

export function Workspace() {
  const { sha, homework } = useParams<{ sha: string; homework?: string }>()
  const navigate = useNavigate()
  const found = bookBySha(sha ?? '')

  const [focus, setFocus] = useState(false)
  // A PDF index: the scan is the one place that counts in those.
  const [currentPage, setCurrentPage] = useState(1)
  const [editingBook, setEditingBook] = useState(false)
  // The book dialog's edits, sample-local until the backend stores them.
  const [edits, setEdits] = useState<{ title?: string; author?: string; offset?: number }>({})
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())

  if (!found) {
    return (
      <AppShell>
        <div className="grid h-full place-items-center">
          <p className="text-base text-muted-foreground">There is no book here.</p>
        </div>
      </AppShell>
    )
  }

  const book = { ...found, ...edits }
  const offset = edits.offset ?? PAGE_OFFSET

  // Everything outside the scan speaks printed pages; the scan is indexed
  // by PDF page, so a jump converts once, here.
  const jump = (printed: number) => {
    pageRefs.current.get(pdfOf(printed, offset))?.scrollIntoView()
  }

  return (
    <PageOffset value={offset}>
      <AppShell
        scroll="fill"
        middle={
          // The top bar's one action: editing the thing it names.
          <span className="flex items-center gap-1">
            <span>{book.title}</span>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Edit this book"
              onClick={() => setEditingBook(true)}
              className="text-muted-foreground"
            >
              <Pencil />
            </IconButton>
          </span>
        }
      >
        <div className="flex h-full">
          {!focus && (
            <Rail toc={TOC} currentPage={currentPage - offset} onJump={jump} />
          )}
          <Scan
            pageCount={PAGE_COUNT}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            scrollRef={scrollRef}
            pageRefs={pageRefs}
          />
          <Panel
            sha={book.sha256}
            homework={homework}
            focus={focus}
            onFocusToggle={() => setFocus((f) => !f)}
            onJump={jump}
          />
        </div>
      </AppShell>

      <BookDialog
        open={editingBook}
        book={{
          title: book.title,
          author: book.author,
          offset,
          pages: PAGE_COUNT,
          imported: 'Sep 3',
          homework: BOOK_HOMEWORK.length,
        }}
        onClose={() => setEditingBook(false)}
        onSave={(next) => setEdits(next)}
        onRemove={() => navigate('/')}
      />
    </PageOffset>
  )
}
