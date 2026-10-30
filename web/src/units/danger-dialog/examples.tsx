import { defineExamples } from '@/design/examples';
import { DangerDialog } from './index';
import spec from './spec';

const noop = () => {};

export default defineExamples(spec, DangerDialog, {
  states: {
    course: () => (
      <DangerDialog
        inline
        title="Delete ECE 210"
        message="This deletes 12 sets and 9 materials."
        word="ECE 210"
        confirmLabel="Delete course"
        onConfirm={noop}
        onCancel={noop}
      />
    ),
    reset: () => (
      <DangerDialog
        inline
        title="Reset everything"
        message="This deletes 4 courses, 31 sets, 52 materials and 24 memories."
        word="reset"
        confirmLabel="Reset everything"
        onConfirm={noop}
        onCancel={noop}
      />
    ),
  },
  stress: () => (
    <div className="w-[480px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <DangerDialog
        inline
        title="Delete Electromagnetics and the physics of electrical machines"
        message="This deletes 12 sets, 9 materials, 8 memories and 41 hours of study time from Electromagnetics and the physics of electrical machines."
        word="Electromagnetics and the physics of electrical machines"
        confirmLabel="Delete course"
        onConfirm={noop}
        onCancel={noop}
      />
    </div>
  ),
});
