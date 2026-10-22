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
 *  goes to the page; the pane closes the list. */
export function Contents({
  name,
  tree,
  printed,
  onPick,
}: {
  name: string;
  tree: readonly Section[];
  /** The printed page the student is on, if it has one. */
  printed: number | undefined;
  onPick: (page: number) => void;
}) {
  const here = currentOf(tree, printed);
  /** The row marked: the deepest one that is shown (two levels). */
  const marked = here[Math.min(here.length, 2) - 1];
  const [open, setOpen] = useState<ReadonlySet<Section>>(
    () => new Set(here.length > 2 ? [here[1]] : []),
  );
  const panel = useRef<HTMLDivElement>(null);
  const markedRow = useRef<HTMLDivElement>(null);
  // The marked section is brought to the middle when the list opens and when
  // the marked one changes, not on every render.
  useEffect(() => {
    const row = markedRow.current;
    const box = panel.current;
    if (row && box) box.scrollTop = row.offsetTop - box.clientHeight / 2;
  }, [marked]);
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
          className={`flex items-start ${isMarked ? 'bg-(--ds-hover)' : ''}`}
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
                className="flex size-6 items-center justify-center rounded-(--ds-radius-tag) text-(--ds-fg-muted) hover:bg-(--ds-pressed)"
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
              onPick(s.page);
            }}
            className={`ds-small flex min-h-8 min-w-0 flex-1 items-start justify-between gap-3 py-1 pr-3 text-left hover:bg-(--ds-hover) ${level === 0 ? 'font-medium' : ''} ${isMarked ? 'font-medium text-(--ds-accent)' : ''}`}
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
      className="absolute inset-x-0 top-11 bottom-0 z-10 overflow-y-auto border-b border-(--ds-border-muted) bg-(--ds-bg) py-2"
    >
      <p className="ds-label px-4 pt-1 pb-2 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
        {name}
      </p>
      {tree.map((s) => row(s, 0))}
    </div>
  );
}
