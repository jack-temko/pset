import { defineExamples } from '@/design/examples';

import { AskStub, AskStubSkeleton } from './index';
import spec from './spec';

export default defineExamples(spec, AskStub, {
  states: {
    ask: () => <AskStub about="3.1 #7, Problem set 4" />,
  },
  stress: () => (
    <AskStub about="Problem 4.62, Introduction to Electrodynamics, fourth edition, by David J. Griffiths, with the solutions manual" />
  ),
  skeletons: {
    ask: () => <AskStubSkeleton />,
  },
});
