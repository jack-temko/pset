import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { defineExamples } from '@/design/examples';
import { Ask, AskSkeleton } from './index';
import { SampleAsk } from './chat';
import * as sample from './sample';
import type { Turn } from './types';
import spec from './spec';

/** The pane in a window-high frame, with a line under it of what it last
 *  told the workspace, so the design page shows the calls the workspace
 *  will handle. */
function Demo({
  turns,
  fixed,
  start,
  ...props
}: {
  turns: readonly Turn[];
  /** Frozen as given: no answering, for a state that is a moment. */
  fixed?: boolean;
  start?: boolean;
} & Partial<React.ComponentProps<typeof Ask>>) {
  const [fired, setFired] = useState('nothing yet.');
  // The readout is the design page's, not the pane's: it goes in the stage's
  // caption slot, in the light page's text, outside the pane's frame.
  const [slot, setSlot] = useState<Element | null>(null);
  const tell = {
    onPage: (material: string, page: number) => {
      setFired(`open ${material} at p. ${String(page)}`);
    },
    onSettings: () => {
      setFired('open Settings');
    },
    onEdit: () => {
      setFired('edit the memory');
    },
  };
  let pane: ReactNode;
  if (fixed)
    pane = (
      <Ask
        course={sample.COURSE}
        turns={turns}
        {...tell}
        onRetry={() => {
          setFired('try that question again');
        }}
        {...props}
      />
    );
  else
    pane = (
      <SampleAsk
        course={sample.COURSE}
        turns={turns}
        start={start}
        {...tell}
        {...props}
      />
    );
  return (
    <div
      className="space-y-3"
      ref={(el) => {
        setSlot(
          el
            ?.closest('.ds')
            ?.parentElement?.querySelector('[data-stage-caption]') ?? null,
        );
      }}
    >
      <div className="h-[640px] outline-[1px] outline-(--ds-border-muted)">
        {pane}
      </div>
      {slot &&
        createPortal(
          <p data-fired className="pt-3">
            {`Told to the workspace: ${fired}`}
          </p>,
          slot,
        )}
    </div>
  );
}

/** The loading render in the same frame, so the example keeps its height. */
function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-[640px] outline-[1px] outline-(--ds-border-muted)">
        <AskSkeleton />
      </div>
    </div>
  );
}

const earlier = sample.HISTORY.slice(0, 3);

export default defineExamples(spec, Ask, {
  states: {
    empty: () => <Demo turns={[]} />,
    opened: () => <Demo turns={earlier} about={sample.ABOUT} focusBox />,
    thinking: () => <Demo fixed turns={[...earlier, sample.THINKING]} />,
    call: () => (
      <Demo
        fixed
        turns={[
          ...earlier,
          { ...sample.THINKING, id: 'c', inFlight: sample.SEARCH },
        ]}
      />
    ),
    streaming: () => (
      <Demo start turns={[...earlier, { ...sample.THINKING, id: 'st' }]} />
    ),
    done: () => <Demo turns={[...earlier, sample.DONE]} />,
    'done-open': () => (
      <Demo turns={[...earlier, sample.DONE]} startOpen={['d']} />
    ),
    remembered: () => <Demo turns={[...earlier, sample.REMEMBERED]} />,
    stopped: () => <Demo turns={[...earlier, sample.STOPPED]} />,
    failed: () => <Demo fixed turns={[...earlier, sample.FAILED]} />,
    'failed-setup': () => (
      <Demo fixed turns={[...earlier, sample.FAILED_SETUP]} />
    ),
    image: () => <Demo turns={earlier} startImage={sample.WITH_IMAGE.image} />,
    history: () => <Demo turns={sample.HISTORY} />,
    clearing: () => <Demo turns={sample.HISTORY} startClearing />,
    loading: () => <Loading />,
  },
  stress: () => (
    <Demo
      turns={[...sample.LONG_HISTORY, sample.WORST]}
      about={sample.WORST.about}
    />
  ),
  skeletons: {
    empty: () => <Loading />,
    opened: () => <Loading />,
    thinking: () => <Loading />,
    call: () => <Loading />,
    streaming: () => <Loading />,
    done: () => <Loading />,
    'done-open': () => <Loading />,
    remembered: () => <Loading />,
    stopped: () => <Loading />,
    failed: () => <Loading />,
    'failed-setup': () => <Loading />,
    image: () => <Loading />,
    history: () => <Loading />,
    clearing: () => <Loading />,
    loading: () => <Loading />,
  },
});
