import { defineExamples } from '@/design/examples';
import { Bone, BoneBlock, Fill } from './index';
import { RHYTHM } from './rhythm';
import spec from './spec';

const STEPS = [
  ['ds-heading', 'Heading'],
  ['ds-reading', 'Reading'],
  ['ds-body', 'Body'],
  ['ds-small', 'Small'],
  ['ds-label', 'Label'],
] as const;

/** A row drawn the way a list row is: title on line one, meta on line two. */
const Row = ({ row }: { row: number }) => (
  <div className="min-h-14 border-b border-(--ds-border-muted) px-4 py-2 last:border-b-0">
    <p className="ds-body font-medium">
      <Bone ch={RHYTHM.title} row={row} />
    </p>
    <p className="ds-small min-h-5">
      <Bone ch={RHYTHM.meta} row={row} />
    </p>
  </div>
);

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
    rhythm: () => (
      <div className="w-[480px] rounded-(--ds-radius-control) border border-(--ds-border)">
        {[0, 1, 2, 3, 4].map((i) => (
          <Row key={i} row={i} />
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
    fill: () => (
      <p className="ds-body font-medium text-(--ds-fg)">
        <Fill ch={RHYTHM.title}>Problem set 4</Fill>
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
