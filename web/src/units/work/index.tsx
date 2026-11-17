import { waits, type Loads, type Waits } from '@/design/loading';
import { Loaded, Quiet, type WorkProps } from './pane';
import type { WorkSet } from './sets';

export type { Marks, WorkProps } from './pane';

/** The pane for one problem set: the set line, a strip of every problem,
 *  the one you are on, and at the end a finish card (P1, P5, P12). Its quiet
 *  form is its column, empty: every line in it is the set's (loading D2). */
export const Work = waits(
  { data: ['set'] } satisfies Loads<{ set: WorkSet }>,
  function Work(props: Waits<Omit<WorkProps, 'set'>, { set: WorkSet }>) {
    return props.loading === true ? <Quiet /> : <Loaded {...props} />;
  },
);
