import { Ellipsis } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem<Id extends string = string> {
  id: Id;
  label: string;
  /** Marks an item that takes something away. */
  danger?: boolean;
}

export interface MenuGroup {
  /** A small heading over the group; without it the group has none. */
  label?: string;
  items: readonly MenuItem[];
}

const EDGE = 8;

/** A small list of choices opened at a point (menu-d1). It is drawn in the
 *  browser's top layer, so no row of tabs clips it, and it keeps 8 from the
 *  window. Outside press, Escape or a pick closes it. A press on an element
 *  marked `data-menu-trigger` is left to that element, so its own click can
 *  toggle the menu. */
export function Menu({
  at,
  groups,
  label,
  onPick,
  onClose,
}: {
  /** The top left corner, in window coordinates. */
  at: { x: number; y: number };
  groups: readonly MenuGroup[];
  /** The menu's name. */
  label: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showPopover === 'function' && !el.matches(':popover-open'))
      el.showPopover();
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    setPos({
      x: Math.max(EDGE, Math.min(at.x, vw - r.width - EDGE)),
      y: Math.max(EDGE, Math.min(at.y, vh - r.height - EDGE)),
    });
  }, [at.x, at.y]);

  useEffect(() => {
    const before = document.activeElement;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('[data-menu-trigger]')) return;
      if (!ref.current?.contains(t)) onClose();
    };
    document.addEventListener('pointerdown', away, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      if (
        before instanceof HTMLElement &&
        document.activeElement === document.body
      )
        before.focus();
    };
  }, [onClose]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const all = [...(ref.current?.querySelectorAll('button') ?? [])];
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const n = all.length;
    all[(i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n]?.focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      popover="manual"
      onKeyDown={onKey}
      style={{
        left: pos.x,
        top: pos.y,
        right: 'auto',
        bottom: 'auto',
        margin: 0,
      }}
      className="fixed max-h-[70vh] w-60 max-w-[calc(100vw-16px)] overflow-y-auto rounded-(--ds-radius-control) border border-(--ds-border) bg-(--ds-bg-raised) py-1 text-(--ds-fg)"
    >
      {groups.map((g, gi) => (
        <div
          key={g.label ?? String(gi)}
          className={
            gi > 0 ? 'mt-1 border-t border-(--ds-border-muted) pt-1' : ''
          }
        >
          {g.label && (
            <p className="ds-label px-3 py-1 text-(--ds-fg-muted)">{g.label}</p>
          )}
          {g.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              title={item.label}
              onClick={() => {
                onPick(item.id);
              }}
              className={`ds-body flex h-8 w-full focus-visible:outline-offset-[-2px] items-center px-3 text-left hover:bg-(--ds-hover) active:bg-(--ds-pressed) ${item.danger ? 'text-(--ds-danger)' : ''}`}
            >
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A "⋯" button that opens a short list of actions under it, right-aligned to
 *  it (menu-d2). The list is a `Menu`; pressing the button again closes it. */
export function MoreMenu<Id extends string>({
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
  const button = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ x: number; y: number }>();
  const [forced, setForced] = useState(Boolean(forceOpen));
  const place = () => {
    const r = button.current?.getBoundingClientRect();
    return r ? { x: r.right - MORE_WIDTH, y: r.bottom + 4 } : undefined;
  };
  useLayoutEffect(() => {
    if (forced) setAt(place());
  }, [forced]);
  const close = () => {
    setAt(undefined);
    setForced(false);
  };
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={at !== undefined}
        data-menu-trigger
        onClick={() => {
          if (at) close();
          else setAt(place());
        }}
        className="inline-flex h-(--ds-control) w-(--ds-control) shrink-0 items-center justify-center rounded-(--ds-radius-control) border border-(--ds-border) text-(--ds-fg) hover:bg-(--ds-hover) active:bg-(--ds-pressed)"
      >
        <Ellipsis className="size-4" aria-hidden />
      </button>
      {at && (
        <Menu
          at={at}
          label={label}
          groups={[{ items }]}
          onPick={(id) => {
            close();
            onSelect?.(id as Id);
          }}
          onClose={close}
        />
      )}
    </>
  );
}

const MORE_WIDTH = 240;
