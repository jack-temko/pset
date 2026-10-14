import { defineExamples } from '@/design/examples';
import { TopBar } from './index';
import spec from './spec';

const LONG_COURSE =
  'Electromagnetics and the physics of electrical machines, second year, spring term';
const LONG_SET =
  'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F';

export default defineExamples(spec, {
  states: {
    home: () => <TopBar settingsHref="#" />,
    course: () => (
      <TopBar path={[{ label: 'Electromagnetics' }]} settingsHref="#" />
    ),
    workspace: () => (
      <TopBar
        path={[
          { label: 'Electromagnetics', href: '#' },
          { label: 'Problem set 4' },
        ]}
        settingsHref="#"
      />
    ),
  },
  stress: () => (
    <div className="w-[1024px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <TopBar
        path={[{ label: LONG_COURSE, href: '#' }, { label: LONG_SET }]}
        settingsHref="#"
      />
    </div>
  ),
});
