import { describe, expect, it } from 'vitest';
import {
  check,
  format,
  MAX_BLOCK_PX,
  MAX_GROWTH_PX,
  MAX_JUMP,
  MAX_TOTAL_PX,
} from './check.mjs';

const agg = (over = {}) => ({
  runs: 3,
  waitedOn: '',
  jump: { median: 0, p95: 0 },
  growthPx: { median: 0, p95: 0 },
  timeouts: 0,
  moved: [],
  overlays: [],
  ...over,
});
const row = (over = {}) => ({
  name: 'Memory',
  mode: 'real',
  agg: agg(),
  ...over,
});
const report = (...rows) => ({ meta: {}, rows });

describe('thresholds', () => {
  it('passes a quiet row', () => {
    expect(check(report(row())).failed).toEqual([]);
  });
  it('passes exactly at the limits and fails just over', () => {
    expect(
      check(report(row({ agg: agg({ growthPx: { median: MAX_GROWTH_PX } }) })))
        .failed,
    ).toEqual([]);
    expect(
      check(report(row({ agg: agg({ jump: { median: MAX_JUMP } }) }))).failed,
    ).toEqual([]);
    expect(
      check(
        report(
          row({ agg: agg({ growthPx: { median: MAX_GROWTH_PX + 0.5 } }) }),
        ),
      ).failed,
    ).toHaveLength(1);
    expect(
      check(report(row({ agg: agg({ jump: { median: MAX_JUMP + 0.0005 } }) })))
        .failed,
    ).toHaveLength(1);
  });
  it('names the numbers and the elements that moved', () => {
    const r = row({
      agg: agg({
        jump: { median: 0.05 },
        moved: [{ sel: 'main > section', value: 0.05, runs: 3 }],
        growthPx: { median: 40 },
        overlays: [
          {
            name: 'Memory',
            growthPx: 40,
            first: { w: 500, h: 100 },
            final: { w: 500, h: 140 },
          },
        ],
      }),
    });
    const out = format(check(report(r)), 1);
    expect(out).toContain('FAIL: Memory (real)');
    expect(out).toContain('40px');
    expect(out).toContain('Memory 500x100 to 500x140');
    expect(out).toContain('main > section 0.050');
  });
});

describe('timeouts', () => {
  it('a scenario that never settles fails, even with no shift', () => {
    const r = row({ agg: agg({ timeouts: 1, waitedOn: 'skeleton' }) });
    const { failed } = check(report(r));
    expect(failed).toHaveLength(1);
    expect(failed[0].why[0]).toContain('never settled');
  });
});

describe('the allow-list', () => {
  const bad = { agg: agg({ jump: { median: 0.2 } }) };
  it('ignores a row it names, and keeps the reason', () => {
    const res = check(report(row(bad)), [
      { scenario: 'Memory', reason: 'the dialog fades in by design' },
    ]);
    expect(res.failed).toEqual([]);
    expect(res.ignored[0].reason).toBe('the dialog fades in by design');
    expect(format(res, 1)).toContain('allowed: Memory');
  });
  it('matches a mode only when the entry names one', () => {
    const entry = { scenario: 'Memory', mode: 'slow', reason: 'r' };
    expect(
      check(report(row({ ...bad, mode: 'real' })), [entry]).failed,
    ).toHaveLength(1);
    expect(
      check(report(row({ ...bad, mode: 'slow' })), [entry]).failed,
    ).toEqual([]);
  });
  it('matches the scenario name exactly', () => {
    expect(
      check(report(row(bad)), [{ scenario: 'Memo', reason: 'r' }]).failed,
    ).toHaveLength(1);
  });
});

describe('skipped scenarios', () => {
  it('are listed, not failed', () => {
    const res = check(
      report(
        row({
          name: 'Edit book',
          agg: undefined,
          skipped: 'the library has no book',
        }),
      ),
    );
    expect(res.failed).toEqual([]);
    expect(format(res, 1)).toContain(
      'skipped: Edit book (real): the library has no book',
    );
  });
});

describe('skeleton fidelity', () => {
  const fid = (over = {}) => ({
    box: 'main > div',
    skeleton: 'done',
    content: 'done',
    blockPx: 0,
    totalPx: 0,
    blocks: [3, 3],
    ...over,
  });
  const boxRow = (boxes) =>
    row({
      agg: agg({ boxes: { fidelity: [], flashes: [], doubles: [], ...boxes } }),
    });

  it('passes a skeleton that matches', () => {
    expect(check(report(boxRow({ fidelity: [fid()] }))).failed).toEqual([]);
  });
  it('fails a variant mismatch, naming both', () => {
    const { failed } = check(
      report(boxRow({ fidelity: [fid({ skeleton: 'question' })] })),
    );
    expect(failed).toHaveLength(1);
    expect(failed[0].why[0]).toContain(
      '"question" variant but the content is "done"',
    );
  });
  it('a block is allowed 8px and no more', () => {
    const at = boxRow({ fidelity: [fid({ blockPx: MAX_BLOCK_PX })] });
    const over = boxRow({ fidelity: [fid({ blockPx: MAX_BLOCK_PX + 1 })] });
    expect(check(report(at)).failed).toEqual([]);
    expect(check(report(over)).failed).toHaveLength(1);
  });
  it('the whole is allowed 2px and no more', () => {
    const at = boxRow({ fidelity: [fid({ totalPx: MAX_TOTAL_PX })] });
    const over = boxRow({ fidelity: [fid({ totalPx: MAX_TOTAL_PX + 1 })] });
    expect(check(report(at)).failed).toEqual([]);
    expect(check(report(over)).failed).toHaveLength(1);
  });
});

