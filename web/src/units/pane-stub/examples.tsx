import { defineExamples } from '@/design/examples';
import {
  AskStub,
  AskStubSkeleton,
  MaterialStub,
  MaterialStubSkeleton,
} from './index';
import spec from './spec';

export default defineExamples(spec, {
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
