import {
  Check,
  LoaderCircle,
  MessageCircle,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ActionMenu, type MenuItem } from '@/units/action-menu';
import { Button } from '@/units/button';
import { HelpRow } from '@/units/help-row';
import { waitText } from '@/units/help-row/wait';
import { Link } from '@/units/link';
import { Tag } from '@/units/tag';
import { Runs } from './math';
import {
  HELP_KINDS,
  HELP_TITLE,
  type Figure,
  type HelpKind,
  type ProblemData,
  type ProblemMenuItem,
} from './types';

/** What a failed problem can try next (P16). */
export type Fix = 'retry' | 'box' | 'paste';

const MENU: readonly MenuItem<ProblemMenuItem>[] = [
  { id: 'edit', label: 'Edit the text' },
  { id: 'move', label: 'Move' },
  { id: 'notes', label: 'Edit the note' },
  { id: 'check-figure', label: 'Check how the figure reads' },
  { id: 'wrong-problem', label: 'This is the wrong problem' },
  { id: 'remove', label: 'Remove', danger: true },
];

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) motion-reduce:animate-none ${className}`}
    />
  );
}

/** A figure under the text; a press shows it larger (P: figures under the
 *  text, click to enlarge). */
function FigureView({ figure }: { figure: Figure }) {
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBig(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [big]);
  return (
    <figure className="min-w-0">
      <button
        type="button"
        aria-label={`Enlarge: ${figure.caption}`}
        onClick={() => {
          setBig(true);
        }}
        className="block max-w-full cursor-zoom-in rounded-(--ds-radius-control) border border-(--ds-border-muted) bg-white p-2"
      >
        <img
          src={figure.src}
          alt={figure.caption}
          className="block h-40 max-w-full object-contain"
        />
      </button>
      <figcaption className="ds-small mt-1 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
        {figure.caption}
      </figcaption>
      {big && (
        <div
          role="dialog"
          aria-label={figure.caption}
          onClick={() => {
            setBig(false);
          }}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-(--ds-bg-inset)/80 p-10"
        >
          <img
            src={figure.src}
            alt={figure.caption}
            className="max-h-full max-w-full rounded-(--ds-radius-control) bg-white p-4"
          />
        </div>
      )}
    </figure>
  );
}

/** The note the professor left, quiet and bordered, above the problem
 *  (P15). */
function Note({ problem }: { problem: ProblemData }) {
  if (!problem.note) return null;
  return (
    <aside className="ds-small min-w-0 rounded-(--ds-radius-control) border border-(--ds-border-muted) px-3 py-2 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
      <span className="font-medium text-(--ds-fg)">
        Note from your professor
      </span>
      <span className="block">
        <Runs runs={problem.note} />
      </span>
    </aside>
  );
}

/** The problem's name: its place in the set, its label and the page it is on
 *  as a link to that page (P14). */
function Heading({
  index,
  problem,
  onOpenPage,
}: {
  index: number;
  problem: ProblemData;
  onOpenPage?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
      <h2 className="ds-heading min-w-0 text-(--ds-fg) [overflow-wrap:anywhere]">
        Problem {index} · {problem.title}
      </h2>
      <p className="ds-small ds-tabular min-w-0 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
        {problem.label} ·{' '}
        <Link
          href="#"
          size="small"
          onClick={(e) => {
            e.preventDefault();
            onOpenPage?.();
          }}
        >
          p. {problem.page}
        </Link>
      </p>
    </div>
  );
}

function FoundSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <Bar className="h-5 w-full" />
      <Bar className="h-5 w-11/12" />
      <Bar className="h-5 w-3/5" />
    </div>
  );
}

/** A problem that could not be found: what happened, what was tried, the
 *  fix to try next first. The second time says so, and the fix that did not
 *  work moves down (P16). */
function Failed({
  problem,
  onFix,
}: {
  problem: ProblemData;
  onFix?: (fix: Fix) => void;
}) {
  if (problem.found.status !== 'failed') return null;
  const { tries, tried } = problem.found;
  const again = tries >= 2;
  const fixes: { fix: Fix; label: string }[] = [
    { fix: 'box', label: 'Box it on the page' },
    { fix: 'paste', label: 'Paste the text' },
    { fix: 'retry', label: 'Try again' },
  ];
  const ordered = again ? fixes : [fixes[2], fixes[0], fixes[1]];
  return (
    <div
      role="alert"
      className="min-w-0 space-y-3 rounded-(--ds-radius-control) border border-(--ds-danger) px-4 py-3"
    >
      <p className="ds-body flex min-w-0 items-start gap-2 font-medium text-(--ds-danger)">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {again
            ? `Still couldn't find ${problem.label} (2nd try)`
            : `Couldn't find ${problem.label}`}
        </span>
      </p>
      <ul className="ds-small list-disc space-y-1 pl-9 text-(--ds-fg-muted)">
        {tried.map((t) => (
          <li key={t} className="[overflow-wrap:anywhere]">
            {t}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pl-6">
        {ordered.map((f, i) => (
          <Button
            key={f.fix}
            variant={i === 0 ? 'primary' : 'default'}
            onPress={() => {
              onFix?.(f.fix);
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** One problem to work on. Above it, the professor's note; then its number,
 *  label and page link, the statement with its figures and parts, the three
 *  help steps as closed rows, and the actions: Mark done, Ask about this and
 *  Next, with one menu for the rest (P2, P4, P7, P13, P15).
 *
 *  A problem still being found shows its place and the wait; one that could
 *  not be found says so and what to try (P10, P16). Help still being written
 *  says so on its own row. */
export function Problem({
  problem,
  index,
  openHelp = [],
  nextNotReady,
  onDone,
  onAsk,
  onOpenPage,
  onNext,
  onMenu,
  onFix,
}: {
  problem: ProblemData;
  /** Its place in the set, from 1. */
  index: number;
  /** Which help steps start open. */
  openHelp?: readonly HelpKind[];
  /** Why Next cannot go on, such as "This is the last one left". */
  nextNotReady?: string;
  /** Mark done, or take it back. */
  onDone?: (done: boolean) => void;
  onAsk?: () => void;
  /** The page link: turn the material to the page, with this problem's box. */
  onOpenPage?: () => void;
  onNext?: () => void;
  onMenu?: (item: ProblemMenuItem) => void;
  onFix?: (fix: Fix) => void;
}) {
  const [open, setOpen] = useState<readonly HelpKind[]>(openHelp);
  const toggle = (k: HelpKind) => {
    setOpen((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  };
  const ready = problem.found.status === 'ready';
  const finding = problem.found.status === 'finding';
  const queued = problem.found.status === 'queued';
  const hasParts = problem.parts.length > 0;
  const items = MENU.filter(
    (m) => m.id !== 'check-figure' || problem.figures.length > 0,
  );
  const wait = ready ? undefined : 'Wait until the problem is found';

  return (
    <article className="min-w-0 space-y-4">
      <Note problem={problem} />
      <Heading index={index} problem={problem} onOpenPage={onOpenPage} />

      {finding && problem.found.status === 'finding' && (
        <div className="space-y-3">
          <p
            role="status"
            className="ds-body flex items-center gap-2 text-(--ds-fg-muted)"
          >
            <LoaderCircle
              className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            Finding {problem.label} on page {problem.page} ·{' '}
            {waitText(problem.found.seconds)}
          </p>
          <FoundSkeleton />
        </div>
      )}

      {queued && (
        <div className="space-y-3">
          <p
            role="status"
            className="ds-body flex items-center gap-2 text-(--ds-fg-muted)"
          >
            Waiting its turn: {problem.label} on page {problem.page} is next to
            be found
          </p>
          <FoundSkeleton />
        </div>
      )}

      {problem.found.status === 'failed' && (
        <Failed problem={problem} onFix={onFix} />
      )}

      {ready && (
        <>
          <div className="ds-reading ds-measure min-w-0 [overflow-wrap:anywhere]">
            <Runs runs={problem.statement} />
          </div>
          {problem.figures.length > 0 && (
            <div className="flex min-w-0 flex-wrap gap-4">
              {problem.figures.map((f) => (
                <FigureView key={f.id} figure={f} />
              ))}
            </div>
          )}
          {hasParts && (
            <ol className="ds-reading ds-measure min-w-0 space-y-2">
              {problem.parts.map((p) => (
                <li
                  key={p.label}
                  className={`flex min-w-0 items-baseline gap-2 ${p.skipped ? 'text-(--ds-fg-muted)' : ''}`}
                >
                  <span className="shrink-0">({p.label})</span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <Runs runs={p.runs} />
                  </span>
                  {p.skipped && (
                    <span className="shrink-0">
                      <Tag>Skipped</Tag>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          <div className="space-y-2">
            {HELP_KINDS.map((k) => {
              const h = problem.help[k];
              return (
                <HelpRow
                  key={k}
                  title={HELP_TITLE[k]}
                  state={h.status}
                  seconds={h.status === 'writing' ? h.seconds : undefined}
                  open={open.includes(k)}
                  onToggle={() => {
                    toggle(k);
                  }}
                >
                  {h.status === 'ready' && <Runs runs={h.runs} />}
                </HelpRow>
              );
            })}
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          variant={problem.done ? 'default' : 'primary'}
          icon={problem.done ? Check : undefined}
          notReady={wait}
          onPress={() => {
            onDone?.(!problem.done);
          }}
        >
          {problem.done ? 'Done' : 'Mark done'}
        </Button>
        <Button
          icon={MessageCircle}
          notReady={wait}
          onPress={() => {
            onAsk?.();
          }}
        >
          Ask about this
        </Button>
        <Button
          variant={problem.done ? 'primary' : 'default'}
          notReady={nextNotReady}
          onPress={() => {
            onNext?.();
          }}
        >
          Next
        </Button>
        <span className="ml-auto">
          <ActionMenu
            label="More for this problem"
            items={items}
            onSelect={onMenu}
          />
        </span>
      </div>
    </article>
  );
}

/** The problem while the set loads: a heading bar, three lines of text, three
 *  closed help rows and the actions, in the heights of the real thing. */
export function ProblemSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="flex h-(--ds-heading-line) items-center">
        <Bar className="h-5 w-40" />
      </div>
      <div className="space-y-3">
        <Bar className="h-5 w-full" />
        <Bar className="h-5 w-11/12" />
        <Bar className="h-5 w-3/5" />
      </div>
      <div className="space-y-2">
        {HELP_KINDS.map((k) => (
          <div
            key={k}
            className="flex h-[34px] items-center rounded-(--ds-radius-control) border border-(--ds-border-muted) px-3"
          >
            <Bar className="h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="flex h-(--ds-control) items-center gap-2">
        <Bar className="h-(--ds-control) w-28" />
        <Bar className="h-(--ds-control) w-36" />
        <Bar className="h-(--ds-control) w-20" />
      </div>
    </div>
  );
}
