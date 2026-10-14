import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type TooltipSide = 'below' | 'above' | 'right' | 'left';

/** How far the tooltip sits from its control, and from the viewport's edge. */
const GAP = 4;
const MARGIN = 8;
/** The wait before a hover shows it; focus shows it at once. */
const HOVER_MS = 50;

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  below: 'above',
  above: 'below',
  right: 'left',
  left: 'right',
};

/** Where the tooltip goes for a control: the wanted side if it fits inside
 *  the viewport, else the opposite, then right, then left; then shifted along
 *  its edge so it never comes closer than 8 to the viewport. */
export function place(
  anchor: DOMRect,
  size: { width: number; height: number },
  view: { width: number; height: number },
  side: TooltipSide,
): { left: number; top: number; side: TooltipSide } {
  const at = (s: TooltipSide) => ({
    left:
      s === 'right'
        ? anchor.right + GAP
        : s === 'left'
          ? anchor.left - GAP - size.width
          : anchor.left + anchor.width / 2 - size.width / 2,
    top:
      s === 'below'
        ? anchor.bottom + GAP
        : s === 'above'
          ? anchor.top - GAP - size.height
          : anchor.top + anchor.height / 2 - size.height / 2,
  });
  const fits = (s: TooltipSide) => {
    const p = at(s);
    return s === 'below' || s === 'above'
      ? p.top >= MARGIN && p.top + size.height <= view.height - MARGIN
      : p.left >= MARGIN && p.left + size.width <= view.width - MARGIN;
  };
  const order = [side, OPPOSITE[side], 'right', 'left'] as const;
  const chosen = order.find(fits) ?? side;
  const p = at(chosen);
  const clamp = (v: number, size: number, room: number) =>
    Math.max(MARGIN, Math.min(v, room - MARGIN - size));
  return {
    side: chosen,
    left:
      chosen === 'below' || chosen === 'above'
        ? clamp(p.left, size.width, view.width)
        : p.left,
    top:
      chosen === 'right' || chosen === 'left'
        ? clamp(p.top, size.height, view.height)
        : p.top,
  };
}

const canTellFocusVisible =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('selector(:focus-visible)');

/** Focus from the keyboard (or a script), not from a mouse press. */
function focusVisible(el: Element) {
  return canTellFocusVisible ? el.matches(':focus-visible') : true;
}

const hasPopover =
  typeof HTMLElement !== 'undefined' &&
  typeof HTMLElement.prototype.showPopover === 'function';

/** A small floating label tied to one control. Shows on hover (after 50ms)
 *  and on keyboard focus; hides on pointer leave, blur and Escape. A caller
 *  may open it with `open`. It is drawn in the browser's top layer, so no
 *  parent clips it, and placed with fixed coordinates. */
export function Tooltip({
  text,
  children,
  open,
  side = 'below',
}: {
  /** One short line. */
  text: string;
  /** The one control it belongs to. */
  children: ReactNode;
  /** Opens it from outside: the design page, or a press. */
  open?: boolean;
  side?: TooltipSide;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const visible = Boolean(open) || ((hover || focus) && !dismissed);

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
      if (e.key === 'Escape') setDismissed(true);
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
        }}
        onFocus={(e) => {
          if (focusVisible(e.target as Element)) {
            setDismissed(false);
            setFocus(true);
          }
        }}
        onBlur={() => {
          setFocus(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDismissed(true);
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
