import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { GRACE_MS } from '@/lib/settled';
import { canReveal, claimReveal, joinReveal } from './reveal';
import { cn } from '@/lib/utils';
import type { Variant, Views } from '@/variants';

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The part of a TanStack query result `Loaded` reads. */
type Query<T> = { data: T | undefined; isPending: boolean; isError: boolean };

/** Development only: the skeleton's variant must be the content's, and the
 *  content must not switch variant just after it appears (the flash of a wrong
 *  screen, then the right one). Returns the message to show on screen. */
function useVariantCheck(
  busy: boolean,
  variant: string | undefined,
  content: string | undefined,
): string | null {
  const [warning, setWarning] = useState<string | null>(null);
  const drawn = useRef<string | undefined>(undefined);
  const shown = useRef<{ variant: string; at: number } | undefined>(undefined);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const warn = (m: string) => {
      console.warn(`Loaded: ${m}`);
      setWarning(m);
    };
    if (busy) {
      drawn.current = variant;
      shown.current = undefined;
      return;
    }
    if (content === undefined) return;
    if (drawn.current !== undefined && drawn.current !== content)
      warn(
        `the skeleton was "${drawn.current}" but the content is "${content}"`,
      );
    drawn.current = undefined;
    const was = shown.current;
    if (was && was.variant !== content && Date.now() - was.at < FLASH_MS)
      warn(
        `the content switched from "${was.variant}" to "${content}" just after it appeared`,
      );
    if (!was || was.variant !== content)
      shown.current = { variant: content, at: Date.now() };
  }, [busy, variant, content]);
  return warning;
}

/** A change of variant this soon after the reveal is a flash, not a choice. */
const FLASH_MS = 500;

/**
 * The one way anything that waits on data is drawn. While the query is
 * pending it holds the `skeleton`'s space from the first frame: invisible for
 * the first GRACE_MS, so a quick answer never blinks, then fading in over
 * 150ms and shimmering. An overlay passes `grace={false}`: its skeleton is
 * drawn from the first frame, and data still crossfades in over it. When the data arrives after the skeleton showed, the
 * two crossfade in one grid cell (the content 0 to 1 on top, the skeleton 1
 * to 0 underneath, then it unmounts), so there is no frame where neither is
 * drawn. Data that arrives within the grace, or was cached at the first
 * render, shows at once with no fade. A failed query with nothing to show is
 * one line of muted destructive text (`errorText`). Reduced motion swaps
 * instantly.
 *
 * The tree never changes shape: one wrapper, one content element, and the
 * skeleton a layer that comes and goes, so the content never remounts and its
 * fade never replays.
 *
 * The skeleton must be the content's size: nothing here moves the box to make
 * up for one that isn't (a height animation was tried and dropped, it
 * jittered), and the jump check (`make jumps`) fails a skeleton off by more
 * than 2px.
 *
 * `className` goes on the skeleton and on the content, so both share its
 * layout (a `space-y-4` stack, a grid).
 */
