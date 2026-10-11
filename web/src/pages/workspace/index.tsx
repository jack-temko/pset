import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowUp,
  Brain,
  ChevronRight,
  Columns2,
  Pencil,
  Receipt,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react';

import { AppShell } from '@/components/shell';
import { AutoTextarea } from '@/components/input';
import { Button, IconButton } from '@/components/button';
import { Tooltip } from '@/components/tooltip';
import {
  AboutChip,
  AssistantTurn,
  ConversationStart,
  DayDivider,
  FailedTurn,
  StoppedNote,
  Steps,
  Thinking,
  UserTurn,
} from '@/components/transcript';
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav';
import {
  Menu,
  MenuConfirmItem,
  MenuDivider,
  MenuItem,
} from '@/components/menu';
import { ResizeHandle } from '@/components/resize-handle';
import { Loaded } from '@/components/loaded';
import { Skeleton } from '@/components/skeleton';
import { UsageTrigger } from '@/components/usage';
import { BookUsageDialog } from '@/components/usage-modal';
import { usePrefetchIntent } from '@/lib/prefetch-intent';
import { prefetchBookUsage, useBookUsage } from '@/api/usage';
import { BookDialog } from './dialogs';
import { HomeworkTab, ListSkeleton } from '@/views/homework';
import { isListShape, type ListShape } from '@/views/homework/list-shape';
import { MemoryDialog, MemoryUndo } from './memory';
import { BoxingBar, BoxingProvider, PageBoxes } from './boxing';
import { useBoxing } from './boxing-state';
import { BookHereContext } from './book-here';
import {
  pageImageURL,
  useBook,
  useContents,
  useRemoveBook,
  useUpdateBook,
  type Book,
  type ContentsEntry,
} from '@/api/library';
import { ApiError } from '@/api/client';
import {
  useBookHomework,
  useAddBoxed,
  usePointOut,
  useAssignmentReads,
  useAssignmentSource,
  useHomeworkSet,
} from '@/api/homework';
import { useMemories } from '@/api/memory';
import { BlockSkeleton, Document } from '@/components/document';
import {
  answerAbout,
  asked,
  heldSel,
  NOTHING_PENDING,
  pendingOf,
  picked,
  sent,
  turnSource,
  type Pending,
  type PendingSel,
} from '@/components/document/selection';
import { useStudyTime, type Kind as ActivityKind } from '@/api/activity';
import { LiveStudyTimer } from './study-timer';
import {
  useAsk,
  useClearTurns,
  useStopTurn,
  useTurns,
  type About,
  type LiveTurn,
} from '@/api/ask';
import { PageMap, Pages, usePages } from '@/lib/pages';
import { layout, usePanes } from '@/lib/panes';
import { useLastCount, useLastShape } from '@/lib/last-count';
import type { Variant } from '@/variants';
import { cn, plural } from '@/lib/utils';

/**
 * The book workspace: the app's one filled screen. Contents rail, page
 * scan, Ask | Homework panel: each pane scrolls itself, the frame never
 * moves. Focus collapses the rail and hands its width to the panel.
 *
 * Spec: design/workspace.md.
 */

