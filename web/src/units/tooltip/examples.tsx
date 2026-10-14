import { defineExamples } from '@/design/examples';
import { Tooltip } from './index';
import spec from './spec';

/** A stand-in control, so this unit does not import another. */
function Trigger({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="ds-body h-(--ds-control) max-w-full min-w-16 truncate rounded-(--ds-radius-control) border border-(--ds-border) px-3 text-(--ds-fg)"
    >
      {children}
    </button>
  );
}

const SHORT = 'Add a file first.';
const LONG =
  'This button cannot act yet because the course has no textbook file, so add one in the course settings first and then come back here.';

export default defineExamples(spec, {
  states: {
    below: () => (
      <div className="pb-12">
        <Tooltip text={SHORT} open>
          <Trigger>Continue</Trigger>
        </Tooltip>
      </div>
    ),
    above: () => (
      <div className="pt-12">
        <Tooltip text={SHORT} side="above" open>
          <Trigger>Continue</Trigger>
        </Tooltip>
      </div>
    ),
    long: () => (
      <div className="pb-24">
        <Tooltip text={LONG} open>
          <Trigger>Continue</Trigger>
        </Tooltip>
      </div>
    ),
    edge: () => (
      <div className="flex justify-end pb-12">
        <Tooltip text={SHORT} open>
          <Trigger>Continue</Trigger>
        </Tooltip>
      </div>
    ),
  },
  stress: () => (
    <div className="flex h-24 items-end justify-end">
      <div className="w-[120px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
        <Tooltip text={LONG} open>
          <Trigger>Continue to the next problem set</Trigger>
        </Tooltip>
      </div>
    </div>
  ),
});
