import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { viewOf } from '@/api/client';
import { useLiveStream } from '@/api/events';
import { screenError, useScreenError } from '@/api/screen-error';
import { Button } from '@/components/button';
import { Flash } from '@/components/flash';
import { TopBar } from '@/components/top-bar';
import { errorLine } from '@/lib/error-text';
import { cn } from '@/lib/utils';

/**
 * Every screen: the top bar as fixed chrome, then the screen below it.
 *
 * Between the two sits the lost-touch strip, there only while the live
 * stream is down, so a dead server never looks like a healthy app.
 *
 * The window itself never scrolls. The shell is exactly the viewport, the
 * bar takes its 64px, and what's left is the scroll region, so a scrollbar
 * begins under the bar rather than running past it.
 *
 * Two kinds of screen:
 *
 * - `page`: a document that scrolls as one (Home, Settings). Nothing inside
 *   it gets its own vertical scrollbar.
 * - `fill`: a screen that is exactly the remaining height and never
 *   scrolls as a whole (the book workspace). Its panes scroll themselves,
 *   because each is a separate stream of content.
 */

/** A page's h1 tells the shell whether it has scrolled out of sight, and
 *  what to call the page when it has. */
const TitleSlot = createContext<(title: string | null) => void>(() => {});

/** Shown while PSet can't be reached, on every screen: the live stream is
 *  down, or a request found the server not answering. It says the catalog's
 *  words once, with the one thing to do: try again (the stream also
 *  reconnects by itself). Nothing else on the screen repeats it. */
function Unreachable() {
  const live = useLiveStream();
  const raised = useScreenError();
  const qc = useQueryClient();
  if (live && !raised) return null;
  const view = raised ?? viewOf('request.unreachable');
  return (
    <Flash
      tone="warning"
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            screenError.clear();
            void qc.refetchQueries({ type: 'active' });
          }}
        >
          Try again
        </Button>
      }
    >
      {errorLine(view)}
    </Flash>
  );
}

export function AppShell({
  middle,
  scroll = 'page',
  children,
}: {
  middle?: ReactNode;
  scroll?: 'page' | 'fill';
  children: ReactNode;
}) {
  // Set while the page's h1 is out of view: the bar then says where you
  // are, since the page no longer does.
  const [scrolledTitle, setScrolledTitle] = useState<string | null>(null);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopBar
        middle={
          middle ?? (
            <span
              aria-hidden={!scrolledTitle}
              className={cn(
                'transition-opacity duration-200 ease-out motion-reduce:transition-none',
                scrolledTitle ? 'opacity-100' : 'opacity-0',
              )}
            >
              {scrolledTitle}
            </span>
          )
        }
      />
      <Unreachable />
      <TitleSlot value={setScrolledTitle}>
        <div
          className={
            scroll === 'page'
              ? 'min-h-0 flex-1 overflow-y-auto'
              : 'min-h-0 flex-1 overflow-hidden'
          }
        >
          {children}
        </div>
      </TitleSlot>
    </div>
  );
}

/**
 * A document page's one h1. While it's on screen the top bar's middle is
 * empty, because the bar never repeats what the page already says. Once
 * it scrolls out of sight the bar picks up `short` (or the heading
 * itself), fading in, so you always know where you are.
 */
export function PageTitle({
  short,
  className,
  children,
}: {
  /** What the bar says. Defaults to the heading's text; Home's heading is
   *  a greeting, so it passes "Home". */
  short?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const setTitle = useContext(TitleSlot);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const label = short ?? el.textContent;
    const io = new IntersectionObserver(([entry]) => {
      setTitle(entry.isIntersecting ? null : label);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      setTitle(null);
    };
  }, [short, setTitle]);

  return (
    <h1 ref={ref} className={cn('font-heading', className)}>
      {children}
    </h1>
  );
}

/** The centered column shared by Home and Settings: `layout-page` wide, page
 *  gutters, `section` rhythm between children. The workspace does not use
 *  it. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-layout-page space-y-section px-page py-12">
      {children}
    </main>
  );
}
