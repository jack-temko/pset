import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { GRACE_MS } from '@/lib/settled';
import { cn } from '@/lib/utils';

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The part of a TanStack query result `Loaded` reads. */
type Query<T> = { data: T | undefined; isPending: boolean; isError: boolean };

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
export function Loaded<T>({
  query,
  skeleton,
  children,
  className,
  errorText = "Couldn't load this. Try again in a moment.",
  grace = true,
}: {
  query: Query<T>;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
  className?: string;
  /** The line shown when the query failed and there is nothing to show. */
  errorText?: string;
  /** Hold the skeleton back for GRACE_MS (the default, for content inside a
   *  page). An overlay passes false: it is new on screen, so its skeleton shows
   *  from the dialog's first frame. */
  grace?: boolean;
}) {
  const pending = query.isPending;
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
    } else if (aged && !reducedMotion()) {
      setFadeFrom(
        // oxlint-disable-next-line react/refs -- reads the layer's opacity at the moment the swap starts
        layer.current ? getComputedStyle(layer.current).opacity || '1' : '1',
      );
      setSwapping(true);
    }
  }
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
  const content = useMemo(
    () => (pending ? null : children(query.data as T)),
    [pending, children, query.data],
  );

  if (!pending && query.isError && query.data === undefined) {
    return (
      <p role="status" className="text-sm text-destructive/80">
        {errorText}
      </p>
    );
  }
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)]"
      aria-busy={pending || undefined}
    >
      {(pending || swapping) && (
        <div
          ref={layer}
          aria-hidden
          style={
            swapping
              ? ({ '--fade-from': fadeFrom } as CSSProperties)
              : undefined
          }
          className={cn(
            className,
            '[grid-area:1/1]',
            pending
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
      <div className={cn(className, '[grid-area:1/1]', swapping && 'fade-in')}>
        {content}
      </div>
    </div>
  );
}
