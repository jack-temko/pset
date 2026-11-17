import { defineExamples } from '@/design/examples';
import { Sparkline } from './index';
import spec from './spec';

const FRAME =
  'w-[240px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)';

export default defineExamples(spec, Sparkline, {
  states: {
    busy: () => (
      <div className={FRAME}>
        <Sparkline
          values={[20, 45, 0, 60, 80, 15, 0, 35, 90, 120, 40, 0, 65, 95]}
        />
      </div>
    ),
    flat: () => (
      <div className={FRAME}>
        <Sparkline values={Array.from({ length: 14 }, () => 0)} />
      </div>
    ),
    'one-day': () => (
      <div className={FRAME}>
        <Sparkline values={[40]} />
      </div>
    ),
  },
  stress: () => (
    <div className="w-24 max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <Sparkline values={Array.from({ length: 60 }, (_, i) => (i * 37) % 91)} />
    </div>
  ),
});