describe('flashes and double reveals', () => {
  const boxRow = (boxes) =>
    row({
      agg: agg({ boxes: { fidelity: [], flashes: [], doubles: [], ...boxes } }),
    });
  it('fails a box whose variant changes after its reveal', () => {
    const { failed } = check(
      report(
        boxRow({
          flashes: [{ box: 'main > div', from: 'question', to: 'done' }],
        }),
      ),
    );
    expect(failed[0].why[0]).toContain(
      '"question" variant to "done" after it was revealed',
    );
  });
  it('fails a box revealed twice in one navigation', () => {
    const { failed } = check(
      report(boxRow({ doubles: [{ box: 'main > div', count: 2 }] })),
    );
    expect(failed[0].why[0]).toContain(
      'revealed 2 times without a new navigation',
    );
  });
  it('a row with no box findings, or from before the probe, passes', () => {
    expect(check(report(boxRow({}))).failed).toEqual([]);
    expect(check(report(row())).failed).toEqual([]);
  });
});

describe('a tagged scenario must show its view and variant', () => {
  const seen = (content, skeleton = []) => ({
    variantsSeen: { content, skeleton },
  });
  const tagged = (over, a = {}) =>
    row({
      variant: 'homeworkSet/finish',
      ...over,
      agg: agg({ ...seen([]), ...a }),
    });

  it('passes when a box showed the view and variant', () => {
    expect(
      check(
        report(
          tagged({}, seen(['homeworkSet/finish', 'homeworkSet/question'])),
        ),
      ).failed,
    ).toEqual([]);
  });
  it('fails when no box did, naming what it saw', () => {
    const { failed } = check(
      report(tagged({}, seen(['homeworkSet/question']))),
    );
    expect(failed).toHaveLength(1);
    expect(failed[0].why[0]).toContain(
      'homeworkSet/finish: no box showed that view and variant (saw "homeworkSet/question")',
    );
  });
  it('the name alone is not enough: another view with that variant does not count', () => {
    expect(
      check(report(tagged({}, seen(['homeworkList/finish'])))).failed,
    ).toHaveLength(1);
  });
  it('fails when the page has no boxes at all', () => {
    expect(check(report(tagged({}, seen([])))).failed).toHaveLength(1);
  });
  it('a skeleton alone does not count, unless the scenario waits', () => {
    expect(
      check(report(tagged({}, seen([], ['homeworkSet/finish'])))).failed,
    ).toHaveLength(1);
    expect(
      check(report(tagged({ waits: true }, seen([], ['homeworkSet/finish']))))
        .failed,
    ).toEqual([]);
  });
  it('a box with a variant but no view fails, with a clear message, on any row', () => {
    const { failed } = check(report(row({ agg: agg(seen(['/finish'])) })));
    expect(failed).toHaveLength(1);
    expect(failed[0].why[0]).toBe(
      'a box has data-variant "finish" but no data-view, so its view is unknown',
    );
  });
  it('a row without a tag, or a skipped one, is not checked', () => {
    expect(check(report(row({ agg: agg(seen([])) }))).failed).toEqual([]);
    expect(
      check(report(row({ variant: 'ask/turns', agg: undefined, skipped: 'x' })))
        .failed,
    ).toEqual([]);
  });
  it('a report from before the probe recorded variants is not failed for it', () => {
    expect(check(report(row({ variant: 'ask/turns' }))).failed).toEqual([]);
  });
});

describe('lost coverage in the full profile', () => {
  const lostRow = () =>
    row({
      name: 'Book: Memory',
      agg: undefined,
      skipped: 'no trigger',
      lost: true,
    });
  it('fails with failOnLost, and the message says why', () => {
    const res = check(report(lostRow()), [], { failOnLost: true });
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].why[0]).toContain('coverage lost');
    expect(format(res, 1)).toContain('FAIL: Book: Memory');
  });
  it('a hand-written skip is still only a skip', () => {
    const res = check(report(row({ agg: undefined, skipped: 'no book' })), [], {
      failOnLost: true,
    });
    expect(res.failed).toEqual([]);
  });
  it('is not a failure in core, where the default is a printed line', () => {
    expect(check(report(lostRow())).failed).toEqual([]);
  });
});

describe('lost coverage', () => {
  it('a discovered scenario that lost its trigger is listed as LOST, not failed', () => {
    const res = check(
      report(
        row({
          name: 'Book: Memory',
          agg: undefined,
          skipped: 'no trigger',
          lost: true,
        }),
        row({ name: 'Edit book', agg: undefined, skipped: 'no book' }),
      ),
    );
    expect(res.failed).toEqual([]);
    const out = format(res, 2);
    expect(out).toContain('LOST: Book: Memory (real): no trigger');
    expect(out).toContain('skipped: Edit book (real): no book');
    expect(out).toContain('1 LOST');
  });
});
