import { useState } from 'react';

import { defineExamples } from '@/design/examples';
import { Link } from '@/units/link';
import { ListRow } from '@/units/list-row';
import { List, LIST_CAP, type ListState } from './index';
import spec from './spec';

const action = (
  <Link href="#" size="small">
    Show all
  </Link>
);
const NAMES = [
  'Circuits I',
  'Signals and systems',
  'Differential equations',
  'Linear algebra',
  'Thermodynamics',
  'Statics',
  'Dynamics',
  'Materials science',
];
const rows = (n: number) =>
  NAMES.slice(0, n).map((c) => (
    <ListRow key={c} title={c} href="#" meta={['Problem set 4', '2 of 6']} />
  ));

const SIDES = [
  { id: 'todo', label: 'To do', count: 1 },
  { id: 'done', label: 'Done', count: 6 },
] satisfies ListState[];

/** A list holding its own chosen state, as a screen does. */
function Switched({ todo = 1 }: { todo?: number }) {
  const [state, setState] = useState('todo');
  const sides = [{ ...SIDES[0], count: todo }, SIDES[1]] satisfies ListState[];
  return (
    <List
      states={sides}
      state={state}
      onState={setState}
      cap={LIST_CAP}
      showAllHref="#"
      empty={state === 'todo' ? 'Nothing to do' : 'Nothing done yet'}
    >
      {rows(state === 'todo' ? todo : 6)}
    </List>
  );
}

export default defineExamples(spec, List, {
  states: {
    header: () => (
      <List title="Courses" count={8} action={action}>
        {rows(3)}
      </List>
    ),
    'no-header': () => <List>{rows(3)}</List>,
    empty: () => <List title="Courses" />,
    eight: () => <List>{rows(8)}</List>,
    switch: () => <Switched />,
    capped: () => (
      <List title="Courses" cap={LIST_CAP} showAllHref="#">
        {rows(8)}
      </List>
    ),
    'switch-empty': () => <Switched todo={0} />,
  },
  stress: () => (
    <div className="w-[240px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <List
        title="Electromagnetics and the physics of electrical machines, second year"
        count={8}
        action={action}
      >
        {rows(2)}
      </List>
    </div>
  ),
});
