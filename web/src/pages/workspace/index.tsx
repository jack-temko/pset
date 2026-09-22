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
  MathDisplay,
  MathInline,
  PageRef,
  Statement,
  Steps,
  UserTurn,
  WorkedSteps,
} from '@/components/transcript'
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav'
import { Veil } from '@/components/veil'
import { Label } from '@/components/label'
import { Menu, MenuCheckItem, MenuDivider, MenuItem } from '@/components/menu'
import { Skeleton } from '@/components/skeleton'
import { Spinner } from '@/components/spinner'
import { AddQuestionsDialog, BookDialog, HomeworkDialog } from './dialogs'
import {
  pageImageURL,
  useBook,
  useContents,
  useRemoveBook,
  useUpdateBook,
  type Book,
  type ContentsChapter,
} from '@/api/library'
import { ApiError } from '@/api/client'
import {
  figureURL,
  useAddQuestions,
  useBookHomework,
  useCreateHomework,
  useDeleteHomework,
  useHomeworkSet,
  useRemoveQuestion,
  useRetryQuestion,
  useUpdateHomework,
  useUpdateQuestion,
  worksheetURL,
  type Question,
  type Retry,
  type Summary,
} from '@/api/homework'
import { Prose, Segments } from '@/components/segments'
import { dueLine, dueStatus } from '@/lib/due'
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

/** The book's contents as a tree of quiet rows; the reader's position
 *  highlights the section it is inside. A book with no contents has no
 *  rail. Pages here are PDF pages, as the engine sends them; each shows
 *  its printed number, with the PDF page on hover. */
