import { defineExamples } from '@/design/examples';
import { Link } from '@/units/link';
import { ListRow } from '@/units/list-row';
import { List } from './index';
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
