import { defineExamples } from '@/design/examples';
import {
  AskStub,
  AskStubSkeleton,
  MaterialStub,
  MaterialStubSkeleton,
  WorkStub,
  WorkStubSkeleton,
  type StubProblem,
} from './index';
import spec from './spec';

const noop = () => {};

const PROBLEMS: StubProblem[] = [
  {
    id: 'p1',
    title: 'Problem 1',
    text: 'Find the equivalent resistance seen by the source in the ladder network.',
    page: 112,
  },
  {
    id: 'p2',
    title: 'Problem 2',
    text: 'Use mesh analysis to find the current through the 4 ohm resistor.',
    page: 118,
  },
  {
    id: 'p3',
    title: 'Problem 3',
    text: 'State and apply the superposition principle to the circuit of problem 2.',
    page: 121,
  },
];

const LONG =
  'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F';

const work = (name: string, problems = PROBLEMS) => (
  <WorkStub
    name={name}
    material="Griffiths"
    problems={problems}
    onPage={noop}
    onAsk={noop}
  />
);

export default defineExamples(spec, {
  states: {
    work: () => work('Problem set 4'),
    material: () => <MaterialStub name="Griffiths" page={112} />,
    ask: () => <AskStub about="Problem 2, Problem set 4" />,
  },
  stress: () =>
    work(
      LONG,
      PROBLEMS.map((p) => ({
        ...p,
        text: `${p.text} ${p.text} ${p.text}`,
        page: p.page * 10,
      })),
    ),
  skeletons: {
    work: () => <WorkStubSkeleton />,
    material: () => <MaterialStubSkeleton />,
    ask: () => <AskStubSkeleton />,
  },
});
