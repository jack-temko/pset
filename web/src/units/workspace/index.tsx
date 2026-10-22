import { useRef, useState } from 'react';

import { Divider } from '@/units/divider';
import type { MenuGroup } from '@/units/menu';
import {
  AskStub,
  AskStubSkeleton,
  MaterialStub,
  MaterialStubSkeleton,
  WorkStub,
  WorkStubSkeleton,
} from '@/units/pane-stub';
import { DropFill, Side } from '@/units/side';
import { type TabAction } from '@/units/tabs';
import { endDrag, useDraggedTab } from '@/units/tabs/drag';
import { TopBar } from '@/units/top-bar';

import { aboutOf, materialOf, setOf, tabLabel, type Course } from './course';
import * as m from './model';

/** The least width of a side; the divider stops here (workspace-d3). */
export const SIDE_MIN = 360;

const SIDES = [0, 1] as const;
const NAMES = ['Left side', 'Right side'] as const;

/** What a side's + menu offers (workspace-d10): the course's materials, its
 *  other sets, and Ask. */
function offer(course: Course, st: m.State): MenuGroup[] {
  const open = new Set(
    SIDES.flatMap((s) => st.sides[s])
      .filter((t) => t.kind === 'set')
      .map((t) => t.ref),
  );
  const sets = course.sets.filter((s) => !open.has(s.id));
  return [
    {
      label: 'Materials',
      items: course.materials.map((x) => ({ id: `m:${x.id}`, label: x.name })),
    },
    ...(sets.length > 0
      ? [
          {
            label: 'Sets',
            items: sets.map((s) => ({ id: `s:${s.id}`, label: s.name })),
          },
        ]
      : []),
    { items: [{ id: 'a', label: 'Ask' }] },
  ];
}

function pick(id: string): m.Spec {
  if (id === 'a') return { kind: 'ask', ref: '' };
  const [k, ref] = id.split(':');
  return k === 'm' ? { kind: 'material', ref, page: 1 } : { kind: 'set', ref };
}

/** Whether a tab is the only one of the only side open. */
const onlyTab = (st: m.State, id: string) =>
  st.sides[0].length + st.sides[1].length === 1 && m.find(st, id) !== undefined;

/** The height of a side's tab row, which the split zones leave alone. */
const TAB_ROW = 45;

/** VS Code's thirds (workspace-d14): while a tab is dragged over the one open
 *  side's pane, its outer left third shows the fill over the left half and its
 *  outer right third over the right half; the middle third shows nothing and
 *  takes no drop. The tab row below it is left to its own insertion bar. */
function SplitZones({
  row,
  onDrop,
}: {
  row: React.RefObject<HTMLDivElement | null>;
  onDrop: (edge: m.Side) => void;
}) {
  const [zone, setZone] = useState<m.Side | null>(null);
  const at = (x: number): m.Side | null => {
    const r = row.current?.getBoundingClientRect();
    if (!r) return null;
    const f = (x - r.left) / r.width;
    return f < 1 / 3 ? 0 : f > 2 / 3 ? 1 : null;
  };
  return (
    <>
      <div
        onDragOver={(e) => {
          const z = at(e.clientX);
          setZone(z);
          if (z !== null) e.preventDefault();
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setZone(null);
        }}
        onDrop={(e) => {
          const z = at(e.clientX);
          setZone(null);
          if (z === null) return;
          e.preventDefault();
          onDrop(z);
        }}
        style={{ top: TAB_ROW }}
        className="absolute inset-x-0 bottom-0 z-20"
      />
      {zone !== null && (
        <div
          className={`pointer-events-none absolute inset-y-0 z-10 w-1/2 ${zone === 0 ? 'left-0' : 'right-0'}`}
        >
          <DropFill />
        </div>
      )}
    </>
  );
}

/** The workspace (S5 to S9, W1 to W15): the top bar with the path, then two
 *  sides under it, each with its own tabs, split by a divider. Everything open
 *  is one `State` (the address would hold it); it reads sample data until the
 *  panes are designed. Desktop only: there is no layout for a narrow window
 *  (workspace-d8). */
