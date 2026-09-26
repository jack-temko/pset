import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUp,
  Brain,
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
  RotateCcw,
  Square,
  SquareDashedMousePointer,
  Trash2,
} from 'lucide-react'

import { AppShell } from '@/components/shell'
import { Box, BoxRow } from '@/components/box'
import { DoorAction } from '@/components/door'
import { Checkbox } from '@/components/checkbox'
import { AutoTextarea, Field, Input } from '@/components/input'
import { HomeworkStatusLabel } from '@/components/homework-status'
import { Button, IconButton } from '@/components/button'
import { Tooltip } from '@/components/tooltip'
import {
  AboutChip,
  AssistantTurn,
  ConversationStart,
  DayDivider,
  FailedTurn,
  StoppedNote,
  PageRef,
  Steps,
  Thinking,
  UserTurn,
} from '@/components/transcript'
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav'
import { Veil } from '@/components/veil'
import { Label } from '@/components/label'
import { Menu, MenuCheckItem, MenuConfirmItem, MenuDivider, MenuItem } from '@/components/menu'
import { ConfirmPopover } from '@/components/confirm'
import { Skeleton } from '@/components/skeleton'
import { Spinner } from '@/components/spinner'
import { BookDialog, HomeworkDialog } from './dialogs'
import { AddHomeworkDialog } from './add-homework'
import { useBookHere } from './book-here'
import { AssignmentReads } from './assignment-reads'
import { MemoryDialog, MemoryLines, MemoryUndo } from './memory'
import { FigureReading } from './reading'
import { ProfessorNotes } from './notes'
import { BoxingBar, BoxingProvider, PageBoxes } from './boxing'
import { useBoxing } from './boxing-state'
import { BookHereContext } from './book-here'
import {
  pageImageURL,
  useBook,
  useContents,
  useRemoveBook,
  useUpdateBook,
  type Book,
  type ContentsEntry,
} from '@/api/library'
import { ApiError } from '@/api/client'
import {
  figureURL,
  outstanding,
  questionStep,
  toFind,
  useBookHomework,
  useDeleteHomework,
  useHomeworkSet,
  useRemoveQuestion,
  useAddBoxed,
  usePointOut,
  useRedoReading,
  useRetryQuestion,
  useUpdateHomework,
  useUpdateQuestion,
  worksheetURL,
  type Failure,
  type Question,
  type Retry,
  type Summary,
} from '@/api/homework'
import { CardSkeleton, Prose, Segments } from '@/components/segments'
import { useHeartbeat, type Kind as ActivityKind } from '@/api/activity'
import { useAsk, useClearTurns, useStopTurn, useTurns, type About, type LiveTurn } from '@/api/ask'
import { dueLine, dueStatus } from '@/lib/due'
import { useTimeLeft } from '@/lib/eta'
import { PageMap, Pages, usePages } from '@/lib/pages'
import { useSettled } from '@/lib/settled'
import { cn, plural } from '@/lib/utils'

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
function readTab(bookId: string): Tab {
  try {
    return localStorage.getItem(`pset-panel-tab:${bookId}`) === 'homework' ? 'homework' : 'ask'
  } catch {
    return 'ask'
  }
}
function writeTab(bookId: string, tab: Tab) {
  try {
    localStorage.setItem(`pset-panel-tab:${bookId}`, tab)
  } catch {
    /* forgetting is fine */
  }
}

// ---------------------------------------------------------------- rail

/** The book's contents as a tree of quiet rows, every level the book
 *  gives. The top two show; anything deeper opens under its parent's
 *  chevron. The reader's position highlights the deepest row on show that
 *  it is inside, and the rail keeps that row in view. A jump puts the
 *  destination there at once, until the next scroll moves the page. A book
 *  with no contents has no rail. Pages here are PDF pages, as the engine
 *  sends them; each row shows its printed number, with the PDF page on
 *  hover. Rows touch, so the hover runs unbroken from one to the next. */
