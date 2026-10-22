import { defineExamples } from '@/design/examples';
import { Problem } from './index';
import { problemAt, WALKTHROUGH_WRITING, WITH_PARTS } from './sample';
import spec from './spec';
import type { ProblemData } from './types';

const show = (
  p: ProblemData,
  index = 5,
  props: Partial<Parameters<typeof Problem>[0]> = {},
) => <Problem problem={p} index={index} {...props} />;

const FAILED_TRIED = [
  'Looked for "4.62" on page 112 and found no problem.',
  'Looked one page either side.',
];

export default defineExamples(spec, Problem, {
  states: {
    ready: () => show(problemAt(2), 3, { openHelp: ['hint'] }),
    parts: () => show(problemAt(3, WITH_PARTS), 4),
    plain: () => show(problemAt(5), 6),
    done: () => show(problemAt(2, { done: true }), 3),
    finding: () =>
      show(problemAt(4, { found: { status: 'finding', seconds: 10 } })),
    writing: () => show(problemAt(2, WALKTHROUGH_WRITING), 3),
    failed: () =>
      show(
        problemAt(4, {
          found: { status: 'failed', tries: 1, tried: FAILED_TRIED },
        }),
      ),
    'failed-twice': () =>
      show(
        problemAt(4, {
          found: {
            status: 'failed',
            tries: 2,
            tried: [
              ...FAILED_TRIED,
              'Read the page again with the box you drew.',
            ],
          },
        }),
      ),
  },
  stress: () =>
    show(
      problemAt(3, {
        ...WITH_PARTS,
        label:
          'Chapter 12 review, section 12.14, exercise 14b with its subparts',
        note: [
          {
            t: 'Do (c) and (d) only, and show your work for (d). If the figure is unclear, use the one from lecture 9 instead and say so. ',
          },
          { t: 'Late work loses 10% a day.' },
        ],
        statement: [
          ...(WITH_PARTS.statement ?? []),
          {
            t: ` Pneumonoultramicroscopicsilicovolcanoconiosis${'x'.repeat(60)} `,
          },
          ...problemAt(1).statement,
        ],
      }),
      4,
      { openHelp: ['hint', 'walkthrough', 'answer'] },
    ),
});