export function Loaded<T, K extends Views = Views>({
  query,
  queries,
  skeleton: single,
  view,
  variant,
  skeletons,
  neutral,
  variantOf,
  children,
  className,
  errorText = "Couldn't load this. Try again in a moment.",
  errorClassName,
  grace = true,
  fill = false,
  boxClassName,
}: {
  query: Query<T>;
  /** More queries the box waits on: it reveals once all have answered. */
  queries?: Query<unknown>[];
  children: (data: T) => ReactNode;
  className?: string;
  /** The line shown when the query failed and there is nothing to show. */
  errorText?: string;
  /** Classes for that line, for a box that is more than a line of text in its
   *  parent (a pane). */
  errorClassName?: string;
  /** Hold the skeleton back for GRACE_MS (the default, for content inside a
   *  page). An overlay passes false: it is new on screen, so its skeleton shows
   *  from the dialog's first frame. */
  grace?: boolean;
  /** The box is as tall as its parent (a pane that bottom-aligns its content). */
  fill?: boolean;
  /** Classes for the box itself (its place in a flex or grid parent). */
  boxClassName?: string;
} & (
  | {
      /** The box's one skeleton, for a view with a single shape. */
      skeleton: ReactNode;
      view?: undefined;
      variant?: undefined;
      skeletons?: undefined;
      neutral?: undefined;
      variantOf?: undefined;
    }
  | {
      skeleton?: undefined;
      /** The view, by its key in `web/src/variants.ts`; stamped as
       *  `data-view` beside `data-variant`, so a check finds the box. */
      view: K;
      /** Which shape the view will take, resolved before the data from what
       *  is already known (the clicked row's summary, the route, cached
       *  data), or undefined when it isn't known yet. */
      variant: Variant<K> | undefined;
      /** One skeleton per variant, each the shape that variant will have. */
      skeletons: Record<Variant<K>, ReactNode>;
      /** With no variant known: the chrome every variant shares, real, and a
       *  quiet body. Never a guess at a variant. */
      neutral: ReactNode;
      /** The variant the data makes the view. Skeleton and content are both
       *  stamped with it (`data-variant`); in development a mismatch, or a
       *  variant that changes just after the reveal, warns. */
      variantOf: (data: T) => Variant<K>;
    }
)) {
  const skeleton = skeletons
    ? variant === undefined
      ? neutral
      : skeletons[variant]
    : single;
  const all = queries ? [query, ...queries] : [query];
  const pending = all.some((q) => q.isPending);
  // Only the main query's failure is the box's error: a failed `queries` entry
  // doesn't gate the page, and the content draws its own line where it sits.
  const failed = query.isError && query.data === undefined;
  // The grace is per wait: it starts again when a new pending phase does.
  const [aged, setAged] = useState(!grace);
  useEffect(() => {
    if (!pending || !grace) return;
    const t = setTimeout(() => {
      setAged(true);
    }, GRACE_MS);
    return () => {
      clearTimeout(t);
    };
  }, [pending, grace]);

  // The skeleton stays under the content for the length of the crossfade,
  // but only if it was ever seen.
  const [wasPending, setWasPending] = useState(pending);
  // Data is in but the reveal train hasn't come: drawn as pending until it does.
  const [held, setHeld] = useState(false);
  const [claim, setClaim] = useState(false);
  const [swapping, setSwapping] = useState(false);
  // Where the skeleton's opacity stood when the data landed: its fade-out
  // starts there, so a skeleton still fading in doesn't pop to full first.
  const layer = useRef<HTMLDivElement>(null);
  const [fadeFrom, setFadeFrom] = useState('1');
  if (wasPending !== pending) {
    setWasPending(pending);
    if (pending) {
      setAged(!grace);
      setSwapping(false);
      setHeld(false);
      setClaim(false);
    } else if (aged && grace && !failed && !canReveal()) {
      setHeld(true);
    } else if (aged && !reducedMotion()) {
      setFadeFrom(
        // oxlint-disable-next-line react/refs -- reads the layer's opacity at the moment the swap starts
        layer.current ? getComputedStyle(layer.current).opacity || '1' : '1',
      );
      setSwapping(true);
    }
    // Revealing at once is a reveal: claimed in the layout effect below.
    if (!pending && aged && grace && !failed && canReveal()) setClaim(true);
  }
  useLayoutEffect(() => {
    if (!claim) return;
    claimReveal();
  }, [claim]);
  useEffect(() => {
    if (!held) return;
    return joinReveal(() => {
      setFadeFrom(
        layer.current ? getComputedStyle(layer.current).opacity || '1' : '1',
      );
      setSwapping(!reducedMotion());
      setHeld(false);
    });
  }, [held]);
  useEffect(() => {
    if (!swapping) return;
    const t = setTimeout(() => {
      setSwapping(false);
    }, 170);
    return () => {
      clearTimeout(t);
    };
  }, [swapping]);

  // The content is built once per data: this component re-renders for its own
  // state (the grace, the swap), and a big table rebuilt each time is what made
  // the crossfade slow.
  const busy = pending || held;
  const content = useMemo(
    () => (busy ? null : children(query.data as T)),
    [busy, children, query.data],
  );

  const contentVariant =
    !busy && !failed ? variantOf?.(query.data as T) : undefined;
  const warning = useVariantCheck(busy, variant, contentVariant);

  if (!busy && failed) {
    return (
      <p
        role="status"
        className={cn('text-sm text-destructive/80', errorClassName)}
      >
        {errorText}
      </p>
    );
  }
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)]',
        fill && 'h-full',
        boxClassName,
      )}
      aria-busy={busy || undefined}
    >
      {(busy || swapping) && (
        <div
          ref={layer}
          aria-hidden
          data-view={view}
          data-variant={variant}
          style={
            swapping
              ? ({ '--fade-from': fadeFrom } as CSSProperties)
              : undefined
          }
          className={cn(
            className,
            '[grid-area:1/1]',
            busy
              ? [
                  'transition-opacity duration-150 ease-out motion-reduce:transition-none',
                  aged ? 'opacity-100' : 'opacity-0',
                ]
              : 'fade-out pointer-events-none',
          )}
        >
          {skeleton}
        </div>
      )}
      <div
        data-view={view}
        data-variant={contentVariant}
        className={cn(className, '[grid-area:1/1]', swapping && 'fade-in')}
      >
        {content}
      </div>
      {warning && (
        <p
          role="alert"
          className="fixed bottom-3 left-3 z-[100] max-w-md rounded-md bg-destructive px-3 py-2 text-xs text-white"
        >
          Loaded: {warning}
        </p>
      )}
    </div>
  );
}