function Rail({
  toc,
  page,
  onJump,
}: {
  toc: ContentsEntry[]
  /** The page the rail highlights: the reader's page, or a jump's
   *  destination until the next scroll moves the page. */
  page: number
  onJump: (pdfPage: number) => void
}) {
  const pages = usePages()
  const rail = useRef<HTMLElement>(null)
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const shows = (depth: number, parent?: ContentsEntry) =>
    depth < RAIL_LEVELS || (parent !== undefined && open.has(parent.id))
  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o)
      if (!next.delete(id)) next.add(id)
      return next
    })

  // The current row is the last one on show, in reading order, that
  // starts at or before the page the scan is showing: a closed section
  // stands in for the rows folded inside it.
  const currentId = (() => {
    let id: string | undefined
    const walk = (entries: ContentsEntry[], depth: number) => {
      for (const e of entries) {
        if (e.page <= page) id = e.id
        if (e.children.length > 0 && shows(depth + 1, e)) walk(e.children, depth + 1)
      }
    }
    walk(toc, 0)
    return id
  })()

  // Keep the current row in view, with a row of room around it. Only the
  // rail scrolls: scrollIntoView would move the whole workspace too.
  useEffect(() => {
    const el = rail.current
    const row = el?.querySelector<HTMLElement>('[aria-current]')
    if (!el || !row) return
    const room = row.offsetHeight
    const r = row.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    if (r.top < box.top + room) el.scrollTop -= box.top + room - r.top
    else if (r.bottom > box.bottom - room) el.scrollTop += r.bottom - (box.bottom - room)
  }, [currentId])

  const pageLabel = (pdfPage: number) => (
    <Tooltip label={`PDF page ${pdfPage}`} side="left">
      <span className="shrink-0 font-mono text-xs tabular-nums">{pages.label(pdfPage)}</span>
    </Tooltip>
  )

  const row = (e: ContentsEntry, depth: number): ReactNode => {
    const current = e.id === currentId
    // Below the top level, a row with rows under it folds them away. The
    // chevron sits in the row's indent, so titles stay aligned either way.
    const folds = depth >= RAIL_LEVELS - 1 && e.children.length > 0
    const isOpen = open.has(e.id)
    return (
      <div key={e.id}>
        <div className="relative">
          <button
            type="button"
            onClick={() => onJump(e.page)}
            aria-current={current || undefined}
            className={cn(
              'flex w-full items-center gap-2 pr-4 text-left text-sm',
              RAIL_INDENT[Math.min(depth, RAIL_INDENT.length - 1)],
              depth === 0 ? 'py-2 font-medium' : 'py-1',
              current
                ? 'bg-primary-soft text-primary'
                : depth === 0
                  ? 'text-foreground hover:bg-muted/50'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <span className="min-w-0 flex-1 truncate">{e.title}</span>
            {pageLabel(e.page)}
          </button>
          {folds && (
            <button
              type="button"
              onClick={() => toggle(e.id)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Hide' : 'Show'} what's in ${e.title}`}
              className={cn(
                'absolute top-0 bottom-0 flex w-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground',
                RAIL_CHEVRON[Math.min(depth, RAIL_CHEVRON.length - 1)],
              )}
            >
              <ChevronRight className={cn('size-4 transition-transform duration-150 motion-reduce:transition-none', isOpen && 'rotate-90')} />
            </button>
          )}
        </div>
        {e.children.length > 0 && shows(depth + 1, e) && e.children.map((c) => row(c, depth + 1))}
      </div>
    )
  }

  return (
    <aside ref={rail} className="w-rail shrink-0 overflow-y-auto border-r bg-rail py-4">
      <nav aria-label="Contents">{toc.map((e) => row(e, 0))}</nav>
    </aside>
  )
}

/** How many levels of the contents show before any are opened. */
const RAIL_LEVELS = 2
/** Each level's indent, 16px a step after the top's; deeper than the
 *  last holds there, so a very deep book doesn't walk off the rail. */
const RAIL_INDENT = ['pl-4', 'pl-8', 'pl-12', 'pl-16', 'pl-20']
/** The chevron sits in the 24px just before its row's title. */
const RAIL_CHEVRON = ['left-0', 'left-2', 'left-6', 'left-10', 'left-14']

/** The rail before the contents arrive: rows at their real height. */
function RailSkeleton() {
  return (
    <aside className="w-rail shrink-0 overflow-hidden border-r bg-rail py-4" aria-hidden>
      {[3, 4, 2].map((n, i) => (
        <div key={i}>
          <div className="px-4 py-2 text-sm">
            <Skeleton className="h-3 w-40" />
          </div>
          {Array.from({ length: n }, (_, j) => (
            <div key={j} className="py-1 pr-4 pl-8 text-sm">
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ))}
    </aside>
  )
}

// ---------------------------------------------------------------- scan

/** Zoom is relative to fitting the pane's width: 1 is fit, and the
 *  percentage in the pill says so. */
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3

/**
 * Pages stack in one scrolling pane, edge-to-edge paper. Each is the
 * engine's render of that page, in a box at the page's own proportions so
 * nothing moves when it arrives; its printed number shows until it does.
 * The only chrome is the floating bar:
 * the printed page (the PDF page on hover) and the zoom, awake on arrival
 * and fading when idle.
 *
 * Pinch on a trackpad zooms around the pointer; past the pane's width a
 * click-drag pans, and only then is the cursor a hand. Zoomed, the
 * percentage is a button that snaps back to fit.
 */
function Scan({
  bookId,
  aspect,
  pageCount,
  currentPage,
  onPageChange,
  scrollRef,
  pageRefs,
}: {
  bookId: string
  /** Page height over width. */
  aspect: number
  pageCount: number
  /** A PDF index: the scan is the one place that counts in those. */
  currentPage: number
  onPageChange: (p: number) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  pageRefs: React.RefObject<Map<number, HTMLDivElement>>
}) {
  const pages = usePages()
  // Boxing a problem takes the pointer: a drag draws, and doesn't pan.
  const boxing = useBoxing()
  const boxingOn = boxing.target !== null
  // Awake on arrival, asleep shortly after; scroll, hover or focus wake
  // it again.
  const [pillAwake, setPillAwake] = useState(true)
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [zoom, setZoom] = useState(1)
  const [paneWidth, setPaneWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; y: number } | null>(null)
  // The spot on the page under the pointer, as a fraction of that page, and
  // where the pointer was. After the new size is laid out, the scroll is
  // corrected until that same spot is back under the pointer.
  const anchor = useRef<{
    node: HTMLDivElement
    fx: number
    fy: number
    x: number
    y: number
  } | null>(null)

  // A pointer resting on the bar isn't idle: it stays until the pointer
  // leaves, so its button never fades out from under the cursor.
  const hovered = useRef(false)
  const wake = () => {
    setPillAwake(true)
    clearTimeout(sleepTimer.current)
    sleepTimer.current = setTimeout(() => !hovered.current && setPillAwake(false), 1200)
  }
  // The first sleep: the pill says where you are on arrival, then lets
  // the paper have the frame back.
  useEffect(() => {
    sleepTimer.current = setTimeout(() => setPillAwake(false), 1200)
    return () => clearTimeout(sleepTimer.current)
  }, [])

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
      // Measured once per burst: the first event of a pinch fixes the spot,
      // and every later event in the same frame zooms around it.
      if (!anchor.current) {
        let best: HTMLDivElement | null = null
        let bestDist = Infinity
        for (const node of pageRefs.current.values()) {
          const r = node.getBoundingClientRect()
          const d = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0
          if (d < bestDist) (bestDist = d), (best = node)
          if (d === 0) break
        }
        if (best) {
          const r = best.getBoundingClientRect()
          anchor.current = {
            node: best,
            fx: (e.clientX - r.left) / r.width,
            fy: (e.clientY - r.top) / r.height,
            x: e.clientX,
            y: e.clientY,
          }
        }
      }
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * Math.exp(-e.deltaY * 0.01))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scrollRef])

  // After layout, before paint: find where the anchored spot ended up and
  // scroll by exactly the difference, so it sits under the pointer again.
  // Measuring the page itself, rather than scaling the scroll, stays exact
  // even though the gaps between pages don't scale and the column recentres.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const a = anchor.current
    if (!el || !a) return
    const r = a.node.getBoundingClientRect()
    el.scrollLeft += r.left + a.fx * r.width - a.x
    el.scrollTop += r.top + a.fy * r.height - a.y
    anchor.current = null
  }, [zoom, scrollRef])

  const fitWidth = Math.min(768, Math.max(paneWidth - 48, 0))
  const width = fitWidth * zoom
  const percent = Math.round(zoom * 100)
  const zoomed = percent !== 100
  // Panning only means something once the pages are wider than the pane.
  const canPan = width + 48 > paneWidth + 1 && !boxingOn

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
              className="relative grid place-items-center overflow-hidden rounded-sm border bg-card"
              style={{ aspectRatio: `1 / ${aspect || 11 / 8.5}` }}
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {pages.label(n)}
              </span>
              {width > 0 && (
                <img
                  src={pageImageURL(bookId, n, width)}
                  alt={`Page ${pages.label(n)}`}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 size-full"
                />
              )}
              <PageBoxes page={n} />
            </div>
          ))}
        </div>
      </div>

      {/* A floating bar, shaped like the Veil's chip and the Menu's card:
          radius-md, hairline, the floating shadow. The zoom is a button
          only while there is something to reset, and says so: the value,
          a reset icon, and "Fit to width" on hover. At fit it's a fact. */}
      <BoxingBar />
      <div
        hidden={boxingOn}
        onMouseEnter={() => {
          hovered.current = true
          wake()
        }}
        onMouseLeave={() => {
          hovered.current = false
          wake()
        }}
        className={cn(
          'absolute bottom-6 left-1/2 flex h-control -translate-x-1/2 items-center gap-1 rounded-md border bg-card px-1 text-xs text-muted-foreground shadow-floating transition-opacity duration-150 ease-out focus-within:opacity-100 motion-reduce:transition-none',
          pillAwake ? 'opacity-100' : 'opacity-0',
        )}
      >
        <Tooltip label={`PDF page ${currentPage} of ${pageCount}`}>
          <span tabIndex={0} className="flex h-control-sm items-center rounded-md px-2 font-mono tabular-nums">
            p. {pages.label(currentPage)}
          </span>
        </Tooltip>
        <span aria-hidden className="h-4 w-px bg-border-muted" />
        {zoomed ? (
          <Tooltip label="Fit to width">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${percent}%, fit to width`}
              onClick={() => {
                setZoom(1)
                wake()
              }}
              className="font-mono tabular-nums"
            >
              {percent}%
              <RotateCcw />
            </Button>
          </Tooltip>
        ) : (
          <span className="flex h-control-sm items-center px-2 font-mono tabular-nums">{percent}%</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- panel

/** Mid-turn and preflight setup failures share one sentence (ask's
 *  noChatModel const), so a model that vanished mid-answer gets Open
 *  Settings too. */
const isSetupReason = (reason?: string | null) => !!reason?.includes('no chat model set up yet')

/** A day as a divider says it: "Today", "Yesterday", "Sep 12". */
function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * One turn: the question on the right, then the answer as one stream,
 * with each tool call on the feed where it happened. A call that runs
 * between two paragraphs is drawn between them, because that is what it
 * was: the app went and looked something up mid-sentence, and a feed
 * stacked at the top would say it happened before any of it.
 *
 * Nothing draws a skeleton for the answer itself: its shape is unknown
 * until it arrives, so a shimmer would promise a size it may not take.
 * Skeletons belong to cards, where the envelope named the kind first.
 */
function TurnView({ t, onJump, onRetry }: { t: LiveTurn; onJump: (page: number) => void; onRetry: () => void }) {
  const navigate = useNavigate()
  const running = t.state === 'running'
  const last = t.steps[t.steps.length - 1]
  const lastRunning = !!last?.running
  // Waiting on the model with nothing saying so: no call running, no card
  // on its way, and no words since the last step (streaming words say it
  // themselves).
  const endsInStep = t.steps.some((s) => Math.min(s.after ?? 0, t.answer.length) === t.answer.length)
  const thinking = running && !lastRunning && !t.pending && (t.answer.length === 0 || endsInStep)
  // Each step sits after the segments written when it ran. Turns saved
  // before steps carried a position have none, and land at the top, as
  // they always did.
  const feed = (i: number) => {
    const at = t.steps.filter((s) => Math.min(s.after ?? 0, t.answer.length) === i)
    if (at.length === 0) return null
    return (
      <Steps
        steps={at.map((s) =>
          s.memoryId ? { label: s.label, action: <MemoryUndo bookId={t.bookId} memoryId={s.memoryId} /> } : s.label,
        )}
        running={running && lastRunning && at.includes(last)}
        thinking={thinking && i === t.answer.length}
      />
    )
  }
  return (
    <>
      <UserTurn about={t.about || undefined}>{t.question}</UserTurn>
      {(t.steps.length > 0 || t.answer.length > 0 || t.pending || thinking) && (
        <AssistantTurn>
          {t.answer.map((seg, i) => (
            <Fragment key={i}>
              {feed(i)}
              <Segments segments={[seg]} onJump={onJump} />
            </Fragment>
          ))}
          {feed(t.answer.length)}
          {thinking && t.steps.length === 0 && <Thinking />}
          {t.pending && <CardSkeleton kind={t.pending.kind} repairing={t.pending.repairing} />}
        </AssistantTurn>
      )}
      {t.state === 'stopped' && <StoppedNote />}
      {t.state === 'failed' && (
        <FailedTurn
          reason={t.reason ?? ''}
          onRetry={onRetry}
          onSetup={isSetupReason(t.reason) ? () => navigate('/settings#connections') : undefined}
        />
      )}
    </>
  )
}

/** Ask: the transcript over the composer. An empty conversation is a
 *  prompt line and one sentence of capability: no generated suggestions. */
function AskTab({
  bookId,
  bookTitle,
  about,
  onClearAbout,
  onJump,
}: {
  bookId: string
  bookTitle: string
  /** The homework question "Ask about this" brought along, if any. */
  about: About | null
  onClearAbout: () => void
  onJump: (page: number) => void
}) {
  const turns = useTurns(bookId)
  const ask = useAsk(bookId)
  const stop = useStopTurn()
  const clear = useClearTurns(bookId)
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const scroller = useRef<HTMLDivElement | null>(null)
  const pinned = useRef(true)
  const list = turns.data
  const running = list?.find((t) => t.state === 'running')

  // Follow the answer as it streams, unless you've scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [list])

  const send = (question: string, withAbout: About | null) => {
    if (!question.trim() || running) return
    pinned.current = true
    ask.mutate(
      { question, about: withAbout ?? undefined },
      {
        onSuccess: () => {
          setText('')
          onClearAbout()
        },
      },
    )
  }

  return (
    <>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
        }}
        className="min-h-0 flex-1 overflow-y-auto p-card"
      >
        {list === undefined ? (
          <div className="space-y-5" aria-hidden>
            <div className="ml-auto w-2/3 space-y-1 rounded-md bg-primary-soft p-3">
              <Skeleton className="h-3 w-full" />
            </div>
            <p className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-1 pb-2">
            <p className="font-heading text-lg">Ask anything about {bookTitle}.</p>
            <p className="text-sm text-muted-foreground">
              It searches and reads the book, looks at figures, and checks its arithmetic, then answers with the pages it used.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <ConversationStart onClear={() => clear.mutate()} />
            {list.map((t, i) => {
              const day = dayLabel(t.createdAt)
              const newDay = i === 0 || dayLabel(list[i - 1].createdAt) !== day
              return (
                <div key={t.id} className="space-y-5">
                  {newDay && <DayDivider label={day} />}
                  <TurnView t={t} onJump={onJump} onRetry={() => send(t.question, null)} />
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t p-card">
        {/* The question rides above the composer as a chip, so the box
            stays empty for your own words. */}
        {about && (
          <div className="mb-2">
            <AboutChip label={about.label} onRemove={onClearAbout} />
          </div>
        )}
        {ask.isError && (
          <div className="mb-2">
            <FailedTurn
              reason={ask.error.message}
              onRetry={() => send(text, about)}
              onSetup={
                ask.error instanceof ApiError && ask.error.code === 'not_configured'
                  ? () => navigate('/settings#connections')
                  : undefined
              }
            />
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (running) stop.mutate(running.id)
            else send(text, about)
          }}
        >
          <AutoTextarea
            rows={1}
            value={text}
            placeholder="Ask about this book…"
            onChange={(e) => {
              setText(e.target.value)
              if (ask.isError) ask.reset()
            }}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter is a new line.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(text, about)
              }
            }}
            className="flex-1"
          />
          {running ? (
            <IconButton type="submit" variant="outline" aria-label="Stop">
              <Square />
            </IconButton>
          ) : (
            <IconButton type="submit" variant="primary" aria-label="Send" disabled={!text.trim() || ask.isPending}>
              <ArrowUp />
            </IconButton>
          )}
        </form>
      </div>
    </>
  )
}

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
 * A question the engine couldn't write a guide for, as a recoverable
 * state about that question: a title naming what failed, a sentence
 * saying what happened, and the ways out that fit the kind. Not found:
 * give the page. The guide didn't finish, or the provider didn't answer:
 * Try again. The connection is wrong: Open Settings. Below, where it can
 * help, pasting the problem as a fallback. Every action is enabled; one
 * with nothing to go on says what it needs.
 */
function FailedQuestion({ q, onRetry }: { q: Question; onRetry: (r: Retry) => void }) {
  const pages = usePages()
  const boxing = useBoxing()
  const navigate = useNavigate()
  const [page, setPage] = useState('')
  const [text, setText] = useState('')
  const [pageError, setPageError] = useState('')
  const [textError, setTextError] = useState('')
  // A plain text field, not a number spinner: people type "57", "p. 57"
  // or "page 57", and all of them mean the first number in it.
  const pageNumber = Number(page.match(/\d+/)?.[0] ?? 0)
  // Failed before failures had kinds: found (or never looked for) means
  // the guide failed, otherwise it wasn't found.
  const kind: Failure = q.failure || (q.page !== undefined || !q.inBook ? 'generation' : 'not_found')
  const name = /^\d/.test(q.label) ? q.label : 'this question'

  const title = {
    generation: "Couldn't write the guide",
    unavailable: "The chat model isn't responding",
    setup: 'The chat model needs setting up',
    not_found: `Couldn't find ${name} in this book`,
  }[kind]

  const retryButton = (variant: 'primary' | 'ghost') => (
    <Button variant={variant} onClick={() => onRetry({})}>
      Try again
    </Button>
  )

  // Pasting helps when the book is the trouble (not found, or found and
  // read wrong); it can't help a model that isn't answering.
  const fallback =
    kind === 'not_found'
      ? { title: 'Not from this book?', body: 'Paste the problem, and the guide is written from your text alone.' }
      : kind === 'generation' && q.inBook
        ? {
            title: 'Having trouble with this problem?',
            body: 'If the problem above looks wrong, paste it, and the guide is written from your text instead.',
          }
        : null

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-base font-semibold">
            <CircleAlert className="size-4 shrink-0 text-destructive" />
            {title}
          </p>
          <p className="text-sm text-muted-foreground">{q.reason}</p>
        </div>

        {kind === 'not_found' ? (
          <div className="space-y-3">
            {/* The way out that always works: show it on the page. */}
            <Button onClick={() => boxing.start({ kind: 'find', questionId: q.id, label: name })}>
              <SquareDashedMousePointer />
              Show me where it is
            </Button>
            <form
              className="flex items-start gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (pageNumber > 0) onRetry({ page: pages.nearest(pageNumber) })
                else setPageError('Type the page number first.')
              }}
            >
              <Field label="Printed page" error={pageError || undefined} className="w-40">
                <Input
                  inputMode="numeric"
                  value={page}
                  onChange={(e) => {
                    setPage(e.target.value)
                    setPageError('')
                  }}
                  className="font-mono"
                />
              </Field>
              {/* Level with the input, under the field's label. */}
              <Button type="submit" variant="outline" className="mt-6">
                Look there
              </Button>
            </form>
          </div>
        ) : kind === 'setup' ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/settings#connections')}>Open Settings</Button>
            {retryButton('ghost')}
          </div>
        ) : (
          retryButton('primary')
        )}
      </div>

      {fallback && (
        <div className="space-y-2 border-t pt-5">
          <p className="text-sm font-medium">{fallback.title}</p>
          <p className="text-xs text-muted-foreground">{fallback.body}</p>
          {/* A real text box: a whole question gets pasted here, so it
              starts four lines tall and grows from there. */}
          <AutoTextarea
            rows={4}
            value={text}
            placeholder="Paste the problem"
            className="py-2"
            onChange={(e) => {
              setText(e.target.value)
              setTextError('')
            }}
          />
          {textError && <p className="text-xs text-destructive">{textError}</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => (text.trim() ? onRetry({ text: text.trim() }) : setTextError('Paste the problem first.'))}
          >
            Use this text
          </Button>
        </div>
      )}
    </div>
  )
}

const STAGE_NAMES = ['hint', 'walkthrough'] as const

/** A stage still being written: skeleton lines at a stage's usual size,
 *  so the guide lands in space already made for it. A hint runs two
 *  lines, a walkthrough about five; the last stops short, as prose does. */
function StageSkeleton({ name, still }: { name: (typeof STAGE_NAMES)[number]; still?: boolean }) {
  const lines = name === 'hint' ? 2 : 5
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase">{name}</p>
      <div className="space-y-1 text-base">
        {Array.from({ length: lines }, (_, j) => (
          <p key={j}>
            <Skeleton still={still} className={cn('h-3', j === lines - 1 ? 'w-2/3' : 'w-full')} />
          </p>
        ))}
      </div>
    </div>
  )
}

/** What the engine is doing to a question, while it does it: finding it,
 *  reading its figure, then whatever the guide's writer is doing (thinking, searching the
 *  book, computing), then writing. */
function workingLine(q: Question): string | null {
  if (q.state === 'locating') return q.activity || 'Finding it in the book…'
  if (q.state === 'reading') return q.activity || 'Reading the figure…'
  if (q.state === 'writing') return q.activity || 'Getting started…'
  return null
}

/** What the engine is doing to a question, and the time left on it
 *  (lib/eta) once past questions give an estimate. */
function WorkingLine({ q, text }: { q: Question; text: string }) {
  const left = useTimeLeft(`question:${q.id}`, questionStep(q))
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Spinner className="size-3" />
      {/* An ellipsis run into the dot reads as a smudge ("memory… ·"):
          with an estimate after it, the words drop their ellipsis, and the
          spinner still says it's under way. The estimate wraps whole. */}
      <span>
        {left ? text.replace(/…$/, '') : text}
        {left && <span className="whitespace-nowrap"> · {left}</span>}
      </span>
    </p>
  )
}

/** What a queued question is waiting for. Every question is found before
 *  any guide is written, so one still to be found waits only on the finds
 *  ahead of it, and a guide waits on every find in the set, then on the
 *  questions ahead of it. */
function waitingLine(q: Question, questions: Question[], pages: PageMap): string {
  const ahead = questions.filter((x) => x.position < q.position)
  if (toFind(q)) {
    return ahead.some(toFind) ? 'Queued: it starts when the questions ahead of it are found.' : 'Queued: it starts in a moment.'
  }
  const lead = q.page !== undefined ? `Found on p. ${pages.label(q.page)}. Its guide starts` : 'Queued: it starts'
  if (questions.some((x) => x.id !== q.id && toFind(x))) return `${lead} once every question is found.`
  if (ahead.some(outstanding)) return `${lead} once the questions ahead of it are written.`
  return `${lead} in a moment.`
}

/** One question at a time. Both stages sit veiled below the statement:
 *  the walkthrough carries the solution, and Complete is a checkbox that
 *  does exactly one thing. Spec: design/workspace.md. */
function Walkthrough({
  setId,
  onEdit,
  onDelete,
  onBack,
  onJump,
  onAskAbout,
}: {
  setId: string
  onEdit: () => void
  onDelete: () => void
  onBack: () => void
  onJump: (page: number) => void
  onAskAbout: (about: About) => void
}) {
  const pages = usePages()
  const detail = useHomeworkSet(setId)
  const updateSet = useUpdateHomework(setId)
  const update = useUpdateQuestion(setId)
  const removeQ = useRemoveQuestion(setId)
  const retryQ = useRetryQuestion()
  const redoReading = useRedoReading()
  const { bookId } = useBookHere()
  const boxing = useBoxing()
  const [adding, setAdding] = useState(false)
  const [index, setIndex] = useState<number | null>(null)
  // Removing a question asks first, under its trash button. It holds the
  // id it asked about, so moving to another question can't retarget it.
  const [removing, setRemoving] = useState<string | null>(null)
  const trash = useRef<HTMLButtonElement>(null)

  const set = detail.data?.homework
  const questions = detail.data?.questions ?? []
  // Open where you'd pick up: the first question not yet complete, once
  // the set has loaded.
  useEffect(() => {
    if (index === null && detail.data) {
      const i = detail.data.questions.findIndex((q) => !q.done)
      setIndex(i === -1 ? 0 : i)
    }
  }, [detail.data, index])
  // A question boxed on the page opens once it's in the set.
  const [openedBoxed, setOpenedBoxed] = useState<string | null>(null)
  useEffect(() => {
    if (!boxing.added || boxing.added === openedBoxed || !detail.data) return
    const i = detail.data.questions.findIndex((x) => x.id === boxing.added)
    if (i !== -1) {
      setIndex(i)
      setOpenedBoxed(boxing.added)
    }
  }, [boxing.added, openedBoxed, detail.data])
  const at = Math.min(index ?? 0, Math.max(questions.length - 1, 0))
  const q = questions[at] as Question | undefined
  const turnedIn = !!set?.turnedInAt
  // Until every question is found, the worksheet has bare labels in it.
  const finding = questions.filter(toFind).length
  // A question waits between its steps for a moment, often less: the wait
  // shows only once it has lasted, and until then the line before it
  // stays (its state and what it was doing), or a blank at first.
  const waits = q !== undefined && (q.state === 'pending' || q.state === 'located')
  const waitSince = waits ? Date.parse(q.updatedAt) : null
  const shownState = useSettled(q?.state, waitSince, q?.id)
  const shownActivity = useSettled(q?.activity, waitSince, q?.id)

  // Add questions: typed, or from the professor's document, read as an
  // update to the set. Typed ones land you on the first of them.
  const dialog = bookId && (
    <AddHomeworkDialog
      open={adding}
      bookId={bookId}
      set={{ id: setId, title: detail.data?.homework.title ?? '' }}
      onClose={() => setAdding(false)}
      onDone={(_, wrote) => {
        if (wrote) setIndex(questions.length)
      }}
    />
  )

  // The bar keeps what you read (where you are, which set, how far in)
  // and the menu holds what you do to the set. Turned in stays a fact you
  // can take back, as a checkable item.
  const header = (
    <div className="flex h-row shrink-0 items-center gap-2 border-b px-2">
      <IconButton variant="ghost" size="sm" aria-label="Back to homework" onClick={onBack}>
        <ChevronLeft />
      </IconButton>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {set ? set.title : <Skeleton className="h-3 w-40" />}
      </span>
      {turnedIn && <Label tone="success">Turned in</Label>}
      {questions.length > 0 && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {at + 1} of {questions.length}
        </span>
      )}
      <Menu label="Homework actions">
        <MenuItem icon={<Plus />} onSelect={() => setAdding(true)}>
          Add questions
        </MenuItem>
        {/* The other way to add one: show it on the page, which works for
            any book, however it numbers its problems. */}
        <MenuItem icon={<SquareDashedMousePointer />} onSelect={() => boxing.start({ kind: 'add', setId })}>
          Box one on the page
        </MenuItem>
        <MenuItem icon={<Pencil />} onSelect={onEdit}>
          Edit homework
        </MenuItem>
        {/* A worksheet: statements and figures with room to work, nothing
            revealed. It opens in a new tab, to print or save from there.
            While questions are still being found, the hint says how many
            would print as a bare label; it never stops you printing. */}
        <MenuItem
          icon={<Printer />}
          hint={finding > 0 ? `${finding} still being found` : undefined}
          onSelect={() => window.open(worksheetURL(setId), '_blank')}
        >
          Print worksheet
        </MenuItem>
        <MenuDivider />
        {/* An act until it's done, then a fact: "Turn in", then
            "Turned in" with its check. Choosing it again takes it back. */}
        <MenuCheckItem checked={turnedIn} onChange={() => updateSet.mutate({ turnedIn: !turnedIn })}>
          {turnedIn ? 'Turned in' : 'Turn in'}
        </MenuCheckItem>
        {/* Last and apart, as on the book's menu. It asks first, naming
            what goes; the set has to have loaded to say so. */}
        {set && (
          <>
            <MenuDivider />
            <MenuConfirmItem
              icon={<Trash2 />}
              question={`Delete ${set.title}?`}
              detail={
                set.total === 0
                  ? 'It has no questions yet.'
                  : `Its ${plural(set.total, 'question')} go with it, with their guides and what you checked off.`
              }
              action="Delete homework"
              onConfirm={onDelete}
            >
              Delete homework
            </MenuConfirmItem>
          </>
        )}
      </Menu>
    </div>
  )

  if (!detail.data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="space-y-5 p-card">
          <Skeleton className="h-4 w-24" />
          <p className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </p>
          <StageSkeleton name="hint" />
          <StageSkeleton name="walkthrough" />
        </div>
      </div>
    )
  }

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

  const move = (by: number) => {
    update.mutate({ id: q.id, patch: { position: q.position + by } })
    // Follow the question you just moved, not the slot it left.
    setIndex(at + by)
  }
  const working = shownState && workingLine({ ...q, state: shownState, activity: shownActivity })
  // Waiting to be found, or found and waiting for its guide: either way
  // nothing is happening to it yet.
  const queued = shownState === 'pending' || shownState === 'located'
  // The skeletons shimmer only for work: still while queued, and still
  // while it isn't known yet whether this is a wait.
  const still = queued || !shownState

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-card">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-lg font-semibold">{q.label}</span>
          {/* A question that isn't in this book has nothing to jump to. */}
          {q.page !== undefined && <PageRef pdf={q.page} onJump={onJump} />}
          {q.done && <Check aria-label="Done" className="size-4 text-success" />}
          {/* Order and removal, inline and quiet: the set is editable from
              the question you are looking at. */}
          <IconButton variant="ghost" size="sm" aria-label="Move this question up" disabled={at === 0} onClick={() => move(-1)}>
            <ChevronUp />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Move this question down"
            disabled={at === questions.length - 1}
            onClick={() => move(1)}
          >
            <ChevronDown />
          </IconButton>
          <IconButton
            ref={trash}
            variant="ghost"
            size="sm"
            aria-label="Remove this question"
            aria-haspopup="dialog"
            aria-expanded={removing === q.id}
            onClick={() => setRemoving(q.id)}
            className={cn(removing === q.id && 'bg-muted/50 text-foreground')}
          >
            <Trash2 />
          </IconButton>
          {removing === q.id && (
            <ConfirmPopover
              anchor={trash}
              question={`Remove ${q.label}?`}
              detail="Its guide and your progress on it go with it."
              action="Remove"
              onCancel={() => setRemoving(null)}
              onConfirm={() => {
                setRemoving(null)
                removeQ.mutate(q.id)
                setIndex(Math.max(0, Math.min(at, questions.length - 2)))
              }}
            />
          )}
        </div>

        {/* A bare reference ("3.C.14") is already the label; saying it
            twice isn't a statement. While it's still being found, the
            statement is a skeleton the book's text will replace. */}
        {q.statement && q.statement !== q.label ? (
          <div className="space-y-3 text-base">
            <Prose text={q.statement} onJump={onJump} />
          </div>
        ) : (
          q.inBook &&
          (q.state === 'pending' || q.state === 'locating') && (
            <p className="space-y-1 text-base">
              <Skeleton still={still} className="h-3 w-full" />
              <Skeleton still={still} className="h-3 w-2/3" />
            </p>
          )
        )}
        {q.figures.map((f, i) => (
          <figure key={i} className="space-y-1">
            <img src={figureURL(q.id, i)} alt={f.label || 'Figure'} className="w-full rounded-md border bg-card" />
            {f.label && <figcaption className="text-xs text-muted-foreground">{f.label}</figcaption>}
          </figure>
        ))}
        {/* A find can land on the wrong problem; showing the right one is
            the same tool a failed find offers. */}
        {q.inBook && q.page !== undefined && q.state !== 'failed' && (
          <p className="text-xs text-muted-foreground">
            Not the right problem?{' '}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => boxing.start({ kind: 'find', questionId: q.id, label: q.label })}
            >
              Show me where it is
            </button>
          </p>
        )}

        {/* The professor's say on the problem, over the book's. */}
        <ProfessorNotes key={q.id} q={q} onSave={(notes) => update.mutate({ id: q.id, patch: { notes } })} />

        {/* The words the guide is written from, once there are any: a
            question still being found or read has none to check yet. */}
        {q.figures.length > 0 &&
          q.page !== undefined &&
          q.state !== 'pending' &&
          q.state !== 'locating' &&
          q.state !== 'reading' && (
            <FigureReading
              key={q.id}
              q={q}
              onCorrect={(lines) => redoReading.mutate({ id: q.id, lines })}
              onReread={() => redoReading.mutate({ id: q.id })}
            />
          )}

        {q.state === 'failed' ? (
          <FailedQuestion key={q.id} q={q} onRetry={(retry) => retryQ.mutate({ id: q.id, retry })} />
        ) : (
          <>
            {/* Queued is a word and no motion: nothing is happening to it
                yet. Working gets the spinner and the shimmer. */}
            {queued ? (
              <p className="text-xs text-muted-foreground">{waitingLine(q, questions, pages)}</p>
            ) : working ? (
              <WorkingLine q={q} text={working} />
            ) : (
              // A wait too young to show yet, with nothing shown before
              // it: a blank at the line's height, so nothing moves.
              outstanding(q) && <p className="text-xs">{'\u00a0'}</p>
            )}
            {STAGE_NAMES.map((name) => {
              const segs = name === 'hint' ? q.hint : q.walkthrough
              // Each stage fills in as it's written: the hint can be
              // there while the walkthrough is still a skeleton.
              if (segs.length === 0) return <StageSkeleton key={name} name={name} still={still} />
              return (
                <Stage
                  key={name}
                  label={name}
                  revealed={q.revealed.includes(name)}
                  onReveal={() => update.mutate({ id: q.id, patch: { reveal: name } })}
                >
                  <Segments segments={segs} onJump={onJump} />
                </Stage>
              )
            })}
            {set && <MemoryLines bookId={set.bookId} lines={q.memory} />}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t p-card">
        <Button variant="ghost" size="sm" onClick={() => onAskAbout({ label: q.label, text: q.statement || q.text })}>
          Ask about this
        </Button>
        <div className="flex items-center gap-2">
          <IconButton variant="ghost" size="sm" aria-label="Previous question" disabled={at === 0} onClick={() => setIndex(at - 1)}>
            <ChevronLeft />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Next question"
            disabled={at === questions.length - 1}
            onClick={() => setIndex(at + 1)}
          >
            <ChevronRight />
          </IconButton>
          {/* Done must be as easy to take back as to claim, so it is a
              checkbox and it does not advance. */}
          <Checkbox checked={q.done} onChange={() => update.mutate({ id: q.id, patch: { done: !q.done } })}>
            Complete
          </Checkbox>
        </div>
      </div>

      {dialog}
    </div>
  )
}

