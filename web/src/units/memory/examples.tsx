import { defineExamples } from '@/design/examples';
import { PLACEHOLDER } from '@/units/list-page/hrefs';
import { MemoryArea } from './index';
import { SAMPLE } from './sample';
import spec from './spec';

const all = PLACEHOLDER.memories;

export default defineExamples(spec, MemoryArea, {
  states: {
    'ask-saves': () => <MemoryArea memories={SAMPLE} showAllHref={all} />,
    'from-ask': () => (
      <MemoryArea memories={SAMPLE} side="ask" showAllHref={all} />
    ),
    empty: () => <MemoryArea memories={[]} showAllHref={all} />,
    editing: () => (
      <MemoryArea memories={SAMPLE} editing="m7" side="you" showAllHref={all} />
    ),
    deleted: () => (
      <MemoryArea memories={SAMPLE} deleted="m7" side="you" showAllHref={all} />
    ),
  },
  stress: () => <MemoryArea memories={SAMPLE} showAllHref={all} />,
});