type Tab = 'ask' | 'homework';

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
  width,
}: {
  toc: ContentsEntry[];
  /** Pixels, from the pane layout; the token until it's measured. */
  width?: number;
  /** The page the rail highlights: the reader's page, or a jump's
   *  destination until the next scroll moves the page. */
  page: number;
  onJump: (pdfPage: number) => void;
}) {
  const pages = usePages();
  const rail = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const shows = (depth: number, parent?: ContentsEntry) =>
    depth < RAIL_LEVELS || (parent !== undefined && open.has(parent.id));
  const toggle = (id: string) => {
    setOpen((o) => {
      const next = new Set(o);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  // The current row is the last one on show, in reading order, that
  // starts at or before the page the scan is showing: a closed section
  // stands in for the rows folded inside it.
  const currentId = (() => {
    let id: string | undefined;
    const walk = (entries: ContentsEntry[], depth: number) => {
      for (const e of entries) {
        if (e.page <= page) id = e.id;
        if (e.children.length > 0 && shows(depth + 1, e))
          walk(e.children, depth + 1);
      }
    };
    walk(toc, 0);
    return id;
  })();

  // Keep the current row in view, with a row of room around it. Only the
  // rail scrolls: scrollIntoView would move the whole workspace too.
  useEffect(() => {
    const el = rail.current;
    const row = el?.querySelector<HTMLElement>('[aria-current]');
    if (!el || !row) return;
    const room = row.offsetHeight;
    const r = row.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (r.top < box.top + room) el.scrollTop -= box.top + room - r.top;
    else if (r.bottom > box.bottom - room)
      el.scrollTop += r.bottom - (box.bottom - room);
  }, [currentId]);

  const pageLabel = (pdfPage: number) => (
    <Tooltip label={`PDF page ${pdfPage}`} side="left">
      <span className="shrink-0 text-xs tabular-nums">
        {pages.label(pdfPage)}
      </span>
    </Tooltip>
  );

  const row = (e: ContentsEntry, depth: number): ReactNode => {
    const current = e.id === currentId;
    // Below the top level, a row with rows under it folds them away. The
    // chevron sits in the row's indent, so titles stay aligned either way.
    const folds = depth >= RAIL_LEVELS - 1 && e.children.length > 0;
    const isOpen = open.has(e.id);
    return (
      <div key={e.id}>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              onJump(e.page);
            }}
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
              onClick={() => {
                toggle(e.id);
              }}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Hide' : 'Show'} what's in ${e.title}`}
              className={cn(
                'absolute top-0 bottom-0 flex w-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground',
                RAIL_CHEVRON[Math.min(depth, RAIL_CHEVRON.length - 1)],
              )}
            >
              <ChevronRight
                className={cn(
                  'size-4 transition-transform duration-200 motion-reduce:transition-none',
                  isOpen && 'rotate-90',
                )}
              />
            </button>
          )}
        </div>
        {e.children.length > 0 &&
          shows(depth + 1, e) &&
          e.children.map((c) => row(c, depth + 1))}
      </div>
    );
  };

  return (
    <aside
      ref={rail}
      style={{ width }}
      className="w-rail shrink-0 overflow-y-auto border-r bg-rail py-4"
    >
      <nav aria-label="Contents">{toc.map((e) => row(e, 0))}</nav>
    </aside>
  );
}

/** How many levels of the contents show before any are opened. */
const RAIL_LEVELS = 2;
/** Each level's indent, 16px a step after the top's; deeper than the
 *  last holds there, so a very deep book doesn't walk off the rail. */
const RAIL_INDENT = ['pl-4', 'pl-8', 'pl-12', 'pl-16', 'pl-20'];
/** The chevron sits in the 24px just before its row's title. */
const RAIL_CHEVRON = ['left-0', 'left-2', 'left-6', 'left-10', 'left-14'];

/** What the rail looked like last time, per book: how many rows sit under each
 *  top-level row. Empty is a book with no contents, which has no rail. */
type RailShape = number[];
const RAIL_SHAPE: RailShape = [3, 4, 2];
const isRailShape = (x: unknown): x is RailShape =>
  Array.isArray(x) &&
  x.length <= RAIL_SKELETON_ROWS &&
  x.every((n) => Number.isInteger(n) && n >= 0 && n <= RAIL_SKELETON_ROWS);
const RAIL_SKELETON_ROWS = 12;

/** The rail before the contents arrive: rows at their real height, shaped
 *  like the contents it showed last time for this book. */
function RailSkeleton({ width, shape }: { width?: number; shape: RailShape }) {
  return (
    <aside
      style={{ width }}
      className="w-rail shrink-0 overflow-hidden border-r bg-rail py-4"
      aria-hidden
    >
      {shape.map((n, i) => (
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
  );
}

// ---------------------------------------------------------------- scan

/** Zoom is relative to fitting the pane's width: 1 is fit, and the
 *  percentage in the pill says so. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

/** One page of the scan: a box at the page's own proportions, with its
 *  printed number, and, once it is near the viewport, its image and the layer
 *  for boxing a problem. The first screen's worth are near from the start. */
const PageSlot = memo(function PageSlot({
  n,
  label,
  aspect,
  bookId,
  width,
  pageRefs,
  watch,
}: {
  n: number;
  label: string;
  aspect: number;
  bookId: string;
  width: number;
  pageRefs: React.RefObject<Map<number, HTMLDivElement>>;
  watch: (el: Element, cb: (near: boolean) => void) => () => void;
}) {
  const [near, setNear] = useState(n <= 3);
  const el = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const refs = pageRefs.current;
    refs.set(n, node);
    const stop = watch(node, setNear);
    return () => {
      refs.delete(n);
      stop();
    };
  }, [n, pageRefs, watch]);
  return (
    <div
      ref={el}
      className="relative grid place-items-center overflow-hidden rounded-sm border bg-card"
      style={{ aspectRatio: `1 / ${aspect}` }}
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        {label}
      </span>
      {near && width > 0 && (
        <img
          src={pageImageURL(bookId, n, width)}
          alt={`Page ${label}`}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full"
        />
      )}
      {near && <PageBoxes page={n} />}
    </div>
  );
});

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
  bookId: string;
  /** Page height over width. */
  aspect: number;
  pageCount: number;
  /** A PDF index: the scan is the one place that counts in those. */
  currentPage: number;
  onPageChange: (p: number) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  pageRefs: React.RefObject<Map<number, HTMLDivElement>>;
}) {
  const pages = usePages();
  // Boxing a problem takes the pointer: a drag draws, and doesn't pan.
  const boxing = useBoxing();
  const boxingOn = boxing.target !== null;
  // Awake on arrival, asleep shortly after; scroll, hover or focus wake
  // it again.
  const [pillAwake, setPillAwake] = useState(true);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [zoom, setZoom] = useState(1);
  const [paneWidth, setPaneWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  // The spot on the page under the pointer, as a fraction of that page, and
  // where the pointer was. After the new size is laid out, the scroll is
  // corrected until that same spot is back under the pointer.
  const anchor = useRef<{
    node: HTMLDivElement;
    fx: number;
    fy: number;
    x: number;
    y: number;
  } | null>(null);

  // A pointer resting on the bar isn't idle: it stays until the pointer
  // leaves, so its button never fades out from under the cursor.
  const hovered = useRef(false);
  const wake = () => {
    setPillAwake(true);
    clearTimeout(sleepTimer.current);
    sleepTimer.current = setTimeout(() => {
      if (!hovered.current) setPillAwake(false);
    }, 1200);
  };
  // The first sleep: the pill says where you are on arrival, then lets
  // the paper have the frame back.
  useEffect(() => {
    sleepTimer.current = setTimeout(() => {
      setPillAwake(false);
    }, 1200);
    return () => {
      clearTimeout(sleepTimer.current);
    };
  }, []);

  // The fit width follows the pane, which Focus mode resizes.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Measured before the first paint: the pages' column is its fit width in
    // the first frame, not the pane's full width until the observer reports.
    setPaneWidth(el.clientWidth);
    const ro = new ResizeObserver(() => {
      setPaneWidth(el.clientWidth);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [scrollRef]);

  // A trackpad pinch arrives as a ctrl+wheel. It has to be a non-passive
  // listener to stop the browser zooming the whole app instead.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // The map is made once and only ever added to, so this is the live one.
    const pages = pageRefs.current;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      wake();
      // Measured once per burst: the first event of a pinch fixes the spot,
      // and every later event in the same frame zooms around it.
      if (!anchor.current) {
        let best: HTMLDivElement | null = null;
        let bestDist = Infinity;
        for (const node of pages.values()) {
          const r = node.getBoundingClientRect();
          const d =
            e.clientY < r.top
              ? r.top - e.clientY
              : e.clientY > r.bottom
                ? e.clientY - r.bottom
                : 0;
          if (d < bestDist) {
            bestDist = d;
            best = node;
          }
          if (d === 0) break;
        }
        if (best) {
          const r = best.getBoundingClientRect();
          anchor.current = {
            node: best,
            fx: (e.clientX - r.left) / r.width,
            fy: (e.clientY - r.top) / r.height,
            x: e.clientX,
            y: e.clientY,
          };
        }
      }
      setZoom((z) =>
        Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * Math.exp(-e.deltaY * 0.01))),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [scrollRef, pageRefs]);

  // After layout, before paint: find where the anchored spot ended up and
  // scroll by exactly the difference, so it sits under the pointer again.
  // Measuring the page itself, rather than scaling the scroll, stays exact
  // even though the gaps between pages don't scale and the column recentres.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const a = anchor.current;
    if (!el || !a) return;
    const r = a.node.getBoundingClientRect();
    el.scrollLeft += r.left + a.fx * r.width - a.x;
    el.scrollTop += r.top + a.fy * r.height - a.y;
    anchor.current = null;
  }, [zoom, scrollRef]);

  const fitWidth = Math.min(768, Math.max(paneWidth - 48, 0));
  const width = fitWidth * zoom;
  const percent = Math.round(zoom * 100);
  const zoomed = percent !== 100;
  // Panning only means something once the pages are wider than the pane.
  const canPan = width + 48 > paneWidth + 1 && !boxingOn;

  const onScroll = () => {
    wake();
    const el = scrollRef.current;
    if (!el) return;
    // The current page is the one crossing the pane's vertical middle.
    const middle = el.scrollTop + el.clientHeight / 2;
    let page = 1;
    for (const [n, node] of pageRefs.current) {
      if (node.offsetTop <= middle) page = Math.max(page, n);
    }
    if (page !== currentPage) onPageChange(page);
  };

  // Which pages are near the viewport (a screen or two each way), told to the
  // slots by one observer on the scroller. The rest are empty boxes of the
  // right size: a long book is hundreds of pages, and mounting an image and a
  // box layer for each made the first render a long task.
  const observer = useRef<IntersectionObserver | null>(null);
  const waiting = useRef<[Element, (near: boolean) => void][]>([]);
  const callbacks = useRef(new Map<Element, (near: boolean) => void>());
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          callbacks.current.get(e.target)?.(e.isIntersecting);
      },
      { root: scrollRef.current, rootMargin: '1500px 0px' },
    );
    observer.current = io;
    for (const [el, cb] of waiting.current) {
      callbacks.current.set(el, cb);
      io.observe(el);
    }
    waiting.current = [];
    return () => {
      io.disconnect();
      observer.current = null;
    };
  }, [scrollRef]);
  const watch = useCallback((el: Element, cb: (near: boolean) => void) => {
    if (observer.current) {
      callbacks.current.set(el, cb);
      observer.current.observe(el);
    } else {
      waiting.current.push([el, cb]);
    }
    return () => {
      callbacks.current.delete(el);
      observer.current?.unobserve(el);
    };
  }, []);

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onPointerDown={(e) => {
          if (!canPan || e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY };
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const el = e.currentTarget;
          el.scrollLeft -= e.clientX - drag.current.x;
          el.scrollTop -= e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
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
            <PageSlot
              key={n}
              n={n}
              label={pages.label(n)}
              aspect={aspect || 11 / 8.5}
              bookId={bookId}
              width={width}
              pageRefs={pageRefs}
              watch={watch}
            />
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
          hovered.current = true;
          wake();
        }}
        onMouseLeave={() => {
          hovered.current = false;
          wake();
        }}
        className={cn(
          'absolute bottom-6 left-1/2 flex h-control -translate-x-1/2 items-center gap-1 rounded-md border bg-card px-1 text-xs text-muted-foreground shadow-floating transition-opacity duration-200 ease-out focus-within:opacity-100 motion-reduce:transition-none',
          pillAwake ? 'opacity-100' : 'opacity-0',
        )}
      >
        <Tooltip label={`PDF page ${currentPage} of ${pageCount}`}>
          <span
            tabIndex={0}
            className="flex h-control-sm items-center rounded-md px-2 tabular-nums"
          >
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
                setZoom(1);
                wake();
              }}
              className="tabular-nums"
            >
              {percent}%
              <RotateCcw />
            </Button>
          </Tooltip>
        ) : (
          <span className="flex h-control-sm items-center px-2 tabular-nums">
            {percent}%
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- panel

/** A day as a divider says it: "Today", "Yesterday", "Sep 12". */
function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
 * Skeletons belong to blocks, where the type arrives before the block.
 */
function TurnView({
  t,
  onJump,
  onRetry,
  selection,
  onPickSelection,
  onSelect,
  onClearAbout,
}: {
  t: LiveTurn;
  onJump: (page: number) => void;
  onRetry: () => void;
  /** The pending selection, for the outline while its chip rides the
   *  composer. */
  selection: PendingSel | null;
  onPickSelection: (selection: PendingSel) => void;
  onSelect: (about: About, selection: PendingSel) => void;
  onClearAbout: () => void;
}) {
  const navigate = useNavigate();
  const pages = usePages();
  const source = turnSource(t.id);
  const running = t.state === 'running';
  const last = t.steps.at(-1);
  const lastRunning = !!last?.running;
  // Waiting on the model with nothing saying so: no call running, no block
  // on its way, and no words since the last step (streaming words say it
  // themselves).
  const endsInStep = t.steps.some(
    (s) => Math.min(s.after, t.answer.length) === t.answer.length,
  );
  const thinking =
    running &&
    !lastRunning &&
    !t.pending &&
    (t.answer.length === 0 || endsInStep);
  const hasReply =
    t.steps.length > 0 || t.answer.length > 0 || !!t.pending || thinking;
  // Each step sits after the blocks written when it ran. Turns saved
  // before steps carried a position have none, and land at the top, as
  // they always did.
  const feed = (i: number) => {
    const at = t.steps.filter((s) => Math.min(s.after, t.answer.length) === i);
    if (at.length === 0) return null;
    return (
      <Steps
        steps={at.map((s) =>
          s.memoryId
            ? {
                label: s.label,
                action: <MemoryUndo bookId={t.bookId} memoryId={s.memoryId} />,
              }
            : s.label,
        )}
        running={running && lastRunning && at.includes(last)}
        thinking={thinking && i === t.answer.length}
      />
    );
  };
  return (
    <>
      <UserTurn about={t.about || undefined}>{t.question}</UserTurn>
      {hasReply && (
        <AssistantTurn>
          {/* The step feed sits where the calls ran: before the block
              written when each one began. A finished block is
              selectable, to ask a follow-up about exactly it. */}
          <Document
            blocks={t.answer}
            onJump={onJump}
            before={feed}
            ask={{
              selected: heldSel(selection, source, t.answer, pages),
              onPick: (sel) => {
                onPickSelection(pendingOf(source, t.answer, sel, pages));
              },
              onAsk: (sel) => {
                onSelect(
                  answerAbout({
                    question: t.question,
                    about: t.about || undefined,
                    blocks: t.answer,
                    sel,
                    pages,
                  }),
                  pendingOf(source, t.answer, sel, pages),
                );
              },
              onClear: onClearAbout,
            }}
          />
          {/* What answering spent, once the turn is over; while it runs
              the step feed is already saying how it's going. */}
          {t.state !== 'running' && t.usage && (
            <UsageTrigger
              usage={t.usage}
              source={{ kind: 'turn', id: t.id }}
              name="Ask answer"
              block
            />
          )}
          {thinking && t.steps.length === 0 && <Thinking />}
          {t.pending && (
            <BlockSkeleton
              type={t.pending.type}
              runs={t.pending.runs}
              repairing={t.pending.repairing}
              onJump={onJump}
            />
          )}
        </AssistantTurn>
      )}
      {t.state === 'stopped' && <StoppedNote />}
      {t.state === 'failed' && (
        <FailedTurn
          reason={t.reason ?? ''}
          onRetry={onRetry}
          onSetup={
            t.failure === 'setup'
              ? () => {
                  void navigate('/settings#connections');
                }
              : undefined
          }
        />
      )}
      {/* A turn that ended before it wrote a thing (the first call refused, a
          stop at once) has no reply to end with the line, and its calls still
          cost time: it follows the note instead. */}
      {!hasReply && t.state !== 'running' && t.usage && (
        <UsageTrigger
          usage={t.usage}
          source={{ kind: 'turn', id: t.id }}
          name="Ask answer"
          block
        />
      )}
    </>
  );
}

const ASK_ABOUT =
  'It searches and reads the book, looks at figures, and checks its arithmetic, then answers with the pages it used.';

/** Puts a scroller at its end as this mounts. */
function PinToBottom({
  scroller,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
}) {
  useLayoutEffect(() => {
    const el = scroller.current;
    el?.scrollTo({ top: el.scrollHeight });
  }, [scroller]);
  return null;
}

/** Ask: the transcript over the composer. An empty conversation is a
 *  prompt line and one sentence of capability: no generated suggestions. */
function AskTab({
  bookId,
  bookTitle,
  about,
  visible,
  onClearAbout,
  onSent,
  onJump,
  selection,
  onPickSelection,
  onSelect,
}: {
  bookId: string;
  bookTitle: string;
  /** The context chip riding the composer: a question's "Ask about
   *  this", or a selection from a guide or an earlier answer. */
  about: About | null;
  /** Whether its tab is the one showing: it stays mounted behind Homework. */
  visible: boolean;
  onClearAbout: () => void;
  /** A turn went out carrying this chip (or none): the chip is spent. */
  onSent: (about: About | null) => void;
  onJump: (page: number) => void;
  selection: PendingSel | null;
  onPickSelection: (selection: PendingSel) => void;
  onSelect: (about: About, selection: PendingSel) => void;
}) {
  const turns = useTurns(bookId);
  const ask = useAsk(bookId);
  const stop = useStopTurn();
  const clear = useClearTurns(bookId);
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(true);
  const composer = useRef<HTMLDivElement | null>(null);
  // Empty or a conversation, as it was last time here, for the skeleton.
  const askShape = useLastShape<Variant<'ask'> | null>(
    `ask-${bookId}`,
    turns.data && (turns.data.length === 0 ? 'empty' : 'turns'),
    null,
    (x): x is Variant<'ask'> | null => x === 'empty' || x === 'turns',
  );
  const list = turns.data;
  const running = list?.find((t) => t.state === 'running');

  // The chip arrives with the box empty, so the box takes the focus:
  // the next words typed are your own question.
  useEffect(() => {
    if (about) composer.current?.querySelector('textarea')?.focus();
  }, [about]);

  // Follow the answer as it streams, unless you've scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [list, visible]);

  // `own` is the composer's own words going out; a retry of an earlier
  // question is not, and leaves the draft and the chip alone. Only the
  // chip that went out is spent, and only the words that went out are
  // cleared: what was staged or typed while it was in flight stays.
  const send = (question: string, withAbout: About | null, own = false) => {
    if (!question.trim() || running || ask.isPending) return;
    pinned.current = true;
    ask.mutate(
      { question, about: withAbout ?? undefined },
      {
        onSuccess: () => {
          if (own) setText((now) => (now === question ? '' : now));
          onSent(withAbout);
        },
      },
    );
  };

  return (
    <>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="min-h-0 flex-1 overflow-y-auto p-card"
      >
        <Loaded
          query={turns}
          fill
          className="h-full"
          variant={askShape ?? undefined}
          view="ask"
          variantOf={(list: unknown[]): Variant<'ask'> =>
            list.length === 0 ? 'empty' : 'turns'
          }
          neutral={<div className="h-full" />}
          skeletons={{
            // The prompt is static: the same words, there from the first frame.
            empty: (
              <div className="flex h-full flex-col justify-end gap-1 pb-2">
                <p className="font-heading text-lg">
                  Ask anything about {bookTitle}.
                </p>
                <p className="text-sm text-muted-foreground">{ASK_ABOUT}</p>
              </div>
            ),
            // The conversation sits at the bottom, over the composer, like
            // the prompt does when it is empty.
            turns: (
              <div className="flex h-full flex-col justify-end space-y-5">
                <div className="ml-auto w-2/3 space-y-1 rounded-md bg-primary-soft p-3">
                  <Skeleton className="h-3 w-full" />
                </div>
                <p className="space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </p>
              </div>
            ),
          }}
        >
          {(list) => (
            <>
              {/* The transcript is drawn when the data is revealed, not when
                  it lands: the pin to the bottom happens as it mounts. */}
              <PinToBottom scroller={scroller} />
              {list.length === 0 ? (
                <div className="flex h-full flex-col justify-end gap-1 pb-2">
                  <p className="font-heading text-lg">
                    Ask anything about {bookTitle}.
                  </p>
                  <p className="text-sm text-muted-foreground">{ASK_ABOUT}</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <ConversationStart
                    onClear={() => {
                      clear.mutate();
                    }}
                  />
                  {list.map((t, i) => {
                    const day = dayLabel(t.createdAt);
                    const newDay =
                      i === 0 || dayLabel(list[i - 1].createdAt) !== day;
                    return (
                      <div key={t.id} className="space-y-5">
                        {newDay && <DayDivider label={day} />}
                        <TurnView
                          t={t}
                          onJump={onJump}
                          onRetry={() => {
                            send(t.question, null);
                          }}
                          selection={selection}
                          onPickSelection={onPickSelection}
                          onSelect={onSelect}
                          onClearAbout={onClearAbout}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Loaded>
      </div>
      <div ref={composer} className="shrink-0 border-t p-card">
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
              onRetry={() => {
                send(text, about, true);
              }}
              onSetup={
                ask.error instanceof ApiError &&
                ask.error.code === 'not_configured'
                  ? () => {
                      void navigate('/settings#connections');
                    }
                  : undefined
              }
            />
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (running) stop.mutate(running.id);
            else send(text, about, true);
          }}
        >
          <AutoTextarea
            rows={1}
            data-esc-lets-go
            value={text}
            placeholder="Ask about this book…"
            onChange={(e) => {
              setText(e.target.value);
              if (ask.isError) ask.reset();
            }}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter is a new line.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(text, about, true);
              }
            }}
            className="flex-1"
          />
          {running ? (
            <IconButton type="submit" variant="outline" aria-label="Stop">
              <Square />
            </IconButton>
          ) : (
            <IconButton
              type="submit"
              variant="primary"
              aria-label="Send"
              disabled={!text.trim() || ask.isPending}
            >
              <ArrowUp />
            </IconButton>
          )}
        </form>
      </div>
    </>
  );
}

function Panel({
  bookId,
  bookTitle,
  onActive,
  onQuestion,
  homework,
  focus,
  onFocusToggle,
  onJump,
  width,
}: {
  bookId: string;
  bookTitle: string;
  /** Where the student last worked, for the week's time. */
  onActive: (kind: ActivityKind) => void;
  /** The homework question on screen, or null, for counting its time. */
  onQuestion: (id: string | null) => void;
  /** A homework set named in the URL opens the Homework tab on it. */
  homework?: string;
  focus: boolean;
  onFocusToggle: () => void;
  onJump: (page: number) => void;
  /** Pixels, from the pane layout; the token until it's measured. */
  width?: number;
}) {
  const navigate = useNavigate();
  // A book always opens on Homework, at the list (or on the set the URL
  // names). Both tabs stay mounted, so Ask about a question and Homework
  // again is the same question, scrolled where it was; a reload is a new visit.
  const [tab, setTab] = useState<Tab>('homework');
  // The context chip riding the composer, and the selection it came
  // from (a guide element or an answer element): one chip at a time,
  // and the two live and go together, so the outline on the document
  // and the chip above the composer are one state. The selection is
  // held here, above the tabs, because a page shows two documents (a
  // hint and a walkthrough) and at most one element outlines at a time.
  const [pending, setPending] = useState<Pending>(NOTHING_PENDING);
  const { about, sel: selection } = pending;
  const pickSelection = (next: PendingSel) => {
    setPending((p) => picked(p, next));
  };
  const askAbout = (a: About, sel: PendingSel | null) => {
    setPending(asked(a, sel));
  };
  const clearAbout = () => {
    setPending(NOTHING_PENDING);
  };
  const spendAbout = (spent: About | null) => {
    setPending((p) => sent(p, spent));
  };
  const pick = setTab;

  return (
    <aside
      onPointerDownCapture={() => {
        onActive(tab === 'ask' ? 'asking' : 'homework');
      }}
      onKeyDownCapture={() => {
        onActive(tab === 'ask' ? 'asking' : 'homework');
      }}
      style={{ width }}
      className={cn(
        'flex shrink-0 flex-col border-l bg-rail',
        focus ? 'w-panel-wide' : 'w-panel',
      )}
    >
      <div className="flex h-row shrink-0 items-center justify-between border-b px-card">
        <UnderlineNav className="-mb-px h-full">
          <UnderlineTab
            active={tab === 'ask'}
            onClick={() => {
              pick('ask');
            }}
          >
            Ask
          </UnderlineTab>
          <UnderlineTab
            active={tab === 'homework'}
            onClick={() => {
              pick('homework');
            }}
          >
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
          <Columns2 />
        </IconButton>
      </div>
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          tab !== 'ask' && 'hidden',
        )}
      >
        <AskTab
          bookId={bookId}
          bookTitle={bookTitle}
          about={about}
          visible={tab === 'ask'}
          onClearAbout={clearAbout}
          onSent={spendAbout}
          onJump={onJump}
          selection={selection}
          onPickSelection={pickSelection}
          onSelect={askAbout}
        />
      </div>
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          tab !== 'homework' && 'hidden',
        )}
      >
        <HomeworkTab
          bookId={bookId}
          initialSet={homework}
          onJump={onJump}
          onAskAbout={(a, sel) => {
            askAbout(a, sel ?? null);
            pick('ask');
          }}
          onPickSelection={pickSelection}
          onClearAbout={clearAbout}
          selection={selection}
          onOpenSettings={() => {
            void navigate('/settings#connections');
          }}
          onQuestion={onQuestion}
          wide={focus}
        />
      </div>
    </aside>
  );
}

// ------------------------------------------------------------ workspace

/** A sentence in the workspace frame, in place of a book. */
function WorkspaceMessage({ children }: { children?: ReactNode }) {
  return (
    <AppShell scroll="fill">
      <div className="grid h-full place-items-center bg-muted/40">
        {children && (
          <p className="text-base text-muted-foreground">{children}</p>
        )}
      </div>
    </AppShell>
  );
}

/** The book's frame before the book arrives, in its real layout: the top bar,
 *  the rail (as this book had one last time), the pages' ground and the panel
 *  with its tabs. The pane widths are the saved ones, so nothing moves when
 *  the book lands. */
function WorkspaceSkeleton({
  id,
  frame,
  total,
  ratios,
}: {
  id: string;
  frame: Panes['frame'];
  total: number;
  ratios: Panes['ratios'];
}) {
  const rail = useLastShape(railKey(id), undefined, RAIL_SHAPE, isRailShape);
  const list = useLastShape<ListShape | null>(
    `homework-list-${id}`,
    undefined,
    null,
    isListShape,
  );
  const showRail = rail.length > 0;
  const widths = total > 0 ? layout(total, ratios, false, showRail) : undefined;
  return (
    <AppShell scroll="fill" middle={<Skeleton className="h-3 w-48" />}>
      <div className="flex h-full min-h-0 flex-col">
        <div ref={frame} className="flex min-h-0 flex-1" aria-busy>
          {showRail && <RailSkeleton width={widths?.rail} shape={rail} />}
          <div className="relative min-w-0 flex-1 bg-muted/40" />
          <aside
            style={{ width: widths?.panel }}
            className="flex w-panel shrink-0 flex-col border-l bg-rail"
            aria-hidden
          >
            <div className="flex h-row shrink-0 items-center justify-between border-b px-card">
              <UnderlineNav className="-mb-px h-full">
                <UnderlineTab active={false} onClick={noop}>
                  Ask
                </UnderlineTab>
                <UnderlineTab active onClick={noop}>
                  Homework
                </UnderlineTab>
              </UnderlineNav>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Focus on the panel"
                disabled
              >
                <Columns2 />
              </IconButton>
            </div>
            {/* A book opens on Homework: the list, as many rows as last time. */}
            <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-card">
              <ListSkeleton
                active={list?.active ?? 2}
                turnedIn={list?.turnedIn ?? 0}
              />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

const noop = () => {};
type Panes = ReturnType<typeof usePanes>;
const railKey = (bookId: string) => `rail-${bookId}`;

/**
 * Starts every request the book page makes as soon as the route knows the
 * book's id, all together, instead of each when the component that owns it
 * mounts (which chains them: the book, then the page, then the set, then the
 * dialog's remembered page). It draws nothing and re-renders alone. The
 * components below read the same cached queries.
 */
function BookPrefetch({ id, set }: { id: string; set?: string }) {
  // The set first: with the browser's six connections to a host (one held by
  // the event stream), the ones asked last wait for a slot.
  useHomeworkSet(set ?? null);
  useBookHomework(id);
  useContents(id);
  useAssignmentReads(id);
  useTurns(id);
  useAssignmentSource(id);
  useMemories(id);
  return null;
}

export function Workspace() {
  const { id = '', homework } = useParams<{ id: string; homework?: string }>();
  const bookQuery = useBook(id);
  // Held here so the frame that waits and the book that follows share one
  // measurement of the width.
  const panes = usePanes();
  if (
    bookQuery.error instanceof ApiError &&
    bookQuery.error.code === 'not_found'
  )
    return <WorkspaceMessage>There is no book here.</WorkspaceMessage>;
  if (bookQuery.error)
    return <WorkspaceMessage>{bookQuery.error.message}</WorkspaceMessage>;
  if (bookQuery.data && bookQuery.data.state.kind !== 'ready')
    return (
      <WorkspaceMessage>
        This book is still being prepared. It opens once it&apos;s on the shelf.
      </WorkspaceMessage>
    );
  return (
    <>
      {id && <BookPrefetch id={id} set={homework} />}
      {bookQuery.data ? (
        <BookWorkspace
          key={id}
          book={bookQuery.data}
          homework={homework}
          panes={panes}
        />
      ) : (
        <WorkspaceSkeleton
          id={id}
          frame={panes.frame}
          total={panes.total}
          ratios={panes.ratios}
        />
      )}
    </>
  );
}

function BookWorkspace({
  book,
  homework,
  panes,
}: {
  book: Book;
  homework?: string;
  panes: Panes;
}) {
  const navigate = useNavigate();
  const contents = useContents(book.id);
  const update = useUpdateBook(book.id);
  const remove = useRemoveBook();
  const addBoxed = useAddBoxed();
  const pointOut = usePointOut();

  const [focus, setFocus] = useState(false);
  // The panes' widths, as fractions of the frame, held to their limits.
  // A PDF index: the scan is the one place that counts in those.
  const [currentPage, setCurrentPage] = useState(1);
  // The page a jump landed on holds the rail's highlight until a scroll
  // that moves the page says otherwise.
  const [pinnedPage, setPinnedPage] = useState<number | null>(null);
  const [editingBook, setEditingBook] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const bookUsage = useBookUsage(book.id, usageOpen);
  const queryClient = useQueryClient();
  const usageIntent = usePrefetchIntent(
    () => void prefetchBookUsage(queryClient, book.id),
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());

  const pages = useMemo(() => new PageMap(book.pageRuns), [book.pageRuns]);
  // The jump's own scroll lands a frame later and mustn't unpin it: near
  // the end of the book, or with short pages, the page it settles on
  // isn't the destination.
  const jumping = useRef(false);
  const jumpPdf = (pdf: number) => {
    setPinnedPage(pdf);
    jumping.current = true;
    pageRefs.current.get(pdf)?.scrollIntoView();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (jumping.current = false)),
    );
  };
  // Every page travels as its PDF page, and only a label says the
  // printed one (lib/pages): a jump is one.
  const jump = jumpPdf;
  const settlePage = (p: number) => {
    setCurrentPage(p);
    if (p !== pinnedPage && !jumping.current) setPinnedPage(null);
  };
  const entries = contents.data?.entries;
  // The rail holds its place while the contents load, and goes for good
  // when a book has none: the book itself carries the rail's shape, so even
  // a first visit knows. It is kept for the frame drawn before the book
  // arrives (a reload), where nothing else is known.
  const railShape = book.rail;
  useLastShape(railKey(book.id), railShape, RAIL_SHAPE, isRailShape);
  const hasRail =
    entries === undefined ? railShape.length > 0 : entries.length > 0;
  const showRail = !focus && hasRail;
  const panelKey = focus ? 'panelFocus' : 'panel';
  const widths =
    panes.total > 0
      ? layout(panes.total, panes.ratios, focus, showRail)
      : undefined;
  // The Remove popover names how many homework sets go with the book. The
  // list is fetched with the page; until it is, the count is a slot as wide
  // as the phrase was last time, never a "0".
  const homeworkSets = useBookHomework(book.id).data?.length;
  const homeworkText =
    homeworkSets === undefined
      ? undefined
      : plural(homeworkSets, 'homework set');
  const homeworkWidth = useLastCount(
    'remove-homework-width',
    homeworkText?.length,
    14,
  );
  // Time counts toward what you last touched: the panel's tab, or the
  // book itself.
  const activity = useRef<ActivityKind>('reading');
  // The homework question on screen, when one is: its time is counted for it.
  const openQuestion = useRef<string | null>(null);
  const onQuestion = useCallback(
    (id: string | null) => void (openQuestion.current = id),
    [],
  );
  const study = useStudyTime(
    book.id,
    () => activity.current,
    () => openQuestion.current ?? undefined,
  );

  return (
    <Pages value={pages}>
      <BoxingProvider
        onDone={async (target, boxes) => {
          if (target.kind === 'add')
            return (await addBoxed.mutateAsync({ setId: target.setId, boxes }))
              .id;
          await pointOut.mutateAsync({ id: target.questionId, boxes });
        }}
      >
        <BookHereContext
          value={{
            bookId: book.id,
            problems: book.problems,
            aspect: book.aspect,
            editBook: () => {
              setEditingBook(true);
            },
          }}
        >
          <AppShell
            scroll="fill"
            middle={
              // The bar names the book, and its one menu holds what you do to
              // it: edit it, see what the tutor remembers, what it has cost, and, last and apart,
              // remove it. Every thing has one menu for its actions, the
              // homework set's included.
              <span className="flex items-center gap-2">
                <span>{book.title}</span>
                <Menu label="Book actions" intent={usageIntent}>
                  <MenuItem
                    icon={<Pencil />}
                    onSelect={() => {
                      setEditingBook(true);
                    }}
                  >
                    Edit book
                  </MenuItem>
                  <MenuItem
                    icon={<Brain />}
                    onSelect={() => {
                      setMemoryOpen(true);
                    }}
                  >
                    Memory
                  </MenuItem>
                  <MenuItem
                    icon={<Receipt />}
                    onSelect={() => {
                      setUsageOpen(true);
                    }}
                    intent={usageIntent}
                  >
                    Usage
                  </MenuItem>
                  <MenuDivider />
                  <MenuConfirmItem
                    icon={<Trash2 />}
                    question={`Remove ${book.title}?`}
                    detail={
                      <>
                        {homeworkText ?? (
                          <Skeleton
                            className="h-3"
                            style={{ width: `${homeworkWidth}ch` }}
                          />
                        )}
                        , the conversation and what the tutor remembers go with
                        it. Importing the PDF again starts fresh.
                      </>
                    }
                    action="Remove book"
                    onConfirm={() => {
                      remove.mutate(book.id, {
                        onSuccess: () => {
                          void navigate('/');
                        },
                      });
                    }}
                  >
                    Remove book
                  </MenuConfirmItem>
                </Menu>
                <LiveStudyTimer clock={study} />
              </span>
            }
          >
            <div className="flex h-full min-h-0 flex-col">
              <div
                // oxlint-disable-next-line react/refs -- passes the pane hook's own ref and stable callbacks; nothing reads the ref during render
                ref={panes.frame}
                className="flex min-h-0 flex-1"
                onPointerDownCapture={() => (activity.current = 'reading')}
              >
                {!focus && (
                  <>
                    {/* The rail, with contents or (a book with none) no rail:
                        known from the book before the contents arrive. */}
                    <Loaded
                      query={contents}
                      view="rail"
                      fill
                      boxClassName="shrink-0 grid-rows-[minmax(0,1fr)]"
                      className="flex h-full min-h-0"
                      errorText="Couldn't load the contents."
                      errorClassName="w-rail shrink-0 border-r bg-rail p-4"
                      variant={book.rail.length > 0 ? 'contents' : 'none'}
                      variantOf={(c): Variant<'rail'> =>
                        c.entries.length > 0 ? 'contents' : 'none'
                      }
                      neutral={null}
                      skeletons={{
                        contents: (
                          <RailSkeleton
                            width={widths?.rail}
                            shape={railShape}
                          />
                        ),
                        none: null,
                      }}
                    >
                      {(c) =>
                        c.entries.length > 0 ? (
                          <Rail
                            toc={c.entries}
                            page={pinnedPage ?? currentPage}
                            onJump={jumpPdf}
                            width={widths?.rail}
                          />
                        ) : null
                      }
                    </Loaded>
                    {showRail && widths && (
                      <ResizeHandle
                        label="Resize the contents"
                        pane="before"
                        value={widths.rail}
                        min={widths.railRange[0]}
                        max={widths.railRange[1]}
                        onChange={(px) => {
                          panes.set('rail', px);
                        }}
                        // oxlint-disable-next-line react/refs -- passes the pane hook's own ref and stable callbacks; nothing reads the ref during render
                        onCommit={panes.commit}
                        onReset={() => {
                          panes.reset('rail');
                        }}
                      />
                    )}
                  </>
                )}
                <Scan
                  bookId={book.id}
                  aspect={book.aspect}
                  pageCount={book.pageCount}
                  currentPage={currentPage}
                  onPageChange={settlePage}
                  scrollRef={scrollRef}
                  pageRefs={pageRefs}
                />
                {widths && (
                  <ResizeHandle
                    label={
                      focus ? 'Resize the panel in Focus' : 'Resize the panel'
                    }
                    pane="after"
                    value={widths.panel}
                    min={widths.panelRange[0]}
                    max={widths.panelRange[1]}
                    onChange={(px) => {
                      panes.set(panelKey, px);
                    }}
                    // oxlint-disable-next-line react/refs -- passes the pane hook's own ref and stable callbacks; nothing reads the ref during render
                    onCommit={panes.commit}
                    onReset={() => {
                      panes.reset(panelKey);
                    }}
                  />
                )}
                <Panel
                  bookId={book.id}
                  bookTitle={book.title}
                  onActive={(k) => (activity.current = k)}
                  onQuestion={onQuestion}
                  homework={homework}
                  focus={focus}
                  onFocusToggle={() => {
                    setFocus((f) => !f);
                  }}
                  onJump={jump}
                  width={widths?.panel}
                />
              </div>
            </div>
          </AppShell>

          <BookUsageDialog
            open={usageOpen}
            onClose={() => {
              setUsageOpen(false);
            }}
            title={book.title}
            shape={book.usage}
            data={bookUsage.data}
            loading={bookUsage.isPending && usageOpen}
            error={bookUsage.isError}
          />
          <MemoryDialog
            open={memoryOpen}
            bookId={book.id}
            onClose={() => {
              setMemoryOpen(false);
            }}
          />

          <BookDialog
            open={editingBook}
            book={{
              title: book.title,
              author: book.author,
              runs: book.pageRuns,
              problems: book.problems,
              cover: book.cover,
              pages: book.pageCount,
              imported: new Date(book.addedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              }),
            }}
            onClose={() => {
              setEditingBook(false);
            }}
            onSave={(next) => {
              // Only what changed: a colour alone isn't an edit to the name.
              const named =
                next.title !== book.title || next.author !== book.author;
              const numbered =
                JSON.stringify(next.runs) !== JSON.stringify(pages.runs);
              update.mutate({
                ...(named && { title: next.title, author: next.author }),
                ...(numbered && { pageRuns: next.runs }),
                ...(next.problems && { problems: next.problems }),
                ...(next.cover !== book.cover && { cover: next.cover }),
              });
            }}
          />
        </BookHereContext>
      </BoxingProvider>
    </Pages>
  );
}
