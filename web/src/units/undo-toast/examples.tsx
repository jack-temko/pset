import { defineExamples } from '@/design/examples';
import { UndoToast } from './index';
import spec from './spec';

const noop = () => {};

export default defineExamples(spec, UndoToast, {
  states: {
    undone: () => (
      <UndoToast
        floating={false}
        said="Renamed back to Problem set 4."
        onRedo={noop}
        onClose={noop}
      />
    ),
    show: () => (
      <UndoToast
        floating={false}
        said="Removed Thermodynamics again."
        onRedo={noop}
        onShow={noop}
        onClose={noop}
      />
    ),
    'still-hidden': () => (
      <UndoToast
        floating={false}
        said="Brought back problem 3. Its assignment is still removed."
        onRedo={noop}
        onShow={noop}
        onClose={noop}
      />
    ),
    refused: () => (
      <UndoToast
        floating={false}
        refused
        said="There’s nothing to undo."
        onClose={noop}
      />
    ),
  },
  stress: () => (
    <div className="w-[360px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <UndoToast
        floating={false}
        said="Brought back Electromagnetics and the physics of electrical machines, lecture notes, week 6. Its course is still removed, so it stays hidden."
        onRedo={noop}
        onShow={noop}
        onClose={noop}
      />
    </div>
  ),
});
