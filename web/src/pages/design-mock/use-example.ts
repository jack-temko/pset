import { useState } from 'react';

import type { Mode } from './example';
import type { Sample } from './sample';

/** Everything the example's controls hold, so each arrangement places
 *  the same controls and shares the same state. */
export function useExample(s: Sample) {
  const [state, setState] = useState(s.states[0].id);
  const [width, setWidth] = useState(s.kind === 'pane' ? 440 : 480);
  const [full, setFull] = useState(false);
  const [stress, setStress] = useState(false);
  const [mode, setMode] = useState<Mode>('loaded');
  const [night, setNight] = useState(false);
  return {
    s,
    state,
    setState,
    width,
    setWidth,
    full,
    setFull,
    stress,
    setStress,
    mode,
    setMode,
    night,
    setNight,
  };
}
export type Ex = ReturnType<typeof useExample>;
