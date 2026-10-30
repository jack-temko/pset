import { defineExamples } from '@/design/examples';
import { MemoryArea } from './index';
import spec from './spec';

export default defineExamples(spec, MemoryArea, {
  states: {
    'a-one-list': () => <MemoryArea option="list" />,
    'b-two-lists': () => <MemoryArea option="two-lists" />,
    'c-chips': () => <MemoryArea option="chips" />,
    'd-review': () => <MemoryArea option="review" />,
    empty: () => <MemoryArea option="list" empty />,
    'no-results': () => <MemoryArea option="list" query="pspice2" />,
    editing: () => <MemoryArea option="list" editing="m7" />,
    deleted: () => <MemoryArea option="list" deleted="m7" />,
  },
  stress: () => <MemoryArea option="list" />,
  skeletons: {
    'a-one-list': () => null,
    'b-two-lists': () => null,
    'c-chips': () => null,
    'd-review': () => null,
    empty: () => null,
    'no-results': () => null,
    editing: () => null,
    deleted: () => null,
  },
});
