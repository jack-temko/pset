import { defineExamples } from '@/design/examples';
import { Fold } from './index';
import spec from './spec';

const body = (
  <p className="ds-small py-2 text-(--ds-fg-muted)">
    Problem set 1, Problem set 2 and four more.
  </p>
);

export default defineExamples(spec, Fold, {
  states: {
    closed: () => <Fold label="Done (6)">{body}</Fold>,
    open: () => (
      <Fold label="Done (6)" defaultOpen>
        {body}
      </Fold>
    ),
  },
  stress: () => (
    <div className="w-[240px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <Fold label="Electromagnetics and the physics of electrical machines, finished sets (12)">
        {body}
      </Fold>
    </div>
  ),
});