export function Workspace({
  course,
  initial,
  loading,
  onChange,
  homeHref = '/',
  courseHref = '#',
  settingsHref = '/settings',
}: {
  course: Course;
  initial: m.State;
  /** Which sides are still loading their pane; the tab row never waits. */
  loading?: { left?: boolean; right?: boolean };
  onChange?: (state: m.State) => void;
  homeHref?: string;
  courseHref?: string;
  settingsHref?: string;
}) {
  const [st, setState] = useState(initial);
  const row = useRef<HTMLDivElement>(null);
  const dragged = useDraggedTab();
  const apply = (f: (s: m.State) => m.State) => {
    const next = f(st);
    setState(next);
    onChange?.(next);
  };

  const folded = m.foldedSide(st);
  const empty = st.sides[0].length === 0 && st.sides[1].length === 0;
  const shown = empty
    ? [0 as const]
    : SIDES.filter((s) => s !== folded && st.sides[s].length > 0);
  const both = shown.length === 2;

  const move = (x: number) => {
    const r = row.current?.getBoundingClientRect();
    if (!r) return;
    const lo = SIDE_MIN;
    const hi = r.width - SIDE_MIN - 1;
    const px = Math.max(lo, Math.min(x - r.left, Math.max(lo, hi)));
    apply((s) => m.setSplit(s, px / r.width));
  };

  const showingSet = m.showing(st).find((t) => t.kind === 'set');
  const anySet = SIDES.flatMap((s) => st.sides[s]).find(
    (t) => t.kind === 'set',
  );
  const current = setOf(course, (showingSet ?? anySet)?.ref ?? '');
  const path = [
    current ? { label: course.name, href: courseHref } : { label: course.name },
    ...(current ? [{ label: current.name }] : []),
  ];

  const body = (side: m.Side) => {
    const tab = m.openTab(st, side);
    if (!tab) return null;
    const wait = side === 0 ? loading?.left : loading?.right;
    if (tab.kind === 'set') {
      const set = setOf(course, tab.ref);
      if (wait || !set) return <WorkStubSkeleton />;
      return (
        <WorkStub
          name={set.name}
          material={materialOf(course, set.material)?.name ?? set.material}
          problems={set.problems}
          onPage={(page) => {
            apply((s) => m.follow(s, side, set.material, page));
          }}
          onAsk={(problem) => {
            apply((s) => m.askAbout(s, side, problem));
          }}
        />
      );
    }
    if (tab.kind === 'material') {
      if (wait) return <MaterialStubSkeleton />;
      return (
        <MaterialStub
          name={materialOf(course, tab.ref)?.name ?? tab.ref}
          page={tab.page ?? 1}
        />
      );
    }
    if (wait) return <AskStubSkeleton />;
    return <AskStub about={aboutOf(course, tab.problem)} />;
  };

  const sideView = (side: m.Side) => (
    <Side
      key={side}
      label={NAMES[side]}
      tabs={st.sides[side].map((t) => ({
        id: t.id,
        ...tabLabel(course, t),
      }))}
      open={st.open[side]}
      add={offer(course, st)}
      body={
        empty ? (
          <p className="ds-small p-6 text-(--ds-fg-muted)">
            Nothing is open. Use + to open a set, a material or Ask.
          </p>
        ) : (
          body(side)
        )
      }
      onOpen={(id) => {
        apply((s) => m.select(s, id));
      }}
      onClose={(id) => {
        apply((s) => m.close(s, id));
      }}
      onAdd={(id) => {
        apply((s) => m.add(s, side, pick(id)));
      }}
      onAction={(id, action: TabAction) => {
        apply((s) =>
          action === 'move'
            ? m.move(s, id, m.other(side), undefined)
            : action === 'swap'
              ? m.swap(s)
              : action === 'close'
                ? m.close(s, id)
                : m.closeOthers(s, id),
        );
      }}
      onDropTab={(id, before) => {
        apply((s) => m.move(s, id, side, before));
      }}
    />
  );

  return (
    <div className="flex h-full min-w-0 flex-col bg-(--ds-bg)">
      <TopBar homeHref={homeHref} path={path} settingsHref={settingsHref} />
      <div ref={row} className="relative flex min-h-0 flex-1">
        {shown.map((side, i) => (
          <div
            key={side}
            className="flex min-w-0"
            style={
              both
                ? {
                    flex: `${String(side === 0 ? st.split : 1 - st.split)} 1 0`,
                    minWidth: SIDE_MIN,
                  }
                : { flex: '1 1 0' }
            }
          >
            {i === 1 && (
              <Divider
                onMove={move}
                onReset={() => {
                  apply((s) => m.setSplit(s, 0.5));
                }}
              />
            )}
            <div className="min-w-0 flex-1">{sideView(side)}</div>
          </div>
        ))}
        {dragged && folded !== undefined && !onlyTab(st, dragged) && (
          <SplitZones
            row={row}
            onDrop={(edge) => {
              apply((s) => m.splitOpen(s, dragged, edge));
              endDrag();
            }}
          />
        )}
      </div>
    </div>
  );
}