/** A set's row in the list. */
function SetRow({ h, onOpen }: { h: Summary; onOpen: () => void }) {
  const status = dueStatus(h)
  return (
    <BoxRow
      onClick={onOpen}
      title={h.title}
      description={`${h.done} of ${h.total} questions · ${dueLine(h)}`}
      trailing={<HomeworkStatusLabel status={status} />}
    />
  )
}

/** The homework list: active sets, then turned-in ones under a quiet
 *  label. Opening a set fills the panel with its walkthrough. */
function HomeworkTab({
  bookId,
  initialSet,
  onJump,
  onAskAbout,
}: {
  bookId: string
  /** From the URL: Home's due list opens a set directly. */
  initialSet?: string
  onJump: (page: number) => void
  onAskAbout: (about: About) => void
}) {
  const list = useBookHomework(bookId)
  const remove = useDeleteHomework()
  const [openId, setOpenId] = useState<string | null>(initialSet ?? null)
  // New homework, opened fresh or on a read waiting in the list.
  const [adding, setAdding] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const openSet = useHomeworkSet(openId).data?.homework
  const updateOpen = useUpdateHomework(openId ?? '')
  const sets = list.data
  const active = (sets ?? []).filter((h) => !h.turnedInAt)
  const turnedIn = (sets ?? []).filter((h) => h.turnedInAt)

  if (openId) {
    return (
      <>
        <Walkthrough
          key={openId}
          setId={openId}
          onEdit={() => setEditing(true)}
          onDelete={() => openSet && remove.mutate(openSet, { onSuccess: () => setOpenId(null) })}
          onBack={() => setOpenId(null)}
          onJump={onJump}
          onAskAbout={onAskAbout}
        />
        {openSet && (
          <HomeworkDialog
            open={editing}
            editing={{ title: openSet.title, due: openSet.dueDate }}
            onClose={() => setEditing(false)}
            onSave={(title, due) => updateOpen.mutate({ title, dueDate: due })}
          />
        )}
      </>
    )
  }

  return (
    <div
      className={cn(
        'min-h-0 flex-1 space-y-4 overflow-y-auto p-card',
        // An empty tab centers its one sentence and the way out.
        sets?.length === 0 && 'flex flex-col justify-center',
      )}
    >
      {sets?.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No homework here yet. New homework takes your professor's assignment (a file, a web page or
          pasted text), or the questions you type.
        </p>
      )}
      {/* Assignments reading in the background, or read and waiting to
          be looked over, first: they're what's new. */}
      <AssignmentReads
        bookId={bookId}
        onReview={(id) => {
          setReviewing(id)
          setAdding(true)
        }}
      />
      {/* No header: the tab already says Homework, and a second label on
          the box only said it again. The way to add one is the list's last
          row, shaped like the Door. */}
      <Box>
        {sets === undefined
          ? [0, 1].map((i) => (
              <BoxRow key={i} title={<Skeleton className="h-3 w-40" />} description={<Skeleton className="h-3 w-48" />} />
            ))
          : active.map((h) => <SetRow key={h.id} h={h} onOpen={() => setOpenId(h.id)} />)}
        <DoorAction
          icon={<Plus aria-hidden />}
          onClick={() => setAdding(true)}
          className={cn((sets === undefined || active.length > 0) && 'border-t border-border-muted')}
        >
          New homework
        </DoorAction>
      </Box>
      {turnedIn.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">Turned in</p>
          <Box>
            {turnedIn.map((h) => (
              <SetRow key={h.id} h={h} onOpen={() => setOpenId(h.id)} />
            ))}
          </Box>
        </>
      )}

      {/* One set made lands you in it; several stay on the list, where
          they all are. */}
      <AddHomeworkDialog
        open={adding}
        bookId={bookId}
        readId={reviewing}
        onClose={() => {
          setAdding(false)
          setReviewing(null)
        }}
        onDone={(made) => made.length === 1 && setOpenId(made[0].id)}
      />
    </div>
  )
}

