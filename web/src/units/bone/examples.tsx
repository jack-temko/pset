import { defineExamples } from '@/design/examples';
import { Bone, BoneBlock } from './index';
import spec from './spec';

const STEPS = [
  ['ds-heading', 'Heading'],
  ['ds-reading', 'Reading'],
  ['ds-body', 'Body'],
  ['ds-small', 'Small'],
  ['ds-label', 'Label'],
] as const;

export default defineExamples(spec, Bone, {
  states: {
    'in-text': () => (
      <div className="space-y-2">
        {STEPS.map(([cls, word]) => (
          <div key={cls} className="flex items-start gap-4">
            <p className={`${cls} w-[120px] text-(--ds-fg)`}>{word}</p>
            <p className={cls}>
              <Bone ch={14} />
            </p>
          </div>
        ))}
      </div>
    ),
    pill: () => (
      <p className="ds-small flex gap-2">
        <Bone ch={7} pill />
        <Bone ch={3} pill />
      </p>
    ),
    block: () => (
      <div className="h-[120px] w-[320px]">
        <BoneBlock />
      </div>
    ),
    still: () => (
      <p className="ds-reading">
        <Bone ch={30} still />
      </p>
    ),
  },
  stress: () => (
    <div className="w-[120px] outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <p className="ds-body">
        <Bone ch={60} />
      </p>
    </div>
  ),
});
