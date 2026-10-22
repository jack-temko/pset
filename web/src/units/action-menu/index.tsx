import { Ellipsis } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem<Id extends string = string> {
  id: Id;
  /** Sentence case, the action as a verb. */
  label: string;
  /** Marks an item that takes something away. */
  danger?: boolean;
}

const canPopover = () =>
  typeof HTMLElement !== 'undefined' &&
  typeof HTMLElement.prototype.showPopover === 'function';

/** A "⋯" button that opens a short list of actions under it, right-aligned
 *  to it. Closes on Escape, on a press elsewhere and after an item runs, and
 *  gives focus back to the button. Arrow keys move between items. It floats
 *  in the top layer, so no parent clips it. */
export function ActionMenu<Id extends string>({
  label,
  items,
  onSelect,
  forceOpen,
}: {
  /** The button's name: "More for this problem". */
  label: string;
  items: readonly MenuItem<Id>[];
  onSelect?: (id: Id) => void;
  /** Opens it from outside (the design page only). */
  forceOpen?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const open = shown || Boolean(forceOpen);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hasPopover = canPopover();

  const close = () => {
    setShown(false);
    button.current?.focus();
  };

  useLayoutEffect(() => {
    const p = panel.current;
    const b = button.current;
    if (!open || !p || !b) return;
    if (hasPopover && !p.matches(':popover-open')) p.showPopover();
    const r = b.getBoundingClientRect();
    p.style.top = `${String(r.bottom + 4 + window.scrollY)}px`;
    p.style.left = `${String(r.right - p.offsetWidth + window.scrollX)}px`;
  });

  useEffect(() => {
    if (!shown) return;
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t))
        setShown(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [shown]);

  const move = (e: KeyboardEvent) => {
    const els = [
      ...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        []),
    ];
    const at = els.indexOf(document.activeElement as HTMLElement);
    const to =
      e.key === 'ArrowDown'
        ? (at + 1) % els.length
        : e.key === 'ArrowUp'
          ? (at - 1 + els.length) % els.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? els.length - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    els[to].focus();
  };

  const card = open && (
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      popover={hasPopover ? 'manual' : undefined}
      onKeyDown={move}
      className="ds-body absolute top-0 left-0 m-0 w-max min-w-44 overflow-hidden rounded-(--ds-radius-control) border border-(--ds-border) bg-(--ds-bg-raised) p-1 text-(--ds-fg)"
      style={{ inset: 'auto', zIndex: 1000 }}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          onClick={() => {
            setShown(false);
            button.current?.focus();
            onSelect?.(it.id);
          }}
          className={`flex min-h-(--ds-control) w-full items-center rounded-(--ds-radius-segment) px-3 text-left hover:bg-(--ds-hover) active:bg-(--ds-pressed) ${it.danger ? 'text-(--ds-danger)' : ''}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setShown((s) => !s);
        }}
        className="inline-flex h-(--ds-control) w-(--ds-control) shrink-0 items-center justify-center rounded-(--ds-radius-control) border border-(--ds-border) text-(--ds-fg) hover:bg-(--ds-hover) active:bg-(--ds-pressed)"
      >
        <Ellipsis className="size-4" aria-hidden />
      </button>
      {hasPopover || !card
        ? card
        : createPortal(
            <div className="ds" style={{ display: 'contents' }}>
              {card}
            </div>,
            document.body,
          )}
    </>
  );
}
