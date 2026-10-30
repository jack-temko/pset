import { List, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { Button } from '@/units/button';
import { Contents } from './contents';
import { sessionMemory, type Memory } from './memory';
import { SamplePage } from './sample-page';
import {
  pdfOf,
  printedOf,
  type Book,
  type Box,
  type Rect,
  type Section,
} from './types';

/** The gap round and between pages. */
const PAD = 12;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
/** Where in the view the "current page" is read: a share of its height. */
const PROBE = 0.3;
/** The pane width from which Contents sits beside the pages: the pages keep
 *  about 430px or more. */
const BESIDE_AT = 720;
/** The material pane the student last used, so Escape acts in one pane. */
let active: Element | null = null;

/** Smaller boxes than this (a share of the page) are a slip of the hand. */
const MIN_BOX = 0.02;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** A page that is still loading, and one that could not be drawn. */
type Load = 'loading' | 'ready' | 'failed';

/** The section that starts on a printed page, for its heading in the sample. */
function headingAt(tree: readonly Section[], printed: number | undefined) {
  if (printed === undefined) return undefined;
  const walk = (list: readonly Section[]): string | undefined => {
    for (const s of list) {
      if (s.page === printed) return s.title;
      const deeper = s.sections && walk(s.sections);
      if (deeper) return deeper;
    }
    return undefined;
  };
  return walk(tree);
}

const label = (book: Book, pdf: number) => {
  const printed = printedOf(book, pdf);
  return printed === undefined ? `PDF ${String(pdf)}` : `p. ${String(printed)}`;
};

interface SlotProps {
  book: Book;
  name: string;
  pdf: number;
  left: number;
  top: number;
  w: number;
  h: number;
  loadMs: number;
  broken: boolean;
  /** Pages that have arrived, kept by the pane so scrolling back is calm. */
  loaded: Set<number>;
  flash?: { rect: Rect; n: number };
  boxing: boolean;
  boxes: readonly Box[];
  onBox: (box: Box) => void;
  onRemoveBox: (box: Box) => void;
}

/** One page's place in the scroll: a plain page-shaped box until its image
 *  arrives, then the image fading in (M9); or what failed. */
function PageSlot({
  book,
  name,
  pdf,
  left,
  top,
  w,
  h,
  loadMs,
  broken,
  loaded,
  flash,
  boxing,
  boxes,
  onBox,
  onRemoveBox,
}: SlotProps) {
  // No wait at all (the sample's 0) is an answer already.
  const [load, setLoad] = useState<Load>(() =>
    loaded.has(pdf) || loadMs <= 0
      ? broken && !loaded.has(pdf)
        ? 'failed'
        : 'ready'
      : 'loading',
  );
  const [fade, setFade] = useState(false);
  const [wasBoxing, setWasBoxing] = useState(boxing);
  const [draft, setDraft] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }>();

  // A draft ends with the mode.
  if (wasBoxing !== boxing) {
    setWasBoxing(boxing);
    if (!boxing) setDraft(undefined);
  }

  useEffect(() => {
    if (load !== 'loading') return;
    const t = setTimeout(
      () => {
        if (broken) setLoad('failed');
        else {
          loaded.add(pdf);
          setFade(true);
          setLoad('ready');
        }
      },
      loadMs + (pdf % 4) * 30,
    );
    return () => {
      clearTimeout(t);
    };
  }, [load, broken, loadMs, loaded, pdf]);

  const at = (e: ReactPointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };

  return (
    <div
      data-pdf={pdf}
      className={`absolute overflow-hidden ${boxing ? 'cursor-crosshair touch-none select-none' : ''}`}
      style={{ left, top, width: w, height: h }}
      onPointerDown={(e) => {
        if (!boxing || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = at(e);
        setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      }}
      onPointerMove={(e) => {
        if (!draft) return;
        const p = at(e);
        setDraft({ ...draft, x1: p.x, y1: p.y });
      }}
      onPointerCancel={() => {
        setDraft(undefined);
      }}
      onPointerUp={() => {
        if (!draft) return;
        const rect = {
          x: Math.min(draft.x0, draft.x1),
          y: Math.min(draft.y0, draft.y1),
          w: Math.abs(draft.x1 - draft.x0),
          h: Math.abs(draft.y1 - draft.y0),
        };
        setDraft(undefined);
        if (boxing && rect.w >= MIN_BOX && rect.h >= MIN_BOX)
          onBox({ pdf, ...rect });
      }}
    >
      {load === 'ready' && (
        <div className={`size-full ${fade ? 'page-fade' : ''}`}>
          <SamplePage
            book={book}
            pdf={pdf}
            name={name}
            heading={headingAt(book.contents, printedOf(book, pdf))}
          />
        </div>
      )}
      {load === 'loading' && (
        <div data-loading className="size-full bg-(--ds-bg-raised)" />
      )}
      {load === 'failed' && (
        <div
          role="alert"
          className="flex size-full flex-col items-center justify-center gap-3 overflow-hidden border border-(--ds-danger) bg-(--ds-bg-raised) p-6 text-center"
        >
          <p className="ds-body flex items-center gap-2 font-medium text-(--ds-danger)">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {`Couldn't draw ${label(book, pdf)}`}
          </p>
          <p className="ds-small max-w-sm text-(--ds-fg-muted)">
            The picture of this page did not arrive, so it can&apos;t be shown.
            The rest of the book is fine.
          </p>
          <Button
            onPress={() => {
              setLoad('loading');
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {flash && (
        <span
          key={flash.n}
          data-flash
          className="box-flash pointer-events-none absolute rounded-(--ds-radius-control) outline-2 outline-(--ds-accent)"
          style={{
            left: `${String(flash.rect.x * 100)}%`,
            top: `${String(flash.rect.y * 100)}%`,
            width: `${String(flash.rect.w * 100)}%`,
            height: `${String(flash.rect.h * 100)}%`,
          }}
        />
      )}
      {(boxing ? boxes : []).map((b, i) => (
        <span
          key={i}
          data-box
          className="absolute rounded-(--ds-radius-control) bg-(--ds-accent)/15 outline-2 outline-(--ds-accent)"
          style={{
            left: `${String(b.x * 100)}%`,
            top: `${String(b.y * 100)}%`,
            width: `${String(b.w * 100)}%`,
            height: `${String(b.h * 100)}%`,
          }}
        >
          <button
            type="button"
            aria-label="Remove this box"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={() => {
              onRemoveBox(b);
            }}
            className="absolute -top-3 -right-3 flex size-6 items-center justify-center rounded-full bg-(--ds-accent-solid) text-(--ds-on-accent)"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      {draft && (
        <span
          className="absolute bg-(--ds-accent)/15 outline-2 outline-(--ds-accent)"
          style={{
            left: `${String(Math.min(draft.x0, draft.x1) * 100)}%`,
            top: `${String(Math.min(draft.y0, draft.y1) * 100)}%`,
            width: `${String(Math.abs(draft.x1 - draft.x0) * 100)}%`,
            height: `${String(Math.abs(draft.y1 - draft.y0) * 100)}%`,
          }}
        />
      )}
    </div>
  );
}

export interface MaterialProps {
  /** The material's name; it heads Contents and the wait. */
  name: string;
  book: Book;
  /** Which tab this is: the place is kept per tab (M8). */
  tabId: string;
  /** Where the place is kept. */
  memory?: Memory;
  /** The printed page the tab is on. When it changes, the pane goes there. */
  page?: number;
  /** Open on this PDF page instead (a page with no printed number). */
  startPdf?: number;
  /** Open with Contents showing. */
  startContents?: boolean;
  /** The pane width from which Contents opens beside the pages (M3, D16)
   *  instead of over them. */
  besideAt?: number;
  /** Open with the page number box in use: what is typed, and whether it was
   *  entered already. */
  startGoTo?: { text: string; entered?: boolean };
  /** Open with these boxes drawn (boxing mode). */
  startBoxes?: readonly Box[];
  /** A book still being read in, one that could not be read, or ready. */
  status?: 'ready' | 'reading' | 'failed';
  /** About how many minutes the reading in takes. */
  readingMin?: number;
  /** How long a page takes to arrive, in milliseconds (the sample's). */
  loadMs?: number;
  /** PDF pages that cannot be drawn (the sample's). */
  brokenPages?: readonly number[];
  /** A page link's request (P11): turn to the printed page and flash the
   *  box. A new `n` flashes again. */
  flash?: { page: number; box: Rect; n: number };
  /** Boxing mode (M11): what the student is drawing a box around, and the
   *  printed page to turn to. */
  boxing?: { label: string; page?: number };
  /** The page you scrolled to changed: its printed number. */
  onPage?: (page: number) => void;
  /** Done in boxing mode, with every box drawn. */
  onDone?: (boxes: readonly Box[]) => void;
  /** The boxes drawn so far changed (drawn or removed), so the workspace
   *  can keep them if the tab is switched away mid-boxing. */
  onBoxes?: (boxes: readonly Box[]) => void;
  /** Cancel or Escape in boxing mode. */
  onCancel?: () => void;
  /** Read it again, on a book that could not be read. */
  onRetry?: () => void;
}

/** The inside of the material pane: one continuous scroll of a book fitted to
 *  the side, under a thin line (M1, M2). Contents opens over the pages (M3),
 *  the page number takes a printed page (M4, A1), a page link flashes a
 *  problem's box (M6), zoom is fit width and pinch (M7), the exact place is
 *  kept per tab (M8), pages load quietly (M9), a book being read in is one
 *  wait (M10) and boxing is a mode of the pane (M11). */
export function Material({
  name,
  book,
  tabId,
  memory = sessionMemory,
  page,
  startPdf,
  startContents,
  besideAt = BESIDE_AT,
  startGoTo,
  startBoxes,
  status = 'ready',
  readingMin,
  loadMs = 120,
  brokenPages = [],
  flash,
  boxing,
  onPage,
  onDone,
  onBoxes,
  onCancel,
  onRetry,
}: MaterialProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [paneW, setPaneW] = useState(0);
  const [viewH, setViewH] = useState(0);
  const [top, setTop] = useState(0);
  const [zoom, setZoom] = useState(() => memory.get(tabId)?.zoom ?? 1);
  const [contents, setContents] = useState(startContents ?? false);
  const [boxes, setBoxes] = useState<readonly Box[]>(startBoxes ?? []);
  const [boxed, setBoxed] = useState(boxing);
  // Pages that have arrived live with the tab's place, so a tab switched
  // back to does not fade them in again.
  const [loaded] = useState(
    () => memory.get(tabId)?.loaded ?? new Set<number>(),
  );
  const [left, setLeft] = useState(0);
  /** The PDF page of the last jump, shown until the student scrolls. */
  const [pinned, setPinned] = useState<number>();
  const root = useRef<HTMLDivElement>(null);

  const printedMax = book.printedPages;
  const tooFar = (n: number) =>
    n > printedMax
      ? `No p. ${String(n)}, the book ends at ${String(printedMax)}`
      : `No p. ${String(n)}, the book starts at 1`;
  const [goTo, setGoTo] = useState<{ text: string; error?: string } | null>(
    () => {
      if (!startGoTo) return null;
      const n = Number(startGoTo.text);
      const bad =
        startGoTo.entered && Number.isInteger(n) && (n < 1 || n > printedMax);
      return { text: startGoTo.text, error: bad ? tooFar(n) : undefined };
    },
  );

  // Boxes belong to one boxing: they go when the mode ends.
  if ((boxing === undefined) !== (boxed === undefined)) {
    setBoxed(boxing);
    if (boxing === undefined) setBoxes([]);
  }

  const beside = contents && !boxing && paneW >= besideAt;
  const fitW = Math.max(0, width);
  const pageW = Math.round(fitW * zoom);
  const pageH = Math.round(pageW / book.aspect);
  const pitch = pageH + PAD;
  const innerW = Math.max(width, pageW);
  const total = PAD + book.pdfPages * pitch;

  /** The spot at the top of the view, in pages scrolled, and how far down the
   *  view a zoom keeps its focus. It survives any change of size. */
  const anchor = useRef({
    at: (() => {
      const kept = memory.get(tabId);
      if (startPdf !== undefined) return startPdf - 1;
      if (kept && kept.page === page) return kept.at;
      return pdfOf(book, clamp(page ?? 1, 1, book.printedPages)) - 1;
    })(),
    cy: 0,
    cx: 0,
    rx: undefined as number | undefined,
  });
  /** Where our own scrolling left the view, so its echo is not the student's. */
  const ours = useRef<number | undefined>(undefined);
  const geo = useRef({ pitch, pageH, viewH, innerW, width });
  const reported = useRef(page);
  const placed = useRef(false);

  useLayoutEffect(() => {
    geo.current = { pitch, pageH, viewH, innerW, width };
  });

  // Measure the side. jsdom measures nothing, so it gets a plausible size.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const rootEl = root.current;
    const measure = () => {
      if (rootEl) setPaneW(rootEl.clientWidth);
      setWidth(el.clientWidth || 600);
      setViewH(el.clientHeight || 640);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (rootEl) ro.observe(rootEl);
    return () => {
      ro.disconnect();
    };
  }, [status]);

  /** Puts the view where the anchor says, after any change of size. */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || width === 0) return;
    el.scrollTop = PAD + anchor.current.at * pitch - anchor.current.cy;
    ours.current = el.scrollTop;
    const a = anchor.current;
    if (a.rx !== undefined) {
      el.scrollLeft = a.rx * innerW - a.cx;
      a.rx = undefined;
    } else if (!placed.current) {
      el.scrollLeft = memory.get(tabId)?.left ?? 0;
    }
    placed.current = true;
    setLeft(el.scrollLeft);
    setTop(el.scrollTop);
  }, [pitch, zoom, width, innerW, memory, tabId]);

  const probe = top + PROBE * viewH - PAD;
  const idx = clamp(Math.floor(probe / pitch), 0, book.pdfPages - 1);
  const pdfHere = pinned ?? (pitch > PAD ? idx + 1 : 1);
  const printedHere = printedOf(book, pdfHere);

  // The place is kept, and the tab hears the page it is on (W11).
  useEffect(() => {
    const el = scroller.current;
    if (!el || width === 0) return;
    memory.set(tabId, {
      at: (el.scrollTop - PAD) / pitch,
      zoom,
      left: el.scrollLeft,
      loaded,
      page: printedHere ?? reported.current,
    });
    if (printedHere !== undefined && printedHere !== reported.current) {
      reported.current = printedHere;
      onPage?.(printedHere);
    }
  }, [
    top,
    left,
    zoom,
    width,
    pitch,
    printedHere,
    loaded,
    memory,
    tabId,
    onPage,
  ]);

  const toPdf = useCallback((pdf: number, inside = 0) => {
    const el = scroller.current;
    if (!el) return;
    const g = geo.current;
    const want = PAD + (pdf - 1) * g.pitch + inside * g.pageH;
    el.scrollTop = inside === 0 ? want - PAD : want - 0.25 * g.viewH;
    anchor.current = {
      at: (el.scrollTop - PAD) / g.pitch,
      cy: 0,
      cx: 0,
      rx: undefined,
    };
    ours.current = el.scrollTop;
    setPinned(pdf);
    setTop(el.scrollTop);
  }, []);

  // A new page from the tab: turn to it, unless it is where the scroll
  // already is.
  const ready = width > 0;
  useEffect(() => {
    if (!ready || page === undefined || page === reported.current) return;
    reported.current = page;
    toPdf(pdfOf(book, clamp(page, 1, printedMax)));
  }, [page, ready, book, printedMax, toPdf]);

  const flashN = flash?.n;
  const flashPage = flash?.page;
  const flashY = flash?.box.y;
  const flashed = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!ready || flashN === undefined || flashPage === undefined) return;
    if (flashed.current === flashN) return;
    flashed.current = flashN;
    reported.current = flashPage;
    toPdf(pdfOf(book, clamp(flashPage, 1, printedMax)), flashY);
  }, [flashN, flashPage, flashY, ready, book, printedMax, toPdf]);

  const boxPage = boxing?.page;
  const boxed2 = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!ready || boxPage === undefined) return;
    if (boxed2.current === boxPage) return;
    boxed2.current = boxPage;
    reported.current = boxPage;
    toPdf(pdfOf(book, clamp(boxPage, 1, printedMax)));
  }, [boxPage, ready, book, printedMax, toPdf]);

  // Pinch and ctrl+wheel zoom (M7): not passive, so the browser's own page
  // zoom stays out of it. The spot under the pointer stays put.
  const zoomRef = useRef(zoom);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
  });
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const prev = zoomRef.current;
      let next = clamp(
        prev * Math.exp(-clamp(e.deltaY, -30, 30) * 0.01),
        ZOOM_MIN,
        ZOOM_MAX,
      );
      // Zooming toward fit snaps to it when within about 2%.
      if (Math.abs(next - 1) < 0.02 && Math.abs(next - 1) <= Math.abs(prev - 1))
        next = 1;
      const r = el.getBoundingClientRect();
      const cy = e.clientY - r.top;
      const cx = e.clientX - r.left;
      anchor.current = {
        at: (el.scrollTop - PAD + cy) / geo.current.pitch,
        cy,
        cx,
        rx: (el.scrollLeft + cx) / geo.current.innerW,
      };
      setZoom(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [status]);

  // Escape: cancels boxing (A3), closes Contents, leaves the page box.
  useEffect(() => {
    if (boxing) active = root.current;
  }, [boxing]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const mine = root.current;
      const t = e.target instanceof Element ? e.target : null;
      if (
        t &&
        !mine?.contains(t) &&
        t.closest('input, textarea, [role=menu], [popover]')
      )
        return;
      if (active?.isConnected && active !== mine) return;
      if (boxing) onCancel?.();
      else if (contents) setContents(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [boxing, contents, onCancel]);

  if (status === 'reading')
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-(--ds-bg) p-8 text-center">
        <p className="ds-body flex max-w-md items-center gap-3 text-(--ds-fg-muted)">
          <LoaderCircle
            className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          <span className="[overflow-wrap:anywhere]">
            {`Reading ${name}, about ${String(readingMin ?? 2)} min`}
          </span>
        </p>
      </div>
    );

  if (status === 'failed')
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-(--ds-bg) p-8">
        <div
          role="alert"
          className="min-w-0 max-w-md space-y-3 rounded-(--ds-radius-control) border border-(--ds-danger) px-4 py-3"
        >
          <p className="ds-body flex min-w-0 items-start gap-2 font-medium text-(--ds-danger)">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {`Couldn't read ${name}`}
            </span>
          </p>
          <p className="ds-small pl-6 text-(--ds-fg-muted)">
            The file ended before its last page, so it is probably damaged or
            only partly downloaded.
          </p>
          <div className="pl-6">
            <Button variant="primary" onPress={onRetry}>
              Read it again
            </Button>
          </div>
          <p className="ds-small pl-6 text-(--ds-fg-muted)">
            If it fails again, add the book again from a fresh copy.
          </p>
        </div>
      </div>
    );

  const commitGo = () => {
    if (!goTo) return;
    const text = goTo.text.trim();
    if (text === '') {
      setGoTo(null);
      return;
    }
    const n = Number(text);
    if (!/^\d+$/.test(text) || n < 1 || n > printedMax) {
      setGoTo({
        text,
        error: /^\d+$/.test(text)
          ? tooFar(n)
          : `Type a page from 1 to ${String(printedMax)}`,
      });
      return;
    }
    setGoTo(null);
    toPdf(pdfOf(book, n));
  };

  const first = clamp(
    Math.floor((top - PAD) / pitch) - 1,
    0,
    book.pdfPages - 1,
  );
  const last = clamp(
    Math.ceil((top + viewH - PAD) / pitch) + 1,
    0,
    book.pdfPages - 1,
  );
  const shown =
    pitch > PAD
      ? Array.from({ length: last - first + 1 }, (_, i) => first + i + 1)
      : [];

  const pageButton =
    'ds-small ds-tabular rounded-(--ds-radius-tag) px-1.5 py-0.5';
  // The page number and its edit box are one control of one size (M4): the
  // box only gains a field border and background in place.
  const pageBox = `${pageButton} flex h-7 items-center gap-1`;
  const numBox =
    'ds-small ds-tabular box-border flex h-6 items-center justify-end rounded-(--ds-radius-tag) border px-1';
  const numW = `calc(${String(String(printedMax).length)}ch + 10px)`;

  return (
    <div
      ref={root}
      onPointerDownCapture={(e) => {
        active = e.currentTarget;
      }}
      onFocusCapture={(e) => {
        active = e.currentTarget;
      }}
      className="relative flex h-full min-h-0 min-w-0 flex-col bg-(--ds-bg)"
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-(--ds-border-muted) bg-(--ds-bg) px-3">
        {boxing ? (
          <>
            <p className="ds-body min-w-0 truncate font-medium">
              {`Draw a box around ${boxing.label}`}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="quiet" onPress={onCancel}>
                Cancel
              </Button>
              <span className={boxes.length === 0 ? 'invisible' : undefined}>
                <Button
                  variant="primary"
                  onPress={() => {
                    onDone?.(boxes);
                  }}
                >
                  Done
                </Button>
              </span>
            </div>
          </>
        ) : (
          <>
            <Button
              variant="quiet"
              icon={List}
              onPress={() => {
                setContents((o) => !o);
              }}
            >
              Contents
            </Button>
            <div className="ds-small flex shrink-0 items-center gap-2 text-(--ds-fg-muted)">
              {goTo ? (
                <>
                  <div className={`${pageBox} text-(--ds-fg)`}>
                    <span>p.</span>
                    <div
                      className={`${numBox} border-(--ds-border) bg-(--ds-bg-inset) focus-within:border-(--ds-accent) focus-within:outline-(length:--ds-focus-width) focus-within:outline-(--ds-accent) focus-within:outline-solid focus-within:outline-offset-(--ds-focus-offset)`}
                      style={{ width: numW }}
                    >
                      <input
                        autoFocus
                        inputMode="numeric"
                        aria-label="Go to printed page"
                        value={goTo.text}
                        onChange={(e) => {
                          setGoTo({ text: e.target.value });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitGo();
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            setGoTo(null);
                          }
                        }}
                        onBlur={() => {
                          setGoTo(null);
                        }}
                        className="ds-small ds-tabular size-full min-w-0 bg-transparent p-0 text-right text-(--ds-fg) outline-none!"
                      />
                    </div>
                  </div>
                  {goTo.error ? (
                    <span role="alert" className="text-(--ds-danger)">
                      {goTo.error}
                    </span>
                  ) : (
                    <span className="ds-tabular inline-block min-w-14 text-(--ds-fg-muted)">{`of ${String(printedMax)}`}</span>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setContents(false);
                      setGoTo({ text: '' });
                    }}
                    className={`${pageBox} hover:bg-(--ds-hover) ${printedHere === undefined ? '' : 'text-(--ds-fg)'}`}
                  >
                    {printedHere === undefined ? (
                      `PDF ${String(pdfHere)}`
                    ) : (
                      <>
                        <span>p.</span>
                        <span
                          className={`${numBox} border-transparent`}
                          style={{ width: numW }}
                        >
                          {printedHere}
                        </span>
                      </>
                    )}
                  </button>
                  {printedHere !== undefined && (
                    <span className="ds-tabular inline-block min-w-14 text-(--ds-fg-muted)">{`of ${String(printedMax)}`}</span>
                  )}
                </>
              )}

              {goTo?.error ? null : zoom === 1 ? (
                <span
                  className={`${pageButton} inline-block min-w-14 text-center text-(--ds-fg-muted)`}
                >
                  100%
                </span>
              ) : (
                <button
                  type="button"
                  title="Back to fit width"
                  onClick={() => {
                    anchor.current = {
                      at: ((scroller.current?.scrollTop ?? 0) - PAD) / pitch,
                      cy: 0,
                      cx: 0,
                      rx: undefined,
                    };
                    setZoom(1);
                  }}
                  className={`${pageButton} min-w-14 text-center text-(--ds-fg) hover:bg-(--ds-hover)`}
                >
                  {`${String(Math.round(zoom * 100))}%`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <div className="relative flex min-h-0 flex-1">
        {contents && !boxing && (
          <Contents
            name={name}
            tree={book.contents}
            printed={printedHere}
            beside={beside}
            onPick={(p) => {
              if (!beside) setContents(false);
              toPdf(pdfOf(book, p));
            }}
          />
        )}
        <div
          ref={scroller}
          data-scroller
          onScroll={(e) => {
            const el = e.currentTarget;
            setLeft(el.scrollLeft);
            if (
              ours.current !== undefined &&
              Math.abs(el.scrollTop - ours.current) < 2
            )
              return;
            ours.current = undefined;
            setPinned(undefined);
            anchor.current = {
              at: (el.scrollTop - PAD) / geo.current.pitch,
              cy: 0,
              cx: 0,
              rx: undefined,
            };
            setTop(el.scrollTop);
          }}
          className="min-h-0 min-w-0 flex-1 overflow-auto bg-(--ds-bg-inset)"
        >
          <div className="relative" style={{ width: innerW, height: total }}>
            {shown.map((pdf) => (
              <PageSlot
                key={pdf}
                book={book}
                name={name}
                pdf={pdf}
                left={(innerW - pageW) / 2}
                top={PAD + (pdf - 1) * pitch}
                w={pageW}
                h={pageH}
                loadMs={loadMs}
                broken={brokenPages.includes(pdf)}
                loaded={loaded}
                flash={
                  flash && pdfOf(book, flash.page) === pdf
                    ? { rect: flash.box, n: flash.n }
                    : undefined
                }
                boxing={boxing !== undefined}
                boxes={boxes.filter((b) => b.pdf === pdf)}
                onBox={(b) => {
                  const all = [...boxes, b];
                  setBoxes(all);
                  onBoxes?.(all);
                }}
                onRemoveBox={(b) => {
                  const all = boxes.filter((x) => x !== b);
                  setBoxes(all);
                  onBoxes?.(all);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The pane while it loads (M9): the top line's place and one plain
 *  page-shaped box. */
export function MaterialSkeleton() {
  const bar = (w: string) => (
    <span
      aria-hidden
      className={`block h-4 ${w} animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) motion-reduce:animate-none`}
    />
  );
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-(--ds-bg)">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-(--ds-border-muted) px-3">
        {bar('w-24')}
        <div className="flex items-center gap-2">
          {bar('w-28')}
          {bar('w-14')}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-(--ds-bg-inset) p-3">
        <div className="aspect-[8.5/11] w-full bg-(--ds-bg-raised)" />
      </div>
    </div>
  );
}
