import { useEffect, useRef, useState } from 'react';

import { ActionMenu, type MenuItem } from '@/units/action-menu';
import { Button } from '@/units/button';
import { FinishCard } from '@/units/finish-card';
import { List } from '@/units/list';
import { ListRow } from '@/units/list-row';
import { Problem, ProblemSkeleton, type Fix } from '@/units/problem';
import {
  HELP_KINDS,
  type ProblemData,
  type ProblemMenuItem,
} from '@/units/problem/types';
import {
  ProblemStrip,
  ProblemStripSkeleton,
  type Chip,
  type Marker,
} from '@/units/problem-strip';
import { DueStatus } from '@/units/set-line';
import { dueBadge } from '@/units/set-line/badge';
import { timeLeft } from '@/units/set-line/dates';
import { Tag } from '@/units/tag';
import { sessionMemory, type Memory } from './memory';
import {
  doneCount,
  UNDO_MS,
  nextUnfinished,
  type SetMenuItem,
  type WorkSet,
} from './sets';

const SET_MENU: readonly MenuItem<SetMenuItem>[] = [
  { id: 'add', label: 'Add problems' },
  { id: 'box', label: 'Box one on the page' },
  { id: 'edit', label: 'Edit' },
  { id: 'print', label: 'Print worksheet' },
  { id: 'delete', label: 'Delete', danger: true },
];

interface Notice {
  text: string;
  undo: () => void;
}

export interface WorkProps {
  set: WorkSet;
  /** Where to start: a problem's id. Without it the pane goes to where the
   *  student left (S8), else the first problem still to do. */
  startAt?: string;
  /** Start on the finish card. */
  startFinish?: boolean;
  /** How the current problem is marked in the strip. */
  marker?: Marker;
  /** Where the place is kept. */
  memory?: Memory;
  /** The day "Due soon" counts from (the design page and tests). */
  today?: Date;
  /** The page link: turn the material to this page and outline the problem's
   *  box (P11). */
  onOpenPage?: (page: number, problemId: string) => void;
  /** Ask about this: open Ask with the problem as its chip (P6). */
  onAsk?: (problemId: string) => void;
  onBackToCourse?: () => void;
  onSetMenu?: (item: SetMenuItem) => void;
  onProblemMenu?: (item: ProblemMenuItem, problemId: string) => void;
  onFix?: (fix: Fix, problemId: string) => void;
}

/** The pane for one problem set: the set line, a strip of every problem,
 *  the one you are on, and at the end a finish card (P1, P5, P12). It keeps
 *  its own marks while it is open and tells the workspace what to open
 *  through its callbacks. */
