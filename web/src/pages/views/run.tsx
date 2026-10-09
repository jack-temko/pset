import { useEffect, useLayoutEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { emit } from '@/api/events';
import { makeQueryClient } from '@/api/query';
import { assetUrl } from '@/views/mock/assets';
import { installMock } from '@/views/mock/install';
import { MockServer, type Traffic } from '@/views/mock/server';
import type { Scenario } from '@/views/mock/scenario';
import type { Handoff, ViewEntry } from '@/views/types';

/**
 * One play of a scenario: a cache of its own, the mock installed under the
 * app's API layer for as long as this is mounted, the view's stage on top.
 * Replay is a new `key` on this, which unmounts it: the timers stop, the
 * mock comes out and the cache goes, so nothing of the last play is left.
 */
export function Run({
  entry,
  scenario,
  speed,
  wide,
  onTraffic,
  onHandoff,
}: {
  entry: ViewEntry;
  scenario: Scenario;
  /** Scenario time runs this many times faster. */
  speed: number;
  wide: boolean;
  onTraffic: (t: Traffic) => void;
  onHandoff: (h: Handoff) => void;
}) {
  const [qc] = useState(makeQueryClient);
  const [started, setStarted] = useState<{
    play: () => void;
    props: Record<string, unknown>;
  } | null>(null);

  // Installed before the view's first effect asks for anything, so its
  // first request is already answered by the mock.
  useLayoutEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const session = scenario.start({
      emit: (type, data) => emit(type, data, qc),
      after: (ms, fn) => void timers.push(setTimeout(fn, ms / speed)),
      speed,
    });
    const uninstall = installMock(
      new MockServer(session.routes, { latency: session.latency, onTraffic }),
      assetUrl,
    );
    setStarted({
      play: session.play ?? (() => {}),
      props: session.props ?? {},
    });
    return () => {
      timers.forEach(clearTimeout);
      uninstall();
      qc.clear();
      setStarted(null);
    };
    // A run is for one scenario at one speed: changing either is a new run.
  }, [qc, scenario, speed, onTraffic]);

  // The timeline starts once the view is on screen, so its first events
  // find the view's queries.
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(started.play, 0);
    return () => clearTimeout(t);
  }, [started]);

  if (!started) return null;
  const { Stage } = entry;
  return (
    <QueryClientProvider client={qc}>
      <Stage harness={{ handoff: onHandoff, wide, props: started.props }} />
    </QueryClientProvider>
  );
}
