import { defineExamples } from '@/design/examples';
import { Workspace } from './index';
import { COURSE, LONG_COURSE } from './sample';
import spec from './spec';
import { STATES } from './states';
import * as m from './model';

/** The view fills its window; the design page gives it a window's height. */
const Window = ({ children }: { children: React.ReactNode }) => (
  <div className="h-[640px] outline-[1px] outline-(--ds-border-muted)">
    {children}
  </div>
);

const view = (
  id: keyof typeof STATES,
  loading?: { left?: boolean; right?: boolean },
) => (
  <Window>
    <Workspace
      key={id}
      course={COURSE}
      initial={STATES[id]()}
      loading={loading}
    />
  </Window>
);

const both = { left: true, right: true };

/** The worst names, in a workspace with many tabs and a question asked. */
function stress() {
  let st = m.openSet('ps4', { ref: 'griffiths', page: 112 });
  st = m.askAbout(st, 1, 'p2');
  for (let i = 0; i < 6; i++)
    st = m.add(st, 1, {
      kind: 'material',
      ref: 'griffiths',
      page: 100 + i * 111,
    });
  return (
    <Window>
      <Workspace course={LONG_COURSE} initial={st} />
    </Window>
  );
}

const states = Object.fromEntries(
  (Object.keys(STATES) as (keyof typeof STATES)[]).map((id) => [
    id,
    () => view(id, id === 'loading' ? { right: true } : undefined),
  ]),
) as Record<keyof typeof STATES, () => React.ReactNode>;

const skeletons = Object.fromEntries(
  (Object.keys(STATES) as (keyof typeof STATES)[]).map((id) => [
    id,
    () => view(id, both),
  ]),
) as Record<keyof typeof STATES, () => React.ReactNode>;

export default defineExamples(spec, { states, stress, skeletons });
