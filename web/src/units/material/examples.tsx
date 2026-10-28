import { useState } from 'react';
import { createPortal } from 'react-dom';

import { defineExamples } from '@/design/examples';
import { Button } from '@/units/button';
import { Material, MaterialSkeleton, type MaterialProps } from './index';
import { pageMemory } from './memory';
import * as sample from './sample';
import spec from './spec';

/** The pane in a window-high frame, with a line under it of what it last
 *  told the workspace, so the design page shows the calls the workspace will
 *  handle. Boxing and the flash can be started again. */
function Demo(props: Partial<MaterialProps>) {
  const [memory] = useState(pageMemory);
  const [fired, setFired] = useState('nothing yet.');
  const [boxing, setBoxing] = useState(props.boxing);
  const [flashN, setFlashN] = useState(1);
  // The readout is the design page's, not the pane's: it goes in the stage's
  // caption slot, in the light page's text, outside the pane's frame.
  const [slot, setSlot] = useState<Element | null>(null);
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
        <Material
          name={sample.NAME}
          book={sample.GRIFFITHS}
          tabId="demo"
          memory={memory}
          page={112}
          {...props}
          boxing={boxing}
          flash={props.flash && { ...props.flash, n: flashN }}
          onPage={(p) => {
            setFired(`now on page ${String(p)}`);
          }}
          onDone={(boxes) => {
            setFired(`done with ${String(boxes.length)} box(es)`);
            setBoxing(undefined);
          }}
          onCancel={() => {
            setFired('boxing cancelled');
            setBoxing(undefined);
          }}
          onRetry={() => {
            setFired('read it again');
          }}
        />
      </div>
      <div className="flex min-h-8 items-center gap-3">
        {props.flash && (
          <Button
            onPress={() => {
              setFlashN((n) => n + 1);
            }}
          >
            Flash again
          </Button>
        )}
        {props.boxing && boxing === undefined && (
          <Button
            onPress={() => {
              setBoxing(props.boxing);
            }}
          >
            Box again
          </Button>
        )}
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

/** The loading render in the same frame as the loaded one, so the example
 *  keeps its height. */
function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-[640px] outline-[1px] outline-(--ds-border-muted)">
        <MaterialSkeleton />
      </div>
      <div className="min-h-8" />
    </div>
  );
}

const BOX = { x: 0.1, y: 0.3, w: 0.8, h: 0.16 };

export default defineExamples(spec, Material, {
  states: {
    reading: () => <Demo />,
    contents: () => <Demo startContents besideAt={Infinity} />,
    'contents-beside': () => <Demo startContents besideAt={0} />,
    'go-to-page': () => <Demo startGoTo={{ text: '2' }} />,
    'page-missing': () => <Demo startGoTo={{ text: '900', entered: true }} />,
    flash: () => <Demo flash={{ page: 112, box: BOX, n: 1 }} />,
    unnumbered: () => <Demo page={undefined} startPdf={3} />,
    boxing: () => <Demo boxing={{ label: '4.62', page: 112 }} />,
    'boxing-drawn': () => (
      <Demo
        boxing={{ label: '4.62', page: 112 }}
        startBoxes={[{ pdf: 124, ...BOX }]}
      />
    ),
    'not-ready': () => <Demo status="reading" readingMin={2} />,
    'page-loading': () => <Demo loadMs={600000} />,
    'page-failed': () => <Demo brokenPages={[124]} loadMs={0} />,
    'book-failed': () => <Demo status="failed" />,
  },
  stress: () => (
    <Demo
      name={sample.LONG_NAME}
      book={sample.HUGE}
      page={1700}
      startContents
      besideAt={Infinity}
    />
  ),
  skeletons: Object.fromEntries(
    spec.states.map((s) => [s.id, () => <Loading />]),
  ) as Record<(typeof spec.states)[number]['id'], () => React.ReactNode>,
});
