import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

import type { Harness } from '../types';
import { Dock, type DockStart } from '.';
import { COURSE, THINGS } from './sample';
import { StandIn } from './stand-ins';
import type { Thing } from './things';

/** What a scenario says about the dock, in ids (`harness.props`). */
export interface DockProps {
  /** The thing on the right: what the URL names. */
  right: string;
  /** The course's things; the sample course's when absent. */
  things?: Thing[];
  /** The left pane's tabs when the play begins, by id and page. */
  tabs?: { id: string; page?: number }[];
  shown?: string;
  /** The split's ratio to begin at, as the saved one would be. */
  split?: number;
  /** Leave the saved split alone, as a reload does. */
  keepSplit?: boolean;
}

const SPLIT_KEY = `pset-split:${COURSE.id}`;

/** Each play begins at the split its scenario names (halves if none), as a
 *  fresh visit would, unless the scenario is a reload and the saved one
 *  stands. Storage can throw; then the saved split is simply not touched. */
function seedSplit(p: DockProps) {
  if (p.keepSplit) return;
  try {
    if (p.split === undefined) localStorage.removeItem(SPLIT_KEY);
    else localStorage.setItem(SPLIT_KEY, String(p.split));
  } catch {
    /* the saved split stands */
  }
}

/**
 * The dock where the course screen puts it: under the top bar, whose middle
 * names the course and takes the student back to its overview. The dock is
 * the whole view; the course's name is the screen's, so this stage draws it
 * and wires it to the handoff log.
 */
export function DockStage({ harness }: { harness: Harness }) {
  const p = harness.props as unknown as DockProps;
  const things = p.things ?? THINGS;
  const right = things.find((t) => t.id === p.right) ?? things[0];
  const [start] = useState<DockStart | undefined>(() => {
    seedSplit(p);
    if (!p.tabs) return undefined;
    return {
      shown: p.shown,
      tabs: p.tabs.flatMap(({ id, page }) => {
        const thing = things.find((t) => t.id === id);
        return thing ? [{ thing, place: page ? { page } : undefined }] : [];
      }),
    };
  });

  return (
    <div
      style={{
        height: 'min(720px, calc(100dvh - 15rem))',
        width: harness.wide ? undefined : '760px',
      }}
      className="flex flex-col overflow-hidden rounded-md border bg-background"
    >
      <div className="flex h-row shrink-0 items-center border-b px-card">
        <button
          type="button"
          onClick={() => {
            harness.handoff({
              to: 'Course overview',
              what: 'Leave the dock',
              carries: COURSE.name,
            });
          }}
          className="flex items-center gap-1 rounded-md text-lg text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
          {COURSE.name}
        </button>
      </div>
      <Dock
        courseId={COURSE.id}
        right={right}
        things={things}
        render={(thing, place, open) => (
          <StandIn thing={thing} place={place} open={open} />
        )}
        start={start}
      />
    </div>
  );
}