export function Work({
  set,
  startAt,
  startFinish = false,
  marker,
  memory = sessionMemory,
  today,
  onOpenPage,
  onAsk,
  onBackToCourse,
  onSetMenu,
  onProblemMenu,
  onFix,
}: WorkProps) {
  const [problems, setProblems] = useState(set.problems);
  const [current, setCurrent] = useState(() => {
    const wanted = startAt ?? memory.get(set.id);
    const there = set.problems.find((p) => p.id === wanted);
    return (
      there?.id ??
      set.problems.find((p) => !p.done)?.id ??
      (set.problems.length > 0 ? set.problems[0].id : '')
    );
  });
  const [seen, setSeen] = useState<ReadonlySet<string>>(
    () => new Set(current ? [current] : []),
  );
  const [finish, setFinish] = useState(startFinish);
  const [turnedIn, setTurnedIn] = useState(Boolean(set.turnedIn));
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const show = (n: Notice) => {
    clearTimeout(timer.current);
    setNotice(n);
    timer.current = setTimeout(() => {
      setNotice(null);
    }, UNDO_MS);
  };

  const go = (id: string) => {
    setCurrent(id);
    setSeen((s) => new Set(s).add(id));
    setFinish(false);
    memory.set(set.id, id);
  };

  const chipOf = (p: ProblemData): Chip => {
    const base = { id: p.id, label: p.label, title: p.title };
    if (p.done) return { ...base, state: 'done', word: 'Done' };
    if (p.found.status === 'failed')
      return { ...base, state: 'failed', word: 'Not found' };
    if (p.found.status === 'finding')
      return { ...base, state: 'working', word: 'Finding the problem' };
    if (p.found.status === 'queued')
      return { ...base, state: 'queued', word: 'Queued' };
    if (HELP_KINDS.some((k) => p.help[k].status === 'writing'))
      return { ...base, state: 'working', word: 'Writing the guide' };
    if (p.started || seen.has(p.id))
      return { ...base, state: 'started', word: 'Started' };
    return { ...base, state: 'todo', word: 'Not started' };
  };

  const done = doneCount(problems);
  const all = problems.length > 0 && done === problems.length;
  const here = problems.find((p) => p.id === current);
  const index = problems.findIndex((p) => p.id === current);
  const after = here ? nextUnfinished(problems, here.id) : undefined;
  const lone = after === here?.id;

  const mark = (id: string, value: boolean) => {
    const next = problems.map((p) => (p.id === id ? { ...p, done: value } : p));
    setProblems(next);
    setFinish(value && next.every((p) => p.done));
  };

  const next = () => {
    if (!here) return;
    if (all) setFinish(true);
    else if (after !== undefined && !lone) go(after);
  };

  const remove = (id: string) => {
    const at = problems.findIndex((p) => p.id === id);
    const gone = problems[at];
    const rest = problems.filter((p) => p.id !== id);
    setProblems(rest);
    if (rest.length > 0) go(rest[Math.min(at, rest.length - 1)].id);
    setFinish(rest.length > 0 && rest.every((p) => p.done));
    show({
      text: `Removed ${gone.label}`,
      undo: () => {
        setProblems([...rest.slice(0, at), gone, ...rest.slice(at)]);
        go(gone.id);
        setNotice(null);
      },
    });
  };

  const turnIn = () => {
    setAsking(false);
    setTurnedIn(true);
    onSetMenu?.('turn-in');
  };
  const wantTurnIn = () => {
    if (done < problems.length) setAsking(true);
    else turnIn();
  };
  const takeBack = () => {
    setTurnedIn(false);
    setAsking(false);
    onSetMenu?.('take-back');
  };

  const menu: readonly MenuItem<SetMenuItem>[] = [
    ...SET_MENU.slice(0, 4),
    turnedIn
      ? { id: 'take-back', label: 'Take back' }
      : { id: 'turn-in', label: 'Turn in' },
    SET_MENU[4],
  ];

  const onSetItem = (item: SetMenuItem) => {
    if (item === 'turn-in') wantTurnIn();
    else if (item === 'take-back') takeBack();
    else if (item === 'delete') {
      onSetMenu?.('delete');
      show({
        text: `Deleted ${set.name}`,
        undo: () => {
          onSetMenu?.('undo-delete');
          setNotice(null);
        },
      });
    } else onSetMenu?.(item);
  };

  const minutes =
    set.minutesLeft === undefined ? '' : timeLeft(set.minutesLeft);

  return (
    <div className="@container mx-auto flex min-w-0 max-w-[760px] flex-col gap-4 py-6">
      <List>
        <div className="flex min-w-0 items-center pr-3">
          <div className="min-w-0 flex-1">
            <ListRow
              title={set.name}
              label={dueBadge(set.due, today)}
              status={<DueStatus due={set.due} today={today} />}
              meta={[...(minutes ? [minutes] : [])]}
            />
          </div>
          <ActionMenu
            label="More for this set"
            items={menu}
            onSelect={onSetItem}
          />
        </div>
      </List>

      {turnedIn && !(finish && all) && (
        <div className="ds-body flex min-w-0 flex-wrap items-center gap-3 rounded-(--ds-radius-control) border border-(--ds-border) px-4 py-2">
          <Tag>Turned in</Tag>
          <span className="min-w-0 flex-1 text-(--ds-fg-muted)">
            You can still look through it.
          </span>
          <Button onPress={takeBack}>Take back</Button>
        </div>
      )}

      {asking && (
        <div
          role="alert"
          className="ds-body flex min-w-0 flex-wrap items-center gap-3 rounded-(--ds-radius-control) border border-(--ds-attention) px-4 py-2"
        >
          <span className="min-w-0 flex-1 text-(--ds-fg)">
            {problems.length - done} of {problems.length} aren&apos;t done. Turn
            in anyway?
          </span>
          <Button variant="primary" onPress={turnIn}>
            Turn in anyway
          </Button>
          <Button
            onPress={() => {
              setAsking(false);
            }}
          >
            Keep working
          </Button>
        </div>
      )}

      <ProblemStrip
        marker={marker}
        chips={problems.map(chipOf)}
        current={finish ? undefined : current}
        onJump={go}
      />

      {problems.length === 0 ? (
        <p className="ds-body text-(--ds-fg-muted)">
          No problems in this set. Add problems from the set menu.
        </p>
      ) : finish && all ? (
        <FinishCard
          count={problems.length}
          minutes={set.minutesSpent}
          turnedIn={turnedIn}
          onTurnIn={wantTurnIn}
          onTakeBack={takeBack}
          onBack={onBackToCourse}
        />
      ) : (
        here && (
          <Problem
            key={here.id}
            problem={here}
            index={index + 1}
            nextNotReady={lone ? 'This is the only one left to do' : undefined}
            onDone={(v) => {
              mark(here.id, v);
            }}
            onAsk={() => {
              onAsk?.(here.id);
            }}
            onOpenPage={() => {
              onOpenPage?.(here.page, here.id);
            }}
            onNext={next}
            onMenu={(item) => {
              if (item === 'remove') remove(here.id);
              onProblemMenu?.(item, here.id);
            }}
            onFix={(fix) => {
              onFix?.(fix, here.id);
            }}
          />
        )
      )}

      <div className="sticky bottom-4 h-0">
        {notice && (
          <div
            role="status"
            className="ds-body absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-(--ds-radius-control) border border-(--ds-border) bg-(--ds-bg-raised) py-1 pr-1 pl-4 whitespace-nowrap text-(--ds-fg)"
          >
            <span>{notice.text} ·</span>
            <Button onPress={notice.undo}>Undo</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The pane while the set loads: the set line, a strip of eight chips and a
 *  problem, in the heights of the real thing. */
export function WorkSkeleton({ chips = 8 }: { chips?: number }) {
  return (
    <div
      aria-hidden
      className="@container mx-auto flex min-w-0 max-w-[760px] flex-col gap-4 py-6"
    >
      <div className="h-[58px] min-w-0 animate-pulse rounded-(--ds-radius-control) border border-(--ds-border-muted) motion-reduce:animate-none" />
      <ProblemStripSkeleton count={chips} />
      <ProblemSkeleton />
    </div>
  );
}