function Panel({
  bookId,
  bookTitle,
  onActive,
  homework,
  focus,
  onFocusToggle,
  onJump,
}: {
  bookId: string
  bookTitle: string
  /** Where the student last worked, for the week's time. */
  onActive: (kind: ActivityKind) => void
  /** A homework set named in the URL opens the Homework tab on it. */
  homework?: string
  focus: boolean
  onFocusToggle: () => void
  onJump: (page: number) => void
}) {
  const [tab, setTab] = useState<Tab>(() => (homework ? 'homework' : readTab(bookId)))
  const [about, setAbout] = useState<About | null>(null)
  const pick = (t: Tab) => {
    setTab(t)
    writeTab(bookId, t)
  }

  return (
    <aside
      onPointerDownCapture={() => onActive(tab === 'ask' ? 'asking' : 'homework')}
      onKeyDownCapture={() => onActive(tab === 'ask' ? 'asking' : 'homework')}
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
        <AskTab bookId={bookId} bookTitle={bookTitle} about={about} onClearAbout={() => setAbout(null)} onJump={onJump} />
      ) : (
        <HomeworkTab
          bookId={bookId}
          initialSet={homework}
          onJump={onJump}
          onAskAbout={(a) => {
            setAbout(a)
            pick('ask')
          }}
        />
      )}
    </aside>
  )
}

