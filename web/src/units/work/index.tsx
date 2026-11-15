import { waits, type Loads, type Waits } from '@/design/loading';
import { Pane, type Marks, type WorkProps } from './pane';
import type { Memory } from './memory';
import type { WorkSet } from './sets';
import { workShape, type WorkShape } from './shape';
import { Waiting } from './waiting';

export type { Marks, WorkProps, WorkShape };

const workLoads = {
  data: ['set'],
  shapeOf: workShape,
} satisfies Loads<
  { set: WorkSet; startAt?: string; startSummary?: boolean; memory?: Memory },
  WorkShape
>;

/** The pane for one problem set: the set line, a strip of every problem,
 *  the one you are on, and at the end a finish card (P1, P5, P12). It keeps
 *  its own marks while it is open and tells the workspace what to open
 *  through its callbacks. Loading, every part draws its own loading form at
 *  the set's shape (work-d23). With nothing known the set line and the
 *  strip's place are drawn and the body stays quiet (skeleton-grill S2). */
export const Work = waits(
  workLoads,
  function Work(
    props: Waits<Omit<WorkProps, 'set'>, { set: WorkSet }, WorkShape>,
  ) {
    if (props.loading === undefined) return <Pane {...props} />;
    return (
      <Waiting
        shape={props.loading === 'unknown' ? undefined : props.loading}
        onBackToCourse={props.onBackToCourse}
      />
    );
  },
);
