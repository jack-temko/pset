import { defineExamples } from '@/design/examples';
import { PLACEHOLDER } from '@/units/list-page/hrefs';
import { MemoryArea } from './index';
import spec from './spec';

const all = PLACEHOLDER.memories;

export default defineExamples(spec, MemoryArea, {
  states: {
    'ask-saves': () => <MemoryArea showAllHref={all} />,
    'from-ask': () => <MemoryArea side="ask" showAllHref={all} />,
    empty: () => <MemoryArea empty showAllHref={all} />,
    editing: () => <MemoryArea editing="m7" side="you" showAllHref={all} />,
    deleted: () => <MemoryArea deleted="m7" side="you" showAllHref={all} />,
  },
  stress: () => <MemoryArea showAllHref={all} />,
  skeletons: {
    'ask-saves': () => null,
    'from-ask': () => null,
    empty: () => null,
    editing: () => null,
    deleted: () => null,
  },
});
