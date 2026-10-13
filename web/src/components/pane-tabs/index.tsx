import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { IconButton } from '@/components/button';
import { Tooltip } from '@/components/tooltip';
import { cn } from '@/lib/utils';

/** A tab never gets narrower than this (the strip scrolls instead) or wider. */
const TAB_MIN = 144;
const TAB_MAX = 240;

export interface PaneTab {
  id: string;
  /** What kind of thing it is, in words: "Slides". */
  kind: string;
  title: string;
  /** The kind's glyph, `size-4`. */
  icon: ReactNode;
}

/**
 * The tabs of a pane: one per thing opened there, each with its kind's glyph,
 * its title and a close, and whatever the caller puts at the end (the + that
 * opens something else) pinned beside the strip so it never scrolls away.
 * The tab that is shown is marked with Primer's 2px underline, which lands
 * on the strip's own hairline.
 *
 * Tabs share the strip, share the strip between a floor (144px) and a ceiling (240px) and cut their titles
 * short; the full "Kind: title" is the tooltip. Past the floor the strip
 * scrolls sideways, and the tab shown is scrolled into view.
 */
export function PaneTabs({
  label,
  tabs,
  current,
  onSelect,
  onClose,
  end,
}: {
  /** The strip's name for a screen reader: "Open in this pane". */
  label: string;
  tabs: PaneTab[];
  /** The id of the tab shown, if any. */
  current: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  end?: ReactNode;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const endSlot = useRef<HTMLDivElement>(null);
  // Set when a tab is closed: focus follows to the tab now shown, or the +.
  const refocus = useRef(false);

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const next =
      strip.current?.querySelector<HTMLElement>(
        'button[aria-current="true"]',
      ) ?? endSlot.current?.querySelector<HTMLElement>('button');
    next?.focus();
  }, [tabs, current]);

  useEffect(() => {
    if (current === null) return;
    const tab = strip.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    );
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- jsdom has no scrollIntoView
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const close = (id: string) => {
    refocus.current = true;
    onClose(id);
  };

  return (
    <div className="flex h-row shrink-0 items-center border-b bg-rail">
      <div
        ref={strip}
        role="group"
        aria-label={label}
        className="flex h-full min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((t) => {
          const shown = t.id === current;
          return (
            <div
              key={t.id}
              // Tabs share the strip between a floor and a ceiling.
              style={{ minWidth: TAB_MIN, maxWidth: TAB_MAX }}
              className={cn(
                'relative flex h-full flex-1 items-center border-r pr-1',
                shown ? 'bg-background' : 'hover:bg-muted',
              )}
            >
              <Tooltip label={`${t.kind}: ${t.title}`} side="bottom">
                <button
                  type="button"
                  aria-current={shown ? 'true' : undefined}
                  onClick={() => {
                    onSelect(t.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete') close(t.id);
                  }}
                  className={cn(
                    'flex h-full min-w-0 flex-1 items-center gap-2 pl-3 text-left text-sm focus-visible:-outline-offset-2',
                    shown
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="shrink-0 text-muted-foreground [&_svg]:size-4">
                    {t.icon}
                  </span>
                  <span className="truncate">{t.title}</span>
                </button>
              </Tooltip>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={`Close ${t.title}`}
                tabIndex={shown ? 0 : -1}
                onClick={() => {
                  close(t.id);
                }}
                className="shrink-0"
              >
                <X />
              </IconButton>
              {shown && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 border-b-2 border-primary"
                />
              )}
            </div>
          );
        })}
      </div>
      {end && (
        <div ref={endSlot} className="flex shrink-0 items-center px-1">
          {end}
        </div>
      )}
    </div>
  );
}

/**
 * The header of a pane locked to one thing: its kind and its title, the
 * height of a tab strip so the two panes' hairlines line up. No tabs and no
 * close: this pane's thing is what the URL names.
 */
export function PaneHeader({
  kind,
  title,
  icon,
}: Pick<PaneTab, 'kind' | 'title' | 'icon'>) {
  return (
    <div className="flex h-row shrink-0 items-center gap-2 border-b bg-rail px-card">
      <span className="shrink-0 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="shrink-0 text-sm text-muted-foreground">{kind}</span>
      <span className="truncate text-sm font-medium">{title}</span>
    </div>
  );
}
