import { defineExamples } from '@/design/examples';
import { Confirm } from './index';
import spec from './spec';

const noop = () => {};

export default defineExamples(spec, Confirm, {
  states: {
    course: () => (
      <Confirm
        message="This deletes 12 sets and 9 materials."
        confirmLabel="Delete course"
        onConfirm={noop}
        onCancel={noop}
      />
    ),
    reset: () => (
      <Confirm
        message="This deletes 4 courses, 31 sets, 52 materials and every memory."
        confirmLabel="Reset everything"
        onConfirm={noop}
        onCancel={noop}
      />
    ),
  },
  stress: () => (
    <div className="w-[360px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <Confirm
        message="This deletes 12 sets, 9 materials, 8 memories and 41 hours of study time from Electromagnetics and the physics of electrical machines."
        confirmLabel="Delete course"
        onConfirm={noop}
        onCancel={noop}
      />
    </div>
  ),
});
