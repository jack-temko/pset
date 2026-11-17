import { describe, expect, it } from 'vitest';

import { grillSummary } from './grill';

describe('grillSummary', () => {
  it('keeps everything above the first later heading', () => {
    const src =
      '# Homework: grill\n\nstatus: approved\n\n## Summary\n\nOne line.\n\n## Reversals\n\nnone\n\n## Log\n\nQ1\n';
    expect(grillSummary(src)).toBe(
      '# Homework: grill\n\nstatus: approved\n\n## Summary\n\nOne line.\n',
    );
  });

  it('stops at whichever later heading comes first', () => {
    expect(
      grillSummary(
        '## Summary\n\nx\n\n## Frontier\n\ny\n\n## Reversals\n\nz\n',
      ),
    ).toBe('## Summary\n\nx\n');
  });

  it('returns a file with no later heading whole', () => {
    expect(grillSummary('## Summary\n\nx\n')).toBe('## Summary\n\nx\n');
  });

  it('does not stop at a heading that only starts with the same word', () => {
    expect(grillSummary('## Summary\n\n## Logic\n\nx\n')).toBe(
      '## Summary\n\n## Logic\n\nx\n',
    );
  });
});
