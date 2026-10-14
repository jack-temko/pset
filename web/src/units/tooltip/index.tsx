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
 *  parent clips it, and placed with fixed coordinates. */
export function Tooltip({
  text,
  children,
  open,
  side = 'below',
  onClose,
}: {
  /** One short line. With none, the tooltip draws nothing. */
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
    t.style.left = `${String(p.left)}px`;
    t.style.top = `${String(p.top)}px`;
  };

  useLayoutEffect(() => {
    const t = tip.current;
    if (!visible || !t) return;
    if (hasPopover && !t.matches(':popover-open')) t.showPopover();
    position();
  });

  // Recompute while open, on scroll (any scroller) and resize.
  useEffect(() => {
    if (!visible) return;
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDismissed(true);
        onClose?.();
      }
    };
    document.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
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
      className="ds-small ds-fade-in pointer-events-none fixed top-0 left-0 m-0 w-max max-w-[250px] overflow-visible rounded-(--ds-radius-tag) border-0 bg-(--ds-pressed) px-2 py-1 text-(--ds-fg)"
      style={{ background: 'var(--ds-pressed)', inset: 'auto', zIndex: 1000 }}
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
