import { defineExamples } from '@/design/examples';
import { TopBar } from './index';
import spec from './spec';

const LONG_COURSE =
  'Electromagnetics and the physics of electrical machines, second year, spring term';
const LONG_SET =
  'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F';

const LONG_MATERIAL = 'Lecture notes, week 6: magnetic circuits';

export default defineExamples(spec, TopBar, {
  states: {
    home: () => <TopBar homeHref="#" settingsHref="#" />,
    course: () => (
      <TopBar
        homeHref="#"
        path={[{ label: 'Electromagnetics' }]}
        settingsHref="#"
      />
    ),
    workspace: () => (
      <TopBar
        homeHref="#"
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
        homeHref="#"
        path={[
          { label: LONG_COURSE, href: '#' },
          { label: LONG_SET, href: '#' },
          { label: LONG_MATERIAL },
        ]}
        settingsHref="#"
      />
    </div>
  ),
});
