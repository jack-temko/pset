import { useEffect, useRef, useState } from 'react';

import { ActionMenu, type MenuItem } from '@/units/action-menu';
import { Button } from '@/units/button';
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
} from '@/units/problem-strip';
import { DueStatus } from '@/units/set-line';
import { dueBadge } from '@/units/set-line/badge';
import { timeLeft } from '@/units/set-line/dates';
import { Summary } from '@/units/summary';
import { Tag } from '@/units/tag';
import { sessionMemory, type Memory } from './memory';
import {
  doneCount,
  UNDO_MS,
  nextToDo,
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

/** The least height of the pane, so a short thing that stands alone has room
 *  to be centred in. The workspace gives the real pane its own height. */
const PANE_MIN = 560;

interface Notice {
  text: string;
  undo: () => void;
}

export interface WorkProps {
  set: WorkSet;
  /** Where to start: a problem's id. Without it the pane goes to where the
   *  student left (S8), else the first problem still to do. */
  startAt?: string;
  /** Start on the summary. Without it a finished or turned-in set opens
   *  on the summary and an unfinished one on the remembered problem. */
  startSummary?: boolean;
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
  startSummary,
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
  const [summary, setSummary] = useState(
    startSummary ??
      (startAt === undefined &&
        (set.turnedInAt !== undefined ||
          (set.problems.length > 0 && set.problems.every((p) => p.done)))),
  );
  const [turnedInAt, setTurnedInAt] = useState(set.turnedInAt);
  const [finishedAt, setFinishedAt] = useState(set.finishedAt);
  const turnedIn = turnedInAt !== undefined;
  const now = today ?? new Date();
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
    setSummary(false);
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
  const after = here ? nextToDo(problems, here.id) : undefined;

  const mark = (id: string, value: boolean) => {
    const next = problems.map((p) => (p.id === id ? { ...p, done: value } : p));
    setProblems(next);
    const finished = value && next.every((p) => p.done);
    setSummary(finished);
    setFinishedAt(finished ? now : undefined);
  };

  const next = () => {
    if (after !== undefined) go(after);
    else setSummary(true);
  };

  const remove = (id: string) => {
    const at = problems.findIndex((p) => p.id === id);
    const gone = problems[at];
    const rest = problems.filter((p) => p.id !== id);
    setProblems(rest);
    if (rest.length > 0) go(rest[Math.min(at, rest.length - 1)].id);
    setSummary(rest.length > 0 && rest.every((p) => p.done));
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
    setTurnedInAt(now);
    onSetMenu?.('turn-in');
  };
  const wantTurnIn = () => {
    if (done < problems.length) setAsking(true);
    else turnIn();
  };
  const takeBack = () => {
    setTurnedInAt(undefined);
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

  const stands =
    problems.length === 0 ||
    summary ||
    (here !== undefined && here.found.status !== 'ready');
  const minutes =
    set.minutesLeft === undefined ? '' : timeLeft(set.minutesLeft);

  return (
    <div
      className="@container mx-auto flex min-w-0 max-w-[760px] flex-col gap-4 py-6"
      style={{ minHeight: PANE_MIN }}
    >
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

      {turnedInAt && !summary && (
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

      {problems.length > 0 && (
        <ProblemStrip
          chips={problems.map(chipOf)}
          current={summary ? undefined : current}
          summary={summary}
          allDone={all}
          onJump={go}
          onSummary={() => {
            setSummary(true);
          }}
        />
      )}

      <div
        className={`flex min-w-0 flex-1 flex-col ${stands ? 'justify-center' : ''}`}
      >
        {problems.length === 0 ? (
          <div className="mx-auto flex max-w-[520px] flex-col items-center gap-3 text-center">
            <h2 className="ds-heading text-(--ds-fg)">No problems yet</h2>
            <p className="ds-body text-(--ds-fg-muted)">
              Add the problems of this set to start working.
            </p>
            <Button
              variant="primary"
              onPress={() => {
                onSetMenu?.('add');
              }}
            >
              Add problems
            </Button>
          </div>
        ) : summary ? (
          <Summary
            problems={problems.map((p) => ({
              id: p.id,
              label: p.label,
              title: p.title,
              state: chipOf(p).state,
              minutes: p.minutes ?? 0,
            }))}
            due={set.due}
            finished={finishedAt}
            turnedIn={turnedInAt}
            today={today}
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
      </div>

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
      style={{ minHeight: PANE_MIN }}
    >
      <div className="h-[58px] min-w-0 animate-pulse rounded-(--ds-radius-control) border border-(--ds-border-muted) motion-reduce:animate-none" />
      <ProblemStripSkeleton count={chips} />
      <ProblemSkeleton />
    </div>
  );
}
