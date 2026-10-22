import { defineExamples } from '@/design/examples';
import { Divider } from './index';
import spec from './spec';

const noop = () => {};

/** Two stand-in sides, so the line is seen between something. */
function Between({ state }: { state?: 'hover' | 'drag' }) {
  return (
    <div className="flex h-40 w-full">
      <div className="ds-small flex-1 p-3 text-(--ds-fg-muted)">One side</div>
      <Divider onMove={noop} onReset={noop} forceState={state} />
      <div className="ds-small flex-1 p-3 text-(--ds-fg-muted)">The other</div>
    </div>
  );
}

export default defineExamples(spec, Divider, {
  states: {
    rest: () => <Between />,
    hover: () => <Between state="hover" />,
    drag: () => <Between state="drag" />,
  },
  stress: () => (
    <div className="h-[480px] w-[120px]">
      <div className="flex h-full">
        <div className="flex-1" />
        <Divider onMove={noop} onReset={noop} />
        <div className="flex-1" />
      </div>
    </div>
  ),
});
