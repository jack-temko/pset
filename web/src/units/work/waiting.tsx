import { Bone, FillBlock } from '@/units/bone';
import { Button } from '@/units/button';
import { ProblemWaiting } from '@/units/problem';
import { ProblemStripWaiting } from '@/units/problem-strip';
import { DueStatus } from '@/units/set-line';
import { SummaryWaiting } from '@/units/summary';
import { Tag } from '@/units/tag';
import { PANE_MIN } from './pane';
import type { WorkShape } from './shape';

/** The pane while its set loads (work-d23): the set line's frame with its
 *  values as bars, the strip at the set's length, and the problem or the
 *  summary it opens on as that thing's own loading form, in the loaded
 *  layout. */
export function Waiting({
  shape,
  onBackToCourse,
}: {
  /** Undefined: nothing known, so the body stays quiet. */
  shape: WorkShape | undefined;
  onBackToCourse?: () => void;
}) {
  const opens = shape?.opens;
  const stands = opens?.kind !== 'problem';
  return (
    <div
      className="@container mx-auto flex min-w-0 max-w-[760px] flex-col gap-4 py-6"
      style={{ minHeight: PANE_MIN }}
    >
      <div className="flex h-(--ds-row) min-w-0 items-center gap-3">
        <span className="shrink-0">
          <Tag loading />
        </span>
        <span className="ds-small shrink-0 whitespace-nowrap">
          <DueStatus loading />
        </span>
        <span className="ds-small min-w-0 truncate">
          {shape?.minutes === true && <Bone ch={14} />}
        </span>
        <span className="ml-auto block size-(--ds-control) shrink-0" />
      </div>

      {shape?.turnedIn === true && opens?.kind !== 'summary' && (
        <div className="ds-body flex min-w-0 flex-wrap items-center gap-3 rounded-(--ds-radius-control) border border-(--ds-border) px-4 py-2">
          <Tag>Turned in</Tag>
          <span className="min-w-0 flex-1 text-(--ds-fg-muted)">
            You can still look through it.
          </span>
          <Button notReady="Still loading">Take back</Button>
        </div>
      )}

      {shape !== undefined && shape.count > 0 && (
        <ProblemStripWaiting count={shape.count} />
      )}

      <div
        className={`flex min-w-0 flex-1 flex-col ${stands ? 'justify-center' : ''}`}
      >
        {opens === undefined ? null : opens.kind === 'empty' ? (
          <div className="mx-auto flex max-w-[520px] flex-col items-center gap-3 text-center">
            <FillBlock as="h2" ch={14} className="ds-heading">
              {undefined}
            </FillBlock>
            <FillBlock as="p" ch={40} className="ds-body">
              {undefined}
            </FillBlock>
            <Button variant="primary" notReady="Still loading">
              Add problems
            </Button>
          </div>
        ) : opens.kind === 'summary' ? (
          <SummaryWaiting shape={opens.summary} onBack={onBackToCourse} />
        ) : (
          <ProblemWaiting shape={opens.problem} />
        )}
      </div>

      {/* Where the Undo notice sits: no height, but in the column's gaps. */}
      <div className="sticky bottom-4 h-0" />
    </div>
  );
}
