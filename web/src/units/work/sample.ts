import { problemAt, sampleProblems, WITH_PARTS } from '@/units/problem/sample';
import type { ProblemData } from '@/units/problem/types';
import { parseDueDate } from '@/units/set-line/dates';
import type { WorkSet } from './sets';

/** A fixed Tuesday, so "Due Thu" reads the same on every visit. */
export const TODAY = new Date(2026, 9, 13, 12);

const base = (
  problems: ProblemData[],
  over: Partial<WorkSet> = {},
): WorkSet => ({
  id: 'ps4',
  name: 'Problem set 4',
  due: parseDueDate('2026-10-15'),
  minutesLeft: 70,
  minutesSpent: 130,
  problems,
  ...over,
});

/** Eight problems, three done, the fourth (with a note and parts) next. */
export const inProgress = () => base(sampleProblems(3));

/** All eight done. */
export const allDone = () =>
  base(sampleProblems(8), { minutesLeft: undefined });

/** The fifth problem is still being found. */
export const finding = () =>
  base(
    sampleProblems(4).map((p, i) =>
      i === 4
        ? { ...p, found: { status: 'finding' as const, seconds: 10 } }
        : p,
    ),
  );

/** The fifth could not be found, once. */
export const failedOnce = () =>
  base(
    sampleProblems(4).map((p, i) =>
      i === 4
        ? {
            ...p,
            found: {
              status: 'failed' as const,
              tries: 1,
              tried: ['Looked for "4.62" on page 112 and found no problem.'],
            },
          }
        : p,
    ),
  );

/** Everything done and handed in. */
export const turnedIn = () => ({ ...allDone(), turnedIn: true });

/** Long labels, long statements, a note and 30 problems in the strip. */
export function stress(): WorkSet {
  const long = (i: number): ProblemData => {
    const p = problemAt(i % 8, {
      id: `s${String(i + 1)}`,
      label: `Chapter 12 review, section 12.${String(i + 1)}, exercise ${String(i + 1)}b`,
      done: i % 3 === 0,
    });
    return i === 0
      ? {
          ...p,
          ...WITH_PARTS,
          statement: [
            ...p.statement,
            { t: ' ' },
            ...p.statement,
            { t: ' ' },
            ...p.statement,
            {
              t:
                ' Pneumonoultramicroscopicsilicovolcanoconiosis' +
                'x'.repeat(60),
            },
          ],
        }
      : p;
  };
  return base(
    Array.from({ length: 30 }, (_, i) => long(i)),
    {
      name: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
      minutesLeft: 1250,
    },
  );
}
