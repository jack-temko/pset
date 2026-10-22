import { useState } from 'react';

import { defineExamples } from '@/design/examples';
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
    'current-underline': () => (
      <Recorded set={sample.inProgress()} startAt="p4" />
    ),
    summary: () => <Recorded set={sample.inProgress()} startSummary />,
    'summary-box': () => <Recorded set={sample.allDone()} />,
    'summary-home': () => (
      <Recorded set={sample.allDone()} summaryView="home" />
    ),
    'summary-plain': () => (
      <Recorded set={sample.allDone()} summaryView="plain" />
    ),
    'summary-tiles': () => (
      <Recorded set={sample.allDone()} summaryView="tiles" />
    ),
    'summary-turned-in': () => <Recorded set={sample.turnedIn()} />,
    empty: () => <Recorded set={sample.empty()} />,
    plain: () => <Recorded set={sample.plain()} startAt="p6" />,
    finding: () => <Recorded set={sample.finding()} startAt="p5" />,
    failed: () => <Recorded set={sample.failedOnce()} startAt="p5" />,
  },
  stress: () => <Recorded set={sample.stress()} startAt="s1" />,
  skeletons: {
    'current-underline': () => <WorkSkeleton />,
    summary: () => <WorkSkeleton />,
    'summary-box': () => <WorkSkeleton opens="summary" />,
    'summary-home': () => <WorkSkeleton opens="summary" summaryView="home" />,
    'summary-plain': () => <WorkSkeleton opens="summary" summaryView="plain" />,
    'summary-tiles': () => <WorkSkeleton opens="summary" summaryView="tiles" />,
    'summary-turned-in': () => <WorkSkeleton opens="turned-in" />,
    empty: () => <WorkSkeleton />,
    plain: () => <WorkSkeleton />,
    finding: () => <WorkSkeleton />,
    failed: () => <WorkSkeleton />,
  },
});
