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
    'summary-finished': () => <Recorded set={sample.allDone()} />,
    'summary-turned-in': () => <Recorded set={sample.turnedIn()} />,
    'reach-flag': () => <Recorded set={sample.inProgress()} startAt="p4" />,
    'reach-flag-summary': () => (
      <Recorded set={sample.inProgress()} startSummary />
    ),
    'reach-label': () => (
      <Recorded set={sample.inProgress()} startAt="p4" reach="label" />
    ),
    'reach-label-summary': () => (
      <Recorded set={sample.inProgress()} startSummary reach="label" />
    ),
    'reach-header': () => (
      <Recorded set={sample.inProgress()} startAt="p4" reach="header" />
    ),
    'reach-header-summary': () => (
      <Recorded set={sample.inProgress()} startSummary reach="header" />
    ),
    'reach-segment': () => (
      <Recorded set={sample.inProgress()} startAt="p4" reach="segment" />
    ),
    'reach-segment-summary': () => (
      <Recorded set={sample.inProgress()} startSummary reach="segment" />
    ),
    empty: () => <Recorded set={sample.empty()} />,
    plain: () => <Recorded set={sample.plain()} startAt="p6" />,
    finding: () => <Recorded set={sample.finding()} startAt="p5" />,
    failed: () => <Recorded set={sample.failedOnce()} startAt="p5" />,
  },
  stress: () => <Recorded set={sample.stress()} startAt="s1" />,
  skeletons: {
    'current-underline': () => <WorkSkeleton />,
    summary: () => <WorkSkeleton />,
    'summary-finished': () => <WorkSkeleton opens="summary" />,
    'summary-turned-in': () => <WorkSkeleton opens="turned-in" />,
    'reach-flag': () => <WorkSkeleton reach="flag" />,
    'reach-flag-summary': () => <WorkSkeleton reach="flag" />,
    'reach-label': () => <WorkSkeleton reach="label" />,
    'reach-label-summary': () => <WorkSkeleton reach="label" />,
    'reach-header': () => <WorkSkeleton reach="header" />,
    'reach-header-summary': () => <WorkSkeleton reach="header" />,
    'reach-segment': () => <WorkSkeleton reach="segment" />,
    'reach-segment-summary': () => <WorkSkeleton reach="segment" />,
    empty: () => <WorkSkeleton />,
    plain: () => <WorkSkeleton />,
    finding: () => <WorkSkeleton />,
    failed: () => <WorkSkeleton />,
  },
});
