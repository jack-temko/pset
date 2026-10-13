import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/button';
import { Menu, MenuItem, MenuLabel } from '@/components/menu';
import { PaneHeader, PaneTabs } from '@/components/pane-tabs';
import { Split } from '@/components/split';
import { cn } from '@/lib/utils';
import {
  byKind,
  KIND_WORD,
  kindIcon,
  type OpenThing,
  type Place,
  type Thing,
} from './things';

/** A thing opened on the left, and where in it it was opened. */
export interface DockTab {
  thing: Thing;
  place?: Place;
}

/** What the left pane starts with. */
export interface DockStart {
  tabs: DockTab[];
  /** The id of the tab shown; the last one if absent. */
  shown?: string;
}

/**
 * The dock: a split of two panes. The right is locked to the thing the URL
 * names, under a slim header; the left starts empty and takes tabs, one per
 * thing the student opens with its +. The seam moves, there is no other
 * arrangement.
 *
 * The dock does not know what a view is. It is given the thing on the right,
 * the course's openable things and `render`, which draws a thing at an
 * optional place, and it hands `render` the one call a view may make to open
 * another thing on the left (A6). Every tab stays mounted while hidden, so a
 * page keeps its scroll. It never navigates: the way out of the course is
 * the screen's, not the dock's.
 */
export function Dock({
  courseId,
  right,
  things,
  render,
  start,
}: {
  /** The course: the split's ratio is saved under it. */
  courseId: string;
  /** The thing the URL names. */
  right: Thing;
  /** Everything the course has to open, the thing on the right included. */
  things: Thing[];
  render: (
    thing: Thing,
    place: Place | undefined,
    open: OpenThing,
  ) => ReactNode;
  start?: DockStart;
}) {
  const [allTabs, setTabs] = useState<DockTab[]>(() => start?.tabs ?? []);
  const [shownId, setShown] = useState<string | null>(
    () => start?.shown ?? start?.tabs.at(-1)?.thing.id ?? null,
  );
  const [rightPlace, setRightPlace] = useState<Place | undefined>();

  // The right pane's thing is never also a left tab, whichever way it got there.
  const tabs = allTabs.filter((t) => t.thing.id !== right.id);
  const shown =
    tabs.find((t) => t.thing.id === shownId)?.thing.id ??
    tabs.at(-1)?.thing.id ??
    null;

  const open: OpenThing = (thing, place) => {
    if (thing.id === right.id) {
      // Already the right pane's: it goes to the place, it does not open twice.
      if (place) setRightPlace(place);
      return;
    }
    setTabs((ts) =>
      ts.some((t) => t.thing.id === thing.id)
        ? ts.map((t) =>
            t.thing.id === thing.id ? { ...t, place: place ?? t.place } : t,
          )
        : [...ts, { thing, place }],
    );
    setShown(thing.id);
  };

  const close = (id: string) => {
    const i = tabs.findIndex((t) => t.thing.id === id);
    const rest = tabs.filter((t) => t.thing.id !== id);
    setTabs(rest);
    if (shown === id)
      setShown(rest[Math.min(i, rest.length - 1)]?.thing.id ?? null);
  };

  const openable = things.filter((t) => t.id !== right.id);
  const openIds = new Set(tabs.map((t) => t.thing.id));

  return (
    <Split
      id={courseId}
      className="h-full bg-background"
      left={
        <>
          <PaneTabs
            label="Open here"
            tabs={tabs.map(({ thing }) => ({
              id: thing.id,
              kind: KIND_WORD[thing.kind].one,
              title: thing.title,
              icon: kindIcon(thing.kind),
            }))}
            current={shown}
            onSelect={setShown}
            onClose={close}
            end={
              <Menu label="Open in this pane" icon={<Plus />}>
                {byKind(openable).map((g) => (
                  <div key={g.kind}>
                    <MenuLabel>{KIND_WORD[g.kind].many}</MenuLabel>
                    {g.things.map((t) => (
                      <MenuItem
                        key={t.id}
                        icon={kindIcon(t.kind)}
                        hint={openIds.has(t.id) ? 'Open' : undefined}
                        current={t.id === shown}
                        onSelect={() => {
                          open(t);
                        }}
                      >
                        {t.title}
                      </MenuItem>
                    ))}
                  </div>
                ))}
                {openable.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">
                    Nothing else in this course yet.
                  </p>
                )}
              </Menu>
            }
          />
          <div className="relative min-h-0 flex-1">
            {tabs.length === 0 && (
              <Empty
                things={openable}
                onPick={(t) => {
                  open(t);
                }}
              />
            )}
            {tabs.map((t) => (
              <div
                key={t.thing.id}
                inert={t.thing.id !== shown}
                className={cn(
                  'absolute inset-0',
                  t.thing.id !== shown && 'invisible',
                )}
              >
                {render(t.thing, t.place, open)}
              </div>
            ))}
          </div>
        </>
      }
      right={
        <>
          <PaneHeader
            kind={KIND_WORD[right.kind].one}
            title={right.title}
            icon={kindIcon(right.kind)}
          />
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0">
              {render(right, rightPlace, open)}
            </div>
          </div>
        </>
      }
    />
  );
}

/** The left pane with nothing in it: one line, and the list the + shows, so
 *  the first thing beside the work is one click. */
function Empty({
  things,
  onPick,
}: {
  things: Thing[];
  onPick: (t: Thing) => void;
}) {
  return (
    <div className="absolute inset-0 overflow-y-auto p-card">
      <p className="px-2 pb-2 text-sm text-muted-foreground">
        Nothing is open here. Pick something to read beside your work.
      </p>
      {byKind(things).map((g) => (
        <section key={g.kind} aria-label={KIND_WORD[g.kind].many}>
          <h3 className="px-2 pt-3 pb-1 text-xs text-muted-foreground">
            {KIND_WORD[g.kind].many}
          </h3>
          {g.things.map((t) => (
            <Button
              key={t.id}
              variant="ghost"
              onClick={() => {
                onPick(t);
              }}
              className="h-row w-full justify-start gap-3 px-2 font-normal [&_svg]:size-4 [&_svg]:text-muted-foreground"
            >
              {kindIcon(t.kind)}
              <span className="truncate">{t.title}</span>
            </Button>
          ))}
        </section>
      ))}
    </div>
  );
}
