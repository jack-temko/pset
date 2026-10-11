import { describe, expect, it } from 'vitest';

import { bands } from '@/lib/greeting';
import { finishStats, hardWhy, shortTime, toMinutes } from './finish-stats';
import { finishBands, finishLine } from './greetings';
import type { Q } from './progress';
import { makeQuestion } from './world';

const q = (seconds?: number, difficulty?: number): Q => ({
  ...makeQuestion({
    homeworkId: 'h',
    position: 0,
    label: 'x',
    state: 'ready',
    done: true,
  }),
  seconds,
  difficulty,
});

describe('finishStats', () => {
  it('totals, averages over the timed ones and names the longest two', () => {
    const s = finishStats([q(600), q(1800), q(), q(1200)]);
    expect(s.total).toBe(3600);
    expect(s.timed).toBe(3);
    expect(s.average).toBe(1200);
    expect(s.hardest.map((x) => x.seconds)).toEqual([1800, 1200]);
    expect(s.most).toBe(1800);
  });

  it('has nothing to say about hardest with fewer than two timed', () => {
    expect(finishStats([q(600), q()]).hardest).toEqual([]);
    expect(finishStats([q(), q()])).toMatchObject({
      total: 0,
      average: 0,
      timed: 0,
      most: 0,
    });
  });
});

describe('time words', () => {
  it('rounds to minutes, at least one', () => {
    expect(toMinutes(20)).toBe(1);
    expect(toMinutes(0)).toBe(0);
    expect(shortTime(2460)).toBe('41m');
    expect(shortTime(3900)).toBe('1h 5m');
    expect(shortTime(7200)).toBe('2h');
  });

  it('says why a question is among the hardest', () => {
    const all = [q(2400, 4), q(1800, 2)];
    expect(hardWhy(all[0], 0, all)).toBe(
      'Longest, and the highest difficulty in the set',
    );
    expect(hardWhy(all[1], 1, all)).toBe('Second longest');
    expect(hardWhy(q(100), 0, [q(100)])).toBe('Longest');
  });
});

describe('the finish line', () => {
  it('has a line set for every stretch Home has, three each', () => {
    expect(finishBands.map((b) => b.from)).toEqual(bands.map((b) => b.from));
    for (const b of finishBands) expect(b.lines).toHaveLength(3);
  });

  it('picks by the pick and drops the name whole when there is none', () => {
    expect(finishLine(22, 'Jack', 0)).toBe('Long night, Jack. It shows.');
    expect(finishLine(22, '', 0)).toBe('Long night. It shows.');
    expect(finishLine(1, 'Jack', 0.999999)).toBe(
      'Bed now, Jack. You finished.',
    );
  });

  it('leaves no placeholder, em dash or stray space in any line', () => {
    for (const b of finishBands)
      for (const line of b.lines)
        for (const name of ['Jack', '']) {
          const out = finishLine(
            b.from,
            name,
            b.lines.indexOf(line) / 3 + 0.01,
          );
          expect(out).not.toMatch(/\{|—|\s\s| [?.!,]/);
        }
  });
});
