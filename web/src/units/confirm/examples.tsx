import { defineExamples } from '@/design/examples';
import { Confirm } from './index';
import spec from './spec';

const noop = () => {};

export default defineExamples(spec, Confirm, {
  states: {
    history: () => (
      <Confirm
        message="This deletes 86 h of study time and 1,032 answers."
        confirmLabel="Clear study history"
        onConfirm={noop}
        onCancel={noop}
      />
    ),
    errors: () => (
      <Confirm
        message="This clears 3 kept errors."
        confirmLabel="Clear errors"
        onConfirm={noop}
        onCancel={noop}
      />
    ),
  },
  stress: () => (
    <div className="w-[360px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <Confirm
        message="This deletes 41 hours of study time and 1,032 answers from Electromagnetics and the physics of electrical machines, across 12 sets and 9 materials."
        confirmLabel="Clear study history"
        onConfirm={noop}
        onCancel={noop}
      />
    </div>
  ),
});
