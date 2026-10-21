import { Plus, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Menu, type MenuGroup } from '@/units/menu';
import { draggedTab, endDrag, startDrag } from './drag';

export interface TabItem {
  id: string;
  label: string;
  /** Dim text after the label, separated by a space: a material's page. */
  note?: string;
}

export type TabAction = 'move' | 'swap' | 'close' | 'close-others';

const TAB_MENU: MenuGroup[] = [
  {
    items: [
      { id: 'move', label: 'Move to other side' },
      { id: 'swap', label: 'Swap sides' },
    ],
  },
  {
    items: [
      { id: 'close', label: 'Close' },
      { id: 'close-others', label: 'Close others' },
    ],
  },
];

const FADE = 24;

/** The mask that fades an edge the row scrolls past. */
function fade(left: boolean, right: boolean) {
  if (!left && !right) return undefined;
  const g = `linear-gradient(to right, ${left ? `transparent 0, black ${String(FADE)}px` : 'black 0'}, ${right ? `black calc(100% - ${String(FADE)}px), transparent 100%` : 'black 100%'})`;
  return { maskImage: g, WebkitMaskImage: g };
}

/** A side's tabs as GitHub underline tabs (tabs-d1): text, an accent line
 *  under the open one, a close x on hover and on the open tab, and a + at the
 *  end. Too many shrink to a minimum and then scroll sideways with a fade at
 *  the edge (tabs-d3). Tabs drag within the row and across to another side. */
export function Tabs({
  label,
  tabs,
  open,
  add,
  onOpen,
  onClose,
  onAdd,
  onAction,
  onDropTab,
  forceMenu,
  forceHover,
  forceDropBefore,
}: {
  /** The row's name. */
  label: string;
  tabs: readonly TabItem[];
  open: string | null;
  /** What the + menu offers. */
  add: readonly MenuGroup[];
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: (id: string) => void;
  onAction: (tab: string, action: TabAction) => void;
  /** A dragged tab dropped before another tab, or at the end (null). */
  onDropTab: (tab: string, before: string | null) => void;
  /** Opens the + menu or a tab's menu, for the design page. */
  forceMenu?: 'add' | 'tab';
  /** Draws the hover look on this tab (the design page only). */
  forceHover?: string;
  /** Draws the drop bar before this tab, or at the end with null (the design page only). */
  forceDropBefore?: string | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [menu, setMenu] = useState<
    { kind: 'add' | 'tab'; tab?: string; x: number; y: number } | undefined
  >();
  const [dropped, setDropBefore] = useState<string | null | undefined>();
  const dropBefore = forceDropBefore === undefined ? dropped : forceDropBefore;

  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) =>
      e.left === left && e.right === right ? e : { left, right },
    );
  };
  useLayoutEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [tabs.length]);

  // The open tab stays in view.
  useEffect(() => {
    const el = scroller.current?.querySelector('[aria-selected="true"]');
    if (el && typeof el.scrollIntoView === 'function')
      el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [open]);

  useEffect(() => {
    if (!forceMenu) return;
    const el =
      forceMenu === 'add'
        ? addButton.current
        : scroller.current?.querySelector<HTMLElement>('[role="tab"]');
    const r = el?.getBoundingClientRect();
    if (r)
      setMenu({
        kind: forceMenu,
        tab: tabs[0]?.id,
        x: r.left,
        y: r.bottom + 4,
      });
  }, [forceMenu, tabs]);

  const closeMenu = () => {
    setMenu(undefined);
  };

  const dragOver = (
    e: React.DragEvent,
    over: string | null,
    next: string | null,
  ) => {
    if (!draggedTab()) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (over === null) {
      setDropBefore(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setDropBefore(e.clientX < r.left + r.width / 2 ? over : next);
  };
  const drop = (e: React.DragEvent) => {
    const id = draggedTab();
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    onDropTab(id, dropBefore ?? null);
    setDropBefore(undefined);
    endDrag();
  };

  return (
    <div
      className="relative flex h-[45px] min-w-0 items-stretch border-b border-(--ds-border-muted)"
      onDragOver={(e) => {
        dragOver(e, null, null);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDropBefore(undefined);
      }}
      onDrop={drop}
    >
      <div
        ref={scroller}
        role="tablist"
        aria-label={label}
        onScroll={measure}
        style={fade(edges.left, edges.right)}
        className="-mb-px flex h-[45px] min-w-0 items-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t, i) => {
          const active = t.id === open;
          const next = tabs.at(i + 1)?.id ?? null;
          return (
            <div
              key={t.id}
              role="tab"
              tabIndex={0}
              aria-selected={active}
              title={t.note ? `${t.label} ${t.note}` : t.label}
              draggable
              onDragStart={(e) => {
                startDrag(t.id, e);
              }}
              onDragEnd={() => {
                setDropBefore(undefined);
                endDrag();
              }}
              onDragOver={(e) => {
                dragOver(e, t.id, next);
              }}
              onDrop={drop}
              onClick={() => {
                onOpen(t.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(t.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ kind: 'tab', tab: t.id, x: e.clientX, y: e.clientY });
              }}
              className={`group/tab relative flex min-w-28 max-w-60 shrink cursor-default items-center gap-1 border-b-2 pr-1.5 pl-3 select-none ${
                active
                  ? 'border-(--ds-accent) text-(--ds-fg)'
                  : `border-transparent hover:text-(--ds-fg) ${forceHover === t.id ? 'text-(--ds-fg)' : 'text-(--ds-fg-muted)'}`
              }`}
            >
              {dropBefore === t.id && (
                <span className="absolute inset-y-2 left-0 w-0.5 bg-(--ds-accent)" />
              )}
              {dropBefore === null && i === tabs.length - 1 && (
                <span className="absolute inset-y-2 right-0 w-0.5 bg-(--ds-accent)" />
              )}
              <span
                className={`ds-body flex min-w-0 flex-1 items-baseline gap-1 ${active ? 'font-medium' : ''}`}
              >
                <span className="min-w-0 truncate">{t.label}</span>
                {t.note && (
                  <span className="shrink-0 font-normal opacity-60">
                    {t.note}
                  </span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Close ${t.label}${t.note ? ` ${t.note}` : ''}`}
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t.id);
                }}
                className={`flex size-5 shrink-0 items-center justify-center rounded-(--ds-radius-control) hover:bg-(--ds-hover) ${active ? 'text-(--ds-fg)' : forceHover === t.id ? 'text-(--ds-fg-muted)' : 'text-(--ds-fg-muted) opacity-50 group-hover/tab:opacity-100'}`}
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-1 px-1">
        <button
          ref={addButton}
          type="button"
          aria-label="Open something"
          data-menu-trigger
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMenu((m) =>
              m?.kind === 'add'
                ? undefined
                : { kind: 'add', x: r.left, y: r.bottom + 4 },
            );
          }}
          className="flex size-8 items-center justify-center rounded-(--ds-radius-control) text-(--ds-fg-muted) hover:bg-(--ds-hover) hover:text-(--ds-fg) active:bg-(--ds-pressed)"
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
      {menu && (
        <Menu
          at={menu}
          label={menu.kind === 'add' ? 'Open' : 'Tab'}
          groups={menu.kind === 'add' ? add : TAB_MENU}
          onClose={closeMenu}
          onPick={(id) => {
            const tab = menu.tab;
            closeMenu();
            if (menu.kind === 'add') onAdd(id);
            else if (tab) onAction(tab, id as TabAction);
          }}
        />
      )}
    </div>
  );
}
