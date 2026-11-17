import { useEffect, useState } from 'react';

import { defineExamples } from '@/design/examples';
import { Settings } from './index';
import {
  CHECK_FAILING,
  CHECKING,
  ERRORS_KEPT,
  FINE,
  KEY_FAILED,
  NO_KEY,
  STRESS,
  UPDATE_AVAILABLE,
  UPDATING,
} from './sample';
import spec from './spec';

const view = (p: Partial<Parameters<typeof Settings>[0]> = {}) => (
  <Settings settings={FINE} {...p} />
);

/** The checks coming in, over and over: running for 1.5 s, then one failing
 *  for 2.5 s, in the same page, so nothing under Health can be seen to move. */
function ChecksArriving() {
  const [running, setRunning] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(
      () => {
        setRunning((r) => !r);
      },
      running ? 1500 : 2500,
    );
    return () => {
      window.clearTimeout(t);
    };
  }, [running]);
  return view({
    settings: running ? CHECKING : CHECK_FAILING,
  });
}

export default defineExamples(spec, Settings, {
  states: {
    fine: () => view(),
    'no-key': () => view({ settings: NO_KEY }),
    'key-failed': () => view({ settings: KEY_FAILED }),
    'update-available': () => view({ settings: UPDATE_AVAILABLE }),
    updating: () => view({ settings: UPDATING }),
    'check-failing': () => view({ settings: CHECK_FAILING }),
    checking: () => view({ settings: CHECKING }),
    'checks-arriving': () => <ChecksArriving />,
    'errors-kept': () => view({ settings: ERRORS_KEPT, unfolded: true }),
    failed: () => view({ failed: true }),
  },
  stress: () => view({ settings: STRESS, unfolded: true }),
});
