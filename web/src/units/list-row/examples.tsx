import { defineExamples } from '@/design/examples';
import { Link } from '@/units/link';
import { ProgressBar } from '@/units/progress-bar';
import { Tag } from '@/units/tag';
import { ListRow } from './index';
import spec from './spec';

const LONG =
  'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F, with the lab handout';

export default defineExamples(spec, {
  states: {
    plain: () => (
      <ListRow title="Circuits I" href="#" meta={['Problem set 4', '2 of 6']} />
    ),
    status: () => (
      <ListRow
        title="Circuits I"
        href="#"
        status={<Tag>Generated</Tag>}
        meta={['Problem set 4', '2 of 6']}
      />
    ),
    aside: () => (
      <ListRow
        title="Circuits I"
        href="#"
        meta={['Problem set 4', 'About 1 h left']}
        aside={<ProgressBar done={2} total={6} />}
      />
    ),
    'meta-links': () => (
      <ListRow
        title="Circuits I"
        href="#"
        meta={[
          <Link key="s" href="#" tone="muted" size="small">
            Problem set 4
          </Link>,
          '2 of 6',
          <Link key="m" href="#" tone="muted" size="small">
            +1 more
          </Link>,
        ]}
      />
    ),
    'no-href': () => <ListRow title="Circuits I" meta={['Problem set 4']} />,
  },
  stress: () => (
    <div className="w-[320px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <ListRow
        title={LONG}
        href="#"
        status={<Tag>Generated</Tag>}
        meta={[LONG, LONG]}
        aside={<ProgressBar done={2} total={6} />}
      />
    </div>
  ),
});
