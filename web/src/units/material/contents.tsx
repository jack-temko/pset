import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Section } from './types';

/** The deepest section that starts on or before a printed page. */
function currentOf(
  tree: readonly Section[],
  printed: number | undefined,
): readonly Section[] {
  if (printed === undefined) return [];
  let found: Section[] = [];
  const walk = (list: readonly Section[], path: Section[]) => {
    for (const s of list) {
      if (s.page > printed) return;
      found = [...path, s];
      if (s.sections) walk(s.sections, found);
    }
  };
  walk(tree, []);
  return found;
}

/** The list over the pages (M3, A2): chapters and their sections, the
 *  section you are in marked, anything deeper folded under its section. A pick
 *  goes to the page; over the pages the pane closes the list, beside them
 *  (D16) it stays and follows the page. */
export function Contents({
  name,
  tree,
  printed,
  beside,
  onPick,
}: {
  name: string;
  tree: readonly Section[];
  /** The printed page the student is on, if it has one. */
  printed: number | undefined;
  /** Beside the pages (a column that stays open) rather than over them. */
  beside: boolean;
  onPick: (page: number) => void;
}) {
  const here = currentOf(tree, printed);
  const [open, setOpen] = useState<ReadonlySet<Section>>(
    () => new Set(here.length > 2 ? [here[1]] : []),
  );
  /** The row marked: the deepest one that is shown. A section folded over the
   *  one you are in is marked in its place. */
  const [picked, setPicked] = useState<{
    section: Section;
    from: number | undefined;
  }>();
  // A picked row is marked at once; the page's own answer takes over when the
  // page you are on changes.
  const held = picked && picked.from === printed ? picked.section : undefined;
  const marked =
    held ??
    (here.length > 2 && open.has(here[1])
      ? here[2]
      : here[Math.min(here.length, 2) - 1]);
  const panel = useRef<HTMLDivElement>(null);
  const placed = useRef(false);
  const markedRow = useRef<HTMLDivElement>(null);
  // The marked section is brought to the middle when the list opens and when
  // the marked one changes, not on every render.
  useEffect(() => {
    const row = markedRow.current;
    const box = panel.current;
    if (!row || !box) return;
    // Beside the pages the list follows the page quietly: it moves only when
    // the marked row has left the view.
    const seen =
      row.offsetTop >= box.scrollTop &&
      row.offsetTop + row.offsetHeight <= box.scrollTop + box.clientHeight;
    if (!(beside && seen && placed.current))
      box.scrollTop = row.offsetTop - box.clientHeight / 2;
    placed.current = true;
  }, [marked, beside]);
  const toggle = (s: Section) => {
    setOpen((o) => {
      const next = new Set(o);
      if (!next.delete(s)) next.add(s);
      return next;
    });
  };

  const row = (s: Section, level: number) => {
    const folded = s.sections !== undefined && level === 1;
    const expanded = open.has(s);
    const isMarked = s === marked;
    return (
      <div key={s.title}>
        <div
          className={`group mx-2 flex items-start rounded-(--ds-radius-control) hover:bg-(--ds-hover) has-focus-visible:outline-(length:--ds-focus-width) has-focus-visible:outline-(--ds-accent) has-focus-visible:outline-solid has-focus-visible:outline-offset-(--ds-focus-offset) ${isMarked ? 'bg-(--ds-hover)' : ''}`}
          style={{ paddingLeft: level * 16 }}
          ref={isMarked ? markedRow : undefined}
        >
          <span className="flex h-8 w-6 shrink-0 items-center justify-center">
            {folded && (
              <button
                type="button"
                aria-label={expanded ? 'Fold' : 'Unfold'}
                aria-expanded={expanded}
                onClick={() => {
                  toggle(s);
                }}
                className="flex size-6 items-center justify-center text-(--ds-fg-muted) outline-none! group-hover:text-(--ds-fg)"
              >
                <ChevronRight
                  className={`size-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                  aria-hidden
                />
              </button>
            )}
          </span>
          <button
            type="button"
            aria-current={isMarked ? 'location' : undefined}
            onClick={() => {
              setPicked({ section: s, from: printed });
              onPick(s.page);
            }}
            className={`ds-small flex min-h-8 min-w-0 flex-1 items-start justify-between gap-3 py-1 pr-3 text-left outline-none! ${level === 0 ? 'font-medium' : ''} ${isMarked ? 'font-medium text-(--ds-accent)' : ''}`}
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">{s.title}</span>
            <span className="ds-tabular shrink-0 text-(--ds-fg-muted)">
              {s.page}
            </span>
          </button>
        </div>
        {s.sections &&
          (level === 0 || expanded) &&
          s.sections.map((c) => row(c, level + 1))}
      </div>
    );
  };

  return (
    <div
      data-contents
      ref={panel}
      className={
        beside
          ? 'relative w-72 shrink-0 overflow-y-auto border-r border-(--ds-border-muted) bg-(--ds-bg) py-2'
          : 'absolute inset-0 z-10 overflow-y-auto border-b border-(--ds-border-muted) bg-(--ds-bg) py-2'
      }
    >
      <p className="ds-label px-4 pt-1 pb-2 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
        {name}
      </p>
      {tree.map((s) => row(s, 0))}
    </div>
  );
}
