import { useState } from 'react';
import { createPortal } from 'react-dom';

import { defineExamples } from '@/design/examples';
import { Work, type WorkProps } from './index';
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
  // The readout is the design page's, not the pane's: it goes in the stage's
  // caption slot, outside the pane, so the pane's own height is all it has.
  const [slot, setSlot] = useState<Element | null>(null);
  return (
    <div
      ref={(el) => {
        setSlot(
          el
            ?.closest('.ds')
            ?.parentElement?.querySelector('[data-stage-caption]') ?? null,
        );
      }}
    >
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
          say(`Assignment menu: ${item}`);
        }}
        onProblemMenu={(item, id) => {
          say(`Problem menu: ${item} on ${id}`);
        }}
        onFix={(fix, id) => {
          say(`Fix ${fix} for ${id}`);
        }}
        {...props}
      />
      {slot &&
        createPortal(
          <p data-fired className="pt-3">
            {fired}
          </p>,
          slot,
        )}
    </div>
  );
}

export default defineExamples(spec, Work, {
  states: {
    'current-underline': () => (
      <Recorded set={sample.inProgress()} startAt="p4" />
    ),
    summary: () => <Recorded set={sample.inProgress()} startSummary />,
    'summary-finished': () => <Recorded set={sample.allDone()} />,
    'summary-turned-in': () => <Recorded set={sample.turnedIn()} />,
    empty: () => <Recorded set={sample.empty()} />,
    plain: () => <Recorded set={sample.plain()} startAt="p6" />,
    finding: () => <Recorded set={sample.finding()} startAt="p5" />,
    failed: () => <Recorded set={sample.failedOnce()} startAt="p5" />,
  },
  stress: () => <Recorded set={sample.stress()} startAt="s1" />,
});
