import { defineExamples } from '@/design/examples';
import { Settings, SettingsSkeleton } from './index';
import {
  CHECK_FAILING,
  ERRORS_KEPT,
  FINE,
  KEY_FAILED,
  NO_KEY,
  STRESS,
  UPDATE_AVAILABLE,
  UPDATING,
} from './sample';
import spec from './spec';

const view = (p: Partial<Parameters<typeof Settings>[0]> = {}) => (
  <Settings settings={FINE} {...p} />
);

export default defineExamples(spec, Settings, {
  states: {
    fine: () => view(),
    'no-key': () => view({ settings: NO_KEY }),
    'key-failed': () => view({ settings: KEY_FAILED }),
    'update-available': () => view({ settings: UPDATE_AVAILABLE }),
    updating: () => view({ settings: UPDATING }),
    'check-failing': () => view({ settings: CHECK_FAILING }),
    'errors-kept': () => view({ settings: ERRORS_KEPT, unfolded: true }),
    failed: () => view({ failed: true }),
  },
  stress: () => view({ settings: STRESS, unfolded: true }),
  skeletons: {
    fine: () => <SettingsSkeleton />,
    'no-key': () => <SettingsSkeleton />,
    'key-failed': () => <SettingsSkeleton />,
    'update-available': () => <SettingsSkeleton />,
    updating: () => <SettingsSkeleton />,
    'check-failing': () => <SettingsSkeleton />,
    'errors-kept': () => <SettingsSkeleton />,
    failed: () => <SettingsSkeleton />,
  },
});
