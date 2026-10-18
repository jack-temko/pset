import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { place, type TooltipSide } from './place';

/** The wait before a hover shows it; focus shows it at once. */
const HOVER_MS = 50;

const canTellFocusVisible =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('selector(:focus-visible)');

/** Focus from the keyboard (or a script), not from a mouse press. */
function focusVisible(el: Element) {
  return canTellFocusVisible ? el.matches(':focus-visible') : true;
}

/** Whether the student can see the control: its centre is inside the window
 *  and the element drawn there is the control or inside it. The tooltip itself
 *  has `pointer-events: none`, so it never answers. Without the API (jsdom),
 *  the control counts as visible. */
function controlVisible(anchor: HTMLElement | null) {
  if (!anchor || typeof document.elementFromPoint !== 'function') return true;
  const r = anchor.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  if (
    x < 0 ||
    y < 0 ||
    x > document.documentElement.clientWidth ||
    y > document.documentElement.clientHeight
  )
    return false;
  const hit = document.elementFromPoint(x, y);
  return hit !== null && anchor.contains(hit);
}

/** Read on each render, so a browser without the API falls back cleanly. */
function supportsPopover() {
  return (
    typeof HTMLElement !== 'undefined' &&
    typeof HTMLElement.prototype.showPopover === 'function'
  );
}

/** A small floating label tied to one control. Shows on hover (after 50ms)
 *  and on keyboard focus; hides on pointer leave, blur and Escape. A caller
 *  may open it with `open`. It is drawn in the browser's top layer, so no
 *  parent clips it, and placed in document coordinates. */
export function Tooltip({
  text,
  children,
  open,
  side = 'below',
  onClose,
}: {
  /** One short line; a data point may run a few short lines, split by a
   *  newline (tooltip-d5). With none, the tooltip draws nothing. */
  text: string | undefined;
  /** The one control it belongs to. */
  children: ReactNode;
  /** Opens it from outside: the design page, or a press. */
  open?: boolean;
  side?: TooltipSide;
  /** Fired when the tooltip itself closes it: Escape, pointer leave, blur. */
  onClose?: () => void;
}) {
  const hasPopover = supportsPopover();
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  /** A pinned tooltip hides while its control is covered or off the window. */
  const [covered, setCovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const visible =
    Boolean(text) && (Boolean(open) || ((hover || focus) && !dismissed));

  const position = () => {
    const a = anchor.current;
    const t = tip.current;
    if (!a || !t) return;
    const p = place(
      a.getBoundingClientRect(),
      { width: t.offsetWidth, height: t.offsetHeight },
      {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      },
      side,
    );
    // Document coordinates: the control's viewport rect plus the scroll at the
    // moment of placing. The box is absolute, so the page carries it with its
    // control natively, and no code runs while the page scrolls.
    t.style.left = `${String(p.left + window.scrollX)}px`;
    t.style.top = `${String(p.top + window.scrollY)}px`;
  };

  useLayoutEffect(() => {
    const t = tip.current;
    if (!visible || !t) return;
    if (hasPopover && !t.matches(':popover-open')) t.showPopover();
    position();
  });

  // Placement is worked out when it opens and when the window resizes, never
  // while the page scrolls. Two things can still end it:
  //  - a scroll that is not the document's (a scrolling ancestor of the
  //    control) cannot be followed, so it closes a tooltip that is not forced;
  //  - the control being covered or out of the window (checked once a frame on
  //    scroll and resize), since it floats above everything. That check only
  //    decides open or closed; it never moves the tooltip.
  useEffect(() => {
    if (!visible) return;
    const forced = Boolean(open);
    const close = () => {
      setDismissed(true);
      onClose?.();
    };
    let frame = 0;
    const check = () => {
      frame = 0;
      const seen = controlVisible(anchor.current);
      if (forced) setCovered(!seen);
      else if (!seen) close();
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(check);
    };
    const onScroll = (e: Event) => {
      if (e.target !== document && !forced) close();
      else schedule();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onResize = () => {
      position();
      schedule();
    };
    // A pinned tooltip is checked as it opens too, so one that is already
    // covered stays hidden.
    if (forced) schedule();
    window.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', esc);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', esc);
    };
  });

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const bubble = visible && (
    <div
      ref={tip}
      role="tooltip"
      popover={hasPopover ? 'manual' : undefined}
      className="ds-small ds-fade-in pointer-events-none whitespace-pre-line absolute top-0 left-0 m-0 w-max max-w-[250px] overflow-visible rounded-(--ds-radius-tag) border-0 bg-(--ds-pressed) px-2 py-1 text-(--ds-fg)"
      style={{
        background: 'var(--ds-pressed)',
        inset: 'auto',
        zIndex: 1000,
        visibility: covered ? 'hidden' : 'visible',
      }}
    >
      {text}
    </div>
  );

  return (
    <>
      <span
        ref={anchor}
        className="inline-flex max-w-full min-w-0 align-top"
        onPointerEnter={() => {
          setDismissed(false);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            setHover(true);
          }, HOVER_MS);
        }}
        onPointerLeave={() => {
          clearTimeout(timer.current);
          setHover(false);
          onClose?.();
        }}
        onFocus={(e) => {
          if (focusVisible(e.target)) {
            setDismissed(false);
            setFocus(true);
          }
        }}
        onBlur={() => {
          setFocus(false);
          onClose?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDismissed(true);
            onClose?.();
          }
        }}
      >
        {children}
      </span>
      {hasPopover || !bubble
        ? bubble
        : createPortal(
            <div className="ds" style={{ display: 'contents' }}>
              {bubble}
            </div>,
            document.body,
          )}
    </>
  );
}
