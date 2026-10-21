import { useState } from 'react';

import { defineExamples } from '@/design/examples';
import type { NavView } from '@/units/problem-nav/layout';
import { Work, WorkSkeleton, type WorkProps } from './index';
import { pageMemory } from './memory';
import * as sample from './sample';
import spec from './spec';

/** The pane with a line under it of what it last asked the workspace for, so
 *  the design page shows the calls the workspace will handle. */
function Recorded(props: WorkProps) {
  const [fired, setFired] = useState('Nothing asked of the workspace yet.');
  const say = (s: string) => {
    setFired(s);
  };
  return (
    <div className="space-y-4">
      <Work
        memory={pageMemory()}
        today={sample.TODAY}
        onOpenPage={(page, id) => {
          say(`Open page ${String(page)} with the box of ${id}`);
        }}
        onAsk={(id) => {
          say(`Ask about ${id}`);
        }}
        onBackToCourse={() => {
          say('Back to the course');
        }}
        onSetMenu={(item) => {
          say(`Set menu: ${item}`);
        }}
        onProblemMenu={(item, id) => {
          say(`Problem menu: ${item} on ${id}`);
        }}
        onFix={(fix, id) => {
          say(`Fix ${fix} for ${id}`);
        }}
        {...props}
      />
      <p
        data-fired
        className="ds-small mx-auto max-w-[760px] border-t border-(--ds-border-muted) pt-2 text-(--ds-fg-muted)"
      >
        {fired}
      </p>
    </div>
  );
}

export default defineExamples(spec, {
  states: {
    'in-progress': () => <Recorded set={sample.inProgress()} startAt="p4" />,
    'all-done': () => <Recorded set={sample.allDone()} startFinish />,
    finding: () => <Recorded set={sample.finding()} startAt="p5" />,
    failed: () => <Recorded set={sample.failedOnce()} startAt="p5" />,
    'turned-in': () => <Recorded set={sample.turnedIn()} startFinish />,
    'nav-segments': () => (
      <Recorded set={sample.inProgress()} startAt="p4" nav="segments" />
    ),
    'nav-numbers': () => (
      <Recorded set={sample.inProgress()} startAt="p4" nav="numbers" />
    ),
    'nav-titled-numbers': () => (
      <Recorded set={sample.inProgress()} startAt="p4" nav="titled-numbers" />
    ),
    'nav-picker': () => (
      <Recorded set={sample.inProgress()} startAt="p4" nav="picker" />
    ),
    'nav-list': () => (
      <Recorded set={sample.inProgress()} startAt="p4" nav="list" />
    ),
  },
  stress: () => (
    <div className="space-y-10">
      {[
        undefined,
        'segments',
        'numbers',
        'titled-numbers',
        'picker',
        'list',
      ].map((nav) => (
        <Recorded
          key={nav ?? 'boxes'}
          set={sample.stress()}
          startAt="s1"
          nav={nav as NavView | undefined}
        />
      ))}
    </div>
  ),
  skeletons: {
    'in-progress': () => <WorkSkeleton />,
    'all-done': () => <WorkSkeleton />,
    finding: () => <WorkSkeleton />,
    failed: () => <WorkSkeleton />,
    'turned-in': () => <WorkSkeleton />,
    'nav-segments': () => <WorkSkeleton nav="segments" />,
    'nav-numbers': () => <WorkSkeleton nav="numbers" />,
    'nav-titled-numbers': () => <WorkSkeleton nav="titled-numbers" />,
    'nav-picker': () => <WorkSkeleton nav="picker" />,
    'nav-list': () => <WorkSkeleton nav="list" />,
  },
});