function Rail({
  toc,
  currentPage,
  onJump,
}: {
  toc: ContentsChapter[]
  currentPage: number
  onJump: (pdfPage: number) => void
}) {
  const offset = usePageOffset()
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
                <Tooltip label={`PDF page ${s.page}`} side="left">
                  <span className="shrink-0 font-mono text-xs tabular-nums">
                    {printedLabel(s.page, offset)}
                  </span>
                </Tooltip>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

/** The rail before the contents arrive: rows at their real height. */
function RailSkeleton() {
  return (
    <aside className="w-rail shrink-0 space-y-4 overflow-hidden border-r bg-rail py-4" aria-hidden>
      {[3, 4, 2].map((n, i) => (
        <div key={i}>
          <div className="px-4 py-1 text-sm">
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
 * The only chrome is the floating pill:
 * the printed page (the PDF page on hover) and the zoom, fading when idle.
 *
 * Pinch on a trackpad zooms around the pointer; past the pane's width a
 * click-drag pans, and only then is the cursor a hand. Clicking the
 * percentage snaps back to fit.
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
  const offset = usePageOffset()
  const [pillAwake, setPillAwake] = useState(false)
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
              className="relative grid place-items-center overflow-hidden rounded-sm border bg-card"
              style={{ aspectRatio: `1 / ${aspect || 11 / 8.5}` }}
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {printedLabel(n, offset)}
              </span>
              {width > 0 && (
                <img
                  src={pageImageURL(bookId, n, width)}
                  alt={`Page ${printedLabel(n, offset)}`}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 size-full"
                />
              )}
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
          has <MathInline tex="n^2+1" /> entries and must be dependent. Here is the book's
          statement of what that buys you:
        </p>
        <Statement
          kind="Theorem"
          number="5.22"
          name="existence, uniqueness, and degree of minimal polynomial"
          page={143}
          onJump={onJump}
        >
          <p>
            Suppose <MathInline tex="V" /> is finite-dimensional and{' '}
            <MathInline tex="T \in \mathcal{L}(V)" />. Then there is a unique monic polynomial{' '}
            <MathInline tex="p" /> of smallest degree such that <MathInline tex="p(T) = 0" />, and{' '}
            <MathInline tex="\deg p \le \dim V" />.
          </p>
        </Statement>
        <p>Uniqueness is the short part, worked through:</p>
        <WorkedSteps
          steps={[
            { math: 'p(T) = q(T) = 0', why: 'Suppose p and q are both monic of the smallest degree, m, and both work.' },
            { math: '(p - q)(T) = p(T) - q(T) = 0' },
            { math: '\\deg(p - q) < m', why: 'Both are monic of degree m, so the leading terms cancel.' },
            { math: 'p - q = 0', why: 'A nonzero one would be a smaller polynomial that works, after scaling to monic.' },
          ]}
        />
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
function FailedQuestion({ q, onRetry }: { q: Question; onRetry: (r: Retry) => void }) {
  const offset = usePageOffset()
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
        {q.reason}
      </p>

      {/* Only an in-book question has a page to find. */}
      {q.inBook && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (pageNumber > 0) onRetry({ page: pdfOf(pageNumber, offset) })
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

      <div className={cn('space-y-2', q.inBook && 'border-t pt-5')}>
        <p className="text-sm font-medium">{q.inBook ? 'Not in this book?' : 'Try again'}</p>
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
        <Button variant="outline" size="sm" disabled={!text.trim()} onClick={() => onRetry({ text: text.trim() })}>
          Use this text
        </Button>
      </div>
    </div>
  )
}

const STAGE_NAMES = ['hint', 'walkthrough'] as const

/** A stage still being written: skeleton lines at a stage's usual size,
 *  so the guide lands in space already made for it. A hint runs two
 *  lines, a walkthrough about five; the last stops short, as prose does. */
function StageSkeleton({ name }: { name: (typeof STAGE_NAMES)[number] }) {
  const lines = name === 'hint' ? 2 : 5
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase">{name}</p>
      <div className="space-y-1 text-base">
        {Array.from({ length: lines }, (_, j) => (
          <p key={j}>
            <Skeleton className={cn('h-3', j === lines - 1 ? 'w-2/3' : 'w-full')} />
          </p>
        ))}
      </div>
    </div>
  )
}

/** What the engine is doing to a question, while it does it. */
function workingLine(q: Question): string | null {
  if (q.state === 'pending' || q.state === 'locating') return q.inBook ? 'Finding it in the book…' : 'Writing the guide…'
  if (q.state === 'writing') return 'Writing the guide…'
  return null
}

/** One question at a time. Both stages sit veiled below the statement:
 *  the walkthrough carries the solution, and Complete is a checkbox that
 *  does exactly one thing. Spec: design/workspace.md. */
function Walkthrough({
  setId,
  onEdit,
  onBack,
  onJump,
  onAskAbout,
}: {
  setId: string
  onEdit: () => void
  onBack: () => void
  onJump: (page: number) => void
  onAskAbout: (label: string) => void
}) {
  const pageOffset = usePageOffset()
  const detail = useHomeworkSet(setId)
  const updateSet = useUpdateHomework(setId)
  const update = useUpdateQuestion(setId)
  const removeQ = useRemoveQuestion(setId)
  const retryQ = useRetryQuestion()
  const addQ = useAddQuestions(setId)
  const [adding, setAdding] = useState(false)
  const [index, setIndex] = useState<number | null>(null)

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
  const at = Math.min(index ?? 0, Math.max(questions.length - 1, 0))
  const q = questions[at] as Question | undefined
  const turnedIn = !!set?.turnedInAt

  const dialog = (
    <AddQuestionsDialog
      open={adding}
      onClose={() => setAdding(false)}
      onAdd={(drafts) => {
        const first = questions.length
        addQ.mutate(drafts, { onSuccess: () => setIndex(first) })
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
        <MenuItem icon={<Pencil />} onSelect={onEdit}>
          Edit homework
        </MenuItem>
        {/* A worksheet: statements and figures with room to work, nothing
            revealed. It opens in a new tab, to print or save from there. */}
        <MenuItem icon={<Printer />} onSelect={() => window.open(worksheetURL(setId), '_blank')}>
          Print worksheet
        </MenuItem>
        <MenuDivider />
        {/* An act until it's done, then a fact: "Turn in", then
            "Turned in" with its check. Choosing it again takes it back. */}
        <MenuCheckItem checked={turnedIn} onChange={() => updateSet.mutate({ turnedIn: !turnedIn })}>
          {turnedIn ? 'Turned in' : 'Turn in'}
        </MenuCheckItem>
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
  const working = workingLine(q)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-card">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-lg font-semibold">{q.label}</span>
          {/* A question that isn't in this book has nothing to jump to. */}
          {q.page !== undefined && <PageRef page={q.page - pageOffset} onJump={onJump} />}
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
            variant="ghost"
            size="sm"
            aria-label="Remove this question"
            onClick={() => {
              removeQ.mutate(q.id)
              setIndex(Math.max(0, Math.min(at, questions.length - 2)))
            }}
          >
            <Trash2 />
          </IconButton>
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
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </p>
          )
        )}
        {q.figures.map((f, i) => (
          <figure key={i} className="space-y-1">
            <img src={figureURL(q.id, i)} alt={f.label || 'Figure'} className="w-full rounded-md border bg-card" />
            {f.label && <figcaption className="text-xs text-muted-foreground">{f.label}</figcaption>}
          </figure>
        ))}

        {q.state === 'failed' ? (
          <FailedQuestion key={q.id} q={q} onRetry={(retry) => retryQ.mutate({ id: q.id, retry })} />
        ) : (
          <>
            {working && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                {working}
              </p>
            )}
            {STAGE_NAMES.map((name) => {
              const segs = name === 'hint' ? q.hint : q.walkthrough
              // Each stage fills in as it's written: the hint can be
              // there while the walkthrough is still a skeleton.
              if (segs.length === 0) return <StageSkeleton key={name} name={name} />
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
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t p-card">
        <Button variant="ghost" size="sm" onClick={() => onAskAbout(q.label)}>
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
  onAskAbout: (label: string) => void
}) {
  const list = useBookHomework(bookId)
  const create = useCreateHomework(bookId)
  const remove = useDeleteHomework()
  const [openId, setOpenId] = useState<string | null>(initialSet ?? null)
  const [creating, setCreating] = useState(false)
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
          onBack={() => setOpenId(null)}
          onJump={onJump}
          onAskAbout={onAskAbout}
        />
        {openSet && (
          <HomeworkDialog
            open={editing}
            editing={{ title: openSet.title, due: openSet.dueDate, questions: openSet.total }}
            onClose={() => setEditing(false)}
            onSave={(title, due) => updateOpen.mutate({ title, dueDate: due })}
            onDelete={() => remove.mutate(openSet, { onSuccess: () => setOpenId(null) })}
          />
        )}
      </>
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-card">
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
          onClick={() => setCreating(true)}
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

      {/* A new set is a container and nothing else: it exists the moment
          you name it, and you land in its empty walkthrough to fill it. */}
      <HomeworkDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSave={(title, due) => create.mutate({ title, dueDate: due }, { onSuccess: (h) => setOpenId(h.id) })}
      />
    </div>
  )
}

function Panel({
  bookId,
  homework,
  focus,
  onFocusToggle,
  onJump,
}: {
  bookId: string
  /** A homework set named in the URL opens the Homework tab on it. */
  homework?: string
  focus: boolean
  onFocusToggle: () => void
  onJump: (page: number) => void
}) {
  const [tab, setTab] = useState<Tab>(() => (homework ? 'homework' : readTab(bookId)))
  const [about, setAbout] = useState<string | null>(null)
  const pick = (t: Tab) => {
    setTab(t)
    writeTab(bookId, t)
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
          bookId={bookId}
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

  const [focus, setFocus] = useState(false)
  // A PDF index: the scan is the one place that counts in those.
  const [currentPage, setCurrentPage] = useState(1)
  const [editingBook, setEditingBook] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())

  const offset = book.pageOffset
  const jumpPdf = (pdf: number) => pageRefs.current.get(pdf)?.scrollIntoView()
  // Everything outside the scan and the rail speaks printed pages; the
  // scan is indexed by PDF page, so a jump converts once, here.
  const jump = (printed: number) => jumpPdf(pdfOf(printed, offset))
  const chapters = contents.data?.chapters
  const homeworkCount = useBookHomework(book.id).data?.length ?? 0

  return (
    <PageOffset value={offset}>
      <AppShell
        scroll="fill"
        middle={
          // The top bar's one action: editing the thing it names.
          <span className="flex items-center gap-3">
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
          {!focus &&
            (chapters === undefined ? (
              <RailSkeleton />
            ) : (
              chapters.length > 0 && <Rail toc={chapters} currentPage={currentPage} onJump={jumpPdf} />
            ))}
          <Scan
            bookId={book.id}
            aspect={book.aspect}
            pageCount={book.pageCount}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            scrollRef={scrollRef}
            pageRefs={pageRefs}
          />
          <Panel
            bookId={book.id}
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
          pages: book.pageCount,
          imported: new Date(book.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          homework: homeworkCount,
        }}
        onClose={() => setEditingBook(false)}
        onSave={(next) => update.mutate({ title: next.title, author: next.author, pageOffset: next.offset })}
        onRemove={() => remove.mutate(book.id, { onSuccess: () => navigate('/') })}
      />
    </PageOffset>
  )
}
