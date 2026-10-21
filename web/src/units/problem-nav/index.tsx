import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ActionMenu } from '@/units/action-menu';
import { Tooltip } from '@/units/tooltip';
import { LIST_WIDTH, type NavView } from './layout';

export type NavState = 'todo' | 'done' | 'failed' | 'finding';

export type { NavView };

export interface NavItem {
  id: string;
  /** The book's label, "4.62". */
  label: string;
  /** The short generated title, "RC step response". */
  title: string;
  state: NavState;
}

const WORD: Record<NavState, string> = {
  todo: '',
  done: ' · done',
  failed: ' · not found',
  finding: ' · being found',
};

export interface ProblemNavProps {
  view: NavView;
  items: readonly NavItem[];
  /** The id of the problem the student is on. */
  current?: string;
  onJump?: (id: string) => void;
}

const named = (i: number, it: NavItem) => `${String(i + 1)} · ${it.title}`;

function Segments({ items, current, onJump }: Omit<ProblemNavProps, 'view'>) {
  const at = items.findIndex((i) => i.id === current);
  return (
    <div className="min-w-0 space-y-2">
      <ul className="flex min-w-0 gap-1">
        {items.map((it, i) => {
          const here = it.id === current;
          const look =
            it.state === 'failed'
              ? 'bg-(--ds-danger)'
              : it.state === 'done'
                ? 'bg-(--ds-accent-solid)'
                : it.state === 'finding'
                  ? 'border border-dashed border-(--ds-border) bg-transparent'
                  : 'bg-(--ds-border)';
          return (
            <li key={it.id} className="flex min-w-0 flex-1 [&>span]:w-full">
              <Tooltip text={`${named(i, it)}${WORD[it.state]}`}>
                <button
                  type="button"
                  aria-current={here ? 'step' : undefined}
                  aria-label={`Problem ${named(i, it)}${WORD[it.state]}`}
                  onClick={() => {
                    onJump?.(it.id);
                  }}
                  className="group flex h-5 w-full min-w-1 items-center"
                >
                  <span
                    className={`block w-full rounded-(--ds-radius-segment) group-hover:brightness-125 ${here ? 'h-3 outline-2 outline-offset-1 outline-solid outline-(--ds-fg)' : 'h-2'} ${look}`}
                  />
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      <p className="ds-small ds-tabular min-h-5 truncate text-(--ds-fg-muted)">
        {at >= 0
          ? `Problem ${String(at + 1)} of ${String(items.length)} · ${items[at].title}`
          : `${String(items.length)} problems`}
      </p>
    </div>
  );
}

function Numbers({ items, current, onJump }: Omit<ProblemNavProps, 'view'>) {
  return (
    <ul className="flex min-w-0 flex-wrap gap-x-1 gap-y-1">
      {items.map((it, i) => {
        const here = it.id === current;
        const color =
          it.state === 'failed'
            ? 'text-(--ds-danger)'
            : here
              ? 'text-(--ds-fg)'
              : it.state === 'done'
                ? 'text-(--ds-fg-muted)'
                : 'text-(--ds-fg)';
        return (
          <li key={it.id} className="flex">
            <Tooltip text={`${it.title}${WORD[it.state]}`}>
              <button
                type="button"
                aria-current={here ? 'step' : undefined}
                aria-label={`Problem ${named(i, it)}${WORD[it.state]}`}
                onClick={() => {
                  onJump?.(it.id);
                }}
                className={`ds-small ds-tabular inline-flex h-(--ds-control) min-w-8 items-center justify-center gap-1 border-b-2 px-2 hover:bg-(--ds-hover) ${color} ${here ? 'border-(--ds-accent) font-medium' : 'border-transparent'} ${it.state === 'finding' ? 'italic' : ''}`}
              >
                {i + 1}
                {it.state === 'done' && (
                  <Check className="size-3" aria-hidden />
                )}
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

/** The numbers of B, each with its title. Items shrink, their titles
 *  truncating, down to a minimum width; then the row scrolls sideways with a
 *  fade at an edge that has more, and the current item is kept in view. */
function TitledNumbers({
  items,
  current,
  onJump,
}: Omit<ProblemNavProps, 'view'>) {
  const row = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = () => {
    const el = row.current;
    if (!el) return;
    setEdge({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  };
  useEffect(() => {
    const el = row.current;
    const here = el?.querySelector<HTMLElement>('[aria-current="step"]');
    if (el && here) {
      const li = here.closest('li');
      if (li) {
        const pad = 32;
        if (li.offsetLeft - pad < el.scrollLeft)
          el.scrollLeft = li.offsetLeft - pad;
        else if (
          li.offsetLeft + li.offsetWidth + pad >
          el.scrollLeft + el.clientWidth
        )
          el.scrollLeft = li.offsetLeft + li.offsetWidth + pad - el.clientWidth;
      }
    }
    measure();
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [current, items.length]);
  const fade = `linear-gradient(to right, ${edge.left ? 'transparent' : 'black'}, black 32px, black calc(100% - 32px), ${edge.right ? 'transparent' : 'black'})`;
  return (
    <ul
      ref={row}
      onScroll={measure}
      style={{ maskImage: fade, WebkitMaskImage: fade, scrollbarWidth: 'none' }}
      className="flex min-w-0 overflow-x-auto"
    >
      {items.map((it, i) => {
        const here = it.id === current;
        const color =
          it.state === 'failed'
            ? 'text-(--ds-danger)'
            : here
              ? 'text-(--ds-fg)'
              : it.state === 'done'
                ? 'text-(--ds-fg-muted)'
                : 'text-(--ds-fg)';
        return (
          <li
            key={it.id}
            className="flex max-w-60 min-w-20 shrink-0 grow-0 basis-auto [&>span]:w-full"
            style={{ flexShrink: 1 }}
          >
            <Tooltip text={`${named(i, it)}${WORD[it.state]}`}>
              <button
                type="button"
                aria-current={here ? 'step' : undefined}
                aria-label={`Problem ${named(i, it)}${WORD[it.state]}`}
                onClick={() => {
                  onJump?.(it.id);
                }}
                className={`ds-small flex h-(--ds-control) w-full min-w-0 items-center gap-2 border-b-2 px-2 text-left hover:bg-(--ds-hover) ${color} ${here ? 'border-(--ds-accent) font-medium' : 'border-transparent'} ${it.state === 'finding' ? 'italic' : ''}`}
              >
                <span className="ds-tabular shrink-0 text-(--ds-fg-muted)">
                  {i + 1}
                </span>
                <span className="min-w-0 truncate">{it.title}</span>
                {it.state === 'done' && (
                  <Check className="size-3 shrink-0" aria-hidden />
                )}
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

const arrow =
  'inline-flex h-(--ds-control) w-(--ds-control) shrink-0 items-center justify-center rounded-(--ds-radius-control) border border-(--ds-border) text-(--ds-fg) hover:bg-(--ds-hover) active:bg-(--ds-pressed)';

function Picker({ items, current, onJump }: Omit<ProblemNavProps, 'view'>) {
  const at = items.findIndex((i) => i.id === current);
  const go = (to: number) => {
    if (to >= 0 && to < items.length) onJump?.(items[to].id);
  };
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        aria-label="Previous problem"
        onClick={() => {
          go(at - 1);
        }}
        className={arrow}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <span className="flex min-w-0">
        <ActionMenu
          label="Choose a problem"
          trigger={
            <>
              <span className="min-w-0 truncate font-medium">
                {at >= 0 ? named(at, items[at]) : 'Choose a problem'}
              </span>
              <ChevronDown
                className="size-4 shrink-0 text-(--ds-fg-muted)"
                aria-hidden
              />
            </>
          }
          items={items.map((it, i) => ({
            id: it.id,
            label: named(i, it),
            checked: it.state === 'done',
            current: it.id === current,
          }))}
          onSelect={onJump}
        />
      </span>
      <button
        type="button"
        aria-label="Next problem"
        onClick={() => {
          go(at + 1);
        }}
        className={arrow}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function TitledList({ items, current, onJump }: Omit<ProblemNavProps, 'view'>) {
  return (
    <ul
      style={{ width: LIST_WIDTH }}
      className="min-w-0 shrink-0 overflow-hidden rounded-(--ds-radius-control) border border-(--ds-border) p-1"
    >
      {items.map((it, i) => {
        const here = it.id === current;
        return (
          <li key={it.id}>
            <button
              type="button"
              aria-current={here ? 'step' : undefined}
              aria-label={`Problem ${named(i, it)}${WORD[it.state]}`}
              onClick={() => {
                onJump?.(it.id);
              }}
              className={`ds-small flex min-h-(--ds-control) w-full min-w-0 items-center gap-2 rounded-(--ds-radius-segment) px-2 py-1 text-left hover:bg-(--ds-hover) ${here ? 'bg-(--ds-pressed) font-medium text-(--ds-fg)' : it.state === 'failed' ? 'text-(--ds-danger)' : 'text-(--ds-fg)'}`}
            >
              <span className="ds-tabular w-5 shrink-0 text-right text-(--ds-fg-muted)">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{it.title}</span>
              {it.state === 'done' && (
                <Check
                  className="size-3.5 shrink-0 text-(--ds-fg-muted)"
                  aria-hidden
                />
              )}
              {it.state === 'failed' && (
                <span className="ds-label shrink-0">Not found</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Moves through the set without boxes of numbers: the four views of
 *  `NavView`. Each names a problem by its number and short title and jumps
 *  in one click. The list view is drawn at the left of the problem, so the
 *  pane places it (`beside`). */
export function ProblemNav({ view, ...rest }: ProblemNavProps) {
  if (view === 'segments') return <Segments {...rest} />;
  if (view === 'numbers') return <Numbers {...rest} />;
  if (view === 'titled-numbers') return <TitledNumbers {...rest} />;
  if (view === 'picker') return <Picker {...rest} />;
  return <TitledList {...rest} />;
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) motion-reduce:animate-none ${className}`}
    />
  );
}

/** The navigator while the set loads, in its own heights. */
export function ProblemNavSkeleton({
  view,
  count = 8,
}: {
  view: NavView;
  count?: number;
}) {
  const each = Array.from({ length: count }, (_, i) => i);
  if (view === 'segments')
    return (
      <div aria-hidden className="space-y-2">
        <div className="flex h-5 items-center gap-1">
          {each.map((i) => (
            <Bar key={i} className="h-2 flex-1" />
          ))}
        </div>
        <div className="flex h-5 items-center">
          <Bar className="h-4 w-56" />
        </div>
      </div>
    );
  if (view === 'titled-numbers')
    return (
      <div aria-hidden className="flex h-(--ds-control) items-center gap-1">
        {each.map((i) => (
          <Bar key={i} className="mx-2 h-4 w-24" />
        ))}
      </div>
    );
  if (view === 'numbers')
    return (
      <div aria-hidden className="flex h-(--ds-control) items-center gap-1">
        {each.map((i) => (
          <Bar key={i} className="mx-2 h-4 w-4" />
        ))}
      </div>
    );
  if (view === 'picker')
    return (
      <div aria-hidden className="flex items-center gap-2">
        <span className={`${arrow} border-(--ds-border-muted)`} />
        <span className="h-(--ds-control) flex-1 rounded-(--ds-radius-control) border border-(--ds-border-muted)" />
        <span className={`${arrow} border-(--ds-border-muted)`} />
      </div>
    );
  return (
    <div
      aria-hidden
      style={{ width: LIST_WIDTH }}
      className="shrink-0 space-y-0 rounded-(--ds-radius-control) border border-(--ds-border-muted) p-1"
    >
      {each.map((i) => (
        <div key={i} className="flex min-h-(--ds-control) items-center px-2">
          <Bar className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
