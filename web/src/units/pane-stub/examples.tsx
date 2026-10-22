import { defineExamples } from '@/design/examples';
import type { ReactNode } from 'react';

import {
  AskStub,
  AskStubSkeleton,
  MaterialStub,
  MaterialStubSkeleton,
} from './index';
import spec from './spec';

/** Both stand-ins, one input list: the material's props and Ask's. */
const BOTH: (
  props: Parameters<typeof MaterialStub>[0] & Parameters<typeof AskStub>[0],
) => ReactNode = MaterialStub;

export default defineExamples(spec, BOTH, {
  states: {
    material: () => <MaterialStub name="Griffiths" page={112} />,
    boxed: () => (
      <MaterialStub
        name="Griffiths"
        page={112}
        boxed={{ problem: 'p4', n: 1 }}
      />
    ),
    ask: () => <AskStub about="3.1 #7, Problem set 4" />,
  },
  stress: () => (
    <MaterialStub
      name="Introduction to Electrodynamics, fourth edition, by David J. Griffiths, with the solutions manual"
      page={1234}
    />
  ),
  skeletons: {
    material: () => <MaterialStubSkeleton />,
    boxed: () => <MaterialStubSkeleton />,
    ask: () => <AskStubSkeleton />,
  },
});
