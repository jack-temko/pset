import { describe, expect, it } from 'vitest';

import type { View } from '@/api/gen/errs';
import type { Question } from '@/api/homework';
import { agoWords, failedLine } from './failed-line';

const now = Date.parse('2026-09-30T12:00:00Z');
const q = (over: Partial<Question>) => over as Question;
const err = (...chain: string[]): View => ({
  id: chain[0],
  what: 'It failed.',
  scope: 'inline',
  chain,
});

describe('agoWords', () => {
  it('reads mid-sentence', () => {
    expect(agoWords(20_000)).toBe('just now');
    expect(agoWords(60_000)).toBe('a minute ago');
    expect(agoWords(7 * 60_000)).toBe('7 minutes ago');
    expect(agoWords(60 * 60_000)).toBe('an hour ago');
    expect(agoWords(3 * 3_600_000)).toBe('3 hours ago');
  });
});

describe('failedLine', () => {
  const at = (minutesAgo: number) =>
    new Date(now - minutesAgo * 60_000).toISOString();

  it('says a second failure is one', () => {
    expect(
      failedLine(
        q({
          attempts: 1,
          failedAt: at(2),
          error: err('homework.guide_failed'),
        }),
        now,
      ),
    ).toBe('Tried once more and it failed again, 2 minutes ago.');
    expect(
      failedLine(
        q({
          attempts: 3,
          failedAt: at(0),
          error: err('homework.guide_failed', 'model.busy'),
        }),
        now,
      ),
    ).toBe('Tried 3 more times and it failed again, just now.');
  });

  it('tells a model outage from the start how long ago it was', () => {
    expect(
      failedLine(
        q({
          attempts: 0,
          failedAt: at(5),
          error: err('homework.guide_failed', 'model.busy'),
        }),
        now,
      ),
    ).toBe('It failed 5 minutes ago.');
  });

  it('has nothing to add to a first failure of another kind, or with no time', () => {
    expect(
      failedLine(
        q({
          attempts: 0,
          failedAt: at(5),
          error: err('homework.guide_failed'),
        }),
        now,
      ),
    ).toBeNull();
    expect(
      failedLine(q({ error: err('homework.guide_failed', 'model.busy') }), now),
    ).toBeNull();
    expect(failedLine(q({ attempts: 2 }), now)).toBe(
      'Tried 2 more times and it failed again.',
    );
  });
});
