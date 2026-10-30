import { defineExamples } from '@/design/examples';
import { MemoryArea } from './index';
import spec from './spec';

export default defineExamples(spec, MemoryArea, {
  states: {
    'ask-saves': () => <MemoryArea />,
    'show-all': () => <MemoryArea showAll />,
    empty: () => <MemoryArea empty />,
    editing: () => <MemoryArea editing="m7" showAll />,
    deleted: () => <MemoryArea deleted="m7" />,
  },
  stress: () => <MemoryArea showAll />,
  skeletons: {
    'ask-saves': () => null,
    'show-all': () => null,
    empty: () => null,
    editing: () => null,
    deleted: () => null,
  },
});
