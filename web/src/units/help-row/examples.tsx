import { defineExamples } from '@/design/examples';
import { HelpRow } from './index';
import spec from './spec';

const text =
  'Start from what stays the same across the capacitor: its voltage cannot jump.';

export default defineExamples(spec, HelpRow, {
  states: {
    closed: () => <HelpRow title="Hint" />,
    open: () => (
      <HelpRow title="Hint" open>
        {text}
      </HelpRow>
    ),
    writing: () => <HelpRow title="Walkthrough" state="writing" seconds={20} />,
  },
  stress: () => (
    <HelpRow title="Walkthrough" open>
      {Array.from({ length: 30 }, (_, i) => (
        <span key={i} className="block">
          Step {i + 1}: differentiate both sides, then divide by RC.
        </span>
      ))}
      <span className="block">{'x'.repeat(70)}</span>
    </HelpRow>
  ),
});