// ------------------------------------------------------------ workspace

/** The workspace frame with nothing in it yet, or a sentence instead. */
function WorkspaceMessage({ children }: { children?: ReactNode }) {
  return (
    <AppShell scroll="fill">
      <div className="grid h-full place-items-center bg-muted/40">
        {children && <p className="text-base text-muted-foreground">{children}</p>}
      </div>
    </AppShell>
  )
}

export function Workspace() {
  const { id = '', homework } = useParams<{ id: string; homework?: string }>()
  const bookQuery = useBook(id)
  if (bookQuery.error instanceof ApiError && bookQuery.error.code === 'not_found')
    return <WorkspaceMessage>There is no book here.</WorkspaceMessage>
  if (bookQuery.error) return <WorkspaceMessage>{bookQuery.error.message}</WorkspaceMessage>
  if (!bookQuery.data) return <WorkspaceMessage />
  if (bookQuery.data.state.kind !== 'ready')
    return <WorkspaceMessage>This book is still being prepared. It opens once it's on the shelf.</WorkspaceMessage>
  return <BookWorkspace key={id} book={bookQuery.data} homework={homework} />
}

function BookWorkspace({ book, homework }: { book: Book; homework?: string }) {
  const navigate = useNavigate()
  const contents = useContents(book.id)
  const update = useUpdateBook(book.id)
  const remove = useRemoveBook()
  const addBoxed = useAddBoxed()
  const pointOut = usePointOut()

  const [focus, setFocus] = useState(false)
  // A PDF index: the scan is the one place that counts in those.
  const [currentPage, setCurrentPage] = useState(1)
  // The page a jump landed on holds the rail's highlight until a scroll
  // that moves the page says otherwise.
  const [pinnedPage, setPinnedPage] = useState<number | null>(null)
  const [editingBook, setEditingBook] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())

  const pages = useMemo(() => new PageMap(book.pageRuns), [book.pageRuns])
  // The jump's own scroll lands a frame later and mustn't unpin it: near
  // the end of the book, or with short pages, the page it settles on
  // isn't the destination.
  const jumping = useRef(false)
  const jumpPdf = (pdf: number) => {
    setPinnedPage(pdf)
    jumping.current = true
    pageRefs.current.get(pdf)?.scrollIntoView()
    requestAnimationFrame(() => requestAnimationFrame(() => (jumping.current = false)))
  }
  // Every page travels as its PDF page, and only a label says the
  // printed one (lib/pages): a jump is one.
  const jump = jumpPdf
  const settlePage = (p: number) => {
    setCurrentPage(p)
    if (p !== pinnedPage && !jumping.current) setPinnedPage(null)
  }
  const entries = contents.data?.entries
  const homeworkCount = useBookHomework(book.id).data?.length ?? 0
  // Time counts toward what you last touched: the panel's tab, or the
  // book itself.
  const activity = useRef<ActivityKind>('reading')
  useHeartbeat(book.id, () => activity.current)

  return (
    <Pages value={pages}>
      <BoxingProvider
        onDone={async (target, boxes) => {
          if (target.kind === 'add') return (await addBoxed.mutateAsync({ setId: target.setId, boxes })).id
          await pointOut.mutateAsync({ id: target.questionId, boxes })
        }}
      >
        <BookHereContext
          value={{ bookId: book.id, problems: book.problems, editBook: () => setEditingBook(true) }}
        >
          <AppShell
            scroll="fill"
            middle={
              // The bar names the book, and its one menu holds what you do to
              // it: edit it, see what the tutor remembers, and, last and apart,
              // remove it. Every thing has one menu for its actions, the
              // homework set's included.
              <span className="flex items-center gap-2">
                <span>{book.title}</span>
                <Menu label="Book actions">
                  <MenuItem icon={<Pencil />} onSelect={() => setEditingBook(true)}>
                    Edit book
                  </MenuItem>
                  <MenuItem icon={<Brain />} onSelect={() => setMemoryOpen(true)}>
                    Memory
                  </MenuItem>
                  <MenuDivider />
                  <MenuConfirmItem
                    icon={<Trash2 />}
                    question={`Remove ${book.title}?`}
                    detail={`${plural(homeworkCount, 'homework set')}, the conversation and what the tutor remembers go with it. Importing the PDF again starts fresh.`}
                    action="Remove book"
                    onConfirm={() => remove.mutate(book.id, { onSuccess: () => navigate('/') })}
                  >
                    Remove book
                  </MenuConfirmItem>
                </Menu>
              </span>
            }
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex min-h-0 flex-1" onPointerDownCapture={() => (activity.current = 'reading')}>
              {!focus &&
                (entries === undefined ? (
                  <RailSkeleton />
                ) : (
                  entries.length > 0 && <Rail toc={entries} page={pinnedPage ?? currentPage} onJump={jumpPdf} />
                ))}
              <Scan
                bookId={book.id}
                aspect={book.aspect}
                pageCount={book.pageCount}
                currentPage={currentPage}
                onPageChange={settlePage}
                scrollRef={scrollRef}
                pageRefs={pageRefs}
              />
              <Panel
                bookId={book.id}
                bookTitle={book.title}
                onActive={(k) => (activity.current = k)}
                homework={homework}
                focus={focus}
                onFocusToggle={() => setFocus((f) => !f)}
                onJump={jump}
              />
              </div>
            </div>
          </AppShell>

          <MemoryDialog open={memoryOpen} bookId={book.id} onClose={() => setMemoryOpen(false)} onJump={jump} />

          <BookDialog
            open={editingBook}
            book={{
              title: book.title,
              author: book.author,
              runs: book.pageRuns,
              problems: book.problems,
              cover: book.cover,
              pages: book.pageCount,
              imported: new Date(book.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            }}
            onClose={() => setEditingBook(false)}
            onSave={(next) => {
              // Only what changed: a colour alone isn't an edit to the name.
              const named = next.title !== book.title || next.author !== book.author
              const numbered = JSON.stringify(next.runs) !== JSON.stringify(pages.runs)
              update.mutate({
                ...(named && { title: next.title, author: next.author }),
                ...(numbered && { pageRuns: next.runs }),
                ...(next.problems && { problems: next.problems }),
                ...(next.cover !== book.cover && { cover: next.cover }),
              })
            }}
          />
        </BookHereContext>
      </BoxingProvider>
    </Pages>
  )
}
