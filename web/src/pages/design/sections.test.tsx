import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { fixture } from '@/design/registry';
import { LOG_BRANCH, logUrl } from './lookup';
import { Decisions, PriorityAndSizes } from './sections';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render(node: React.ReactNode) {
  const el = document.createElement('div');
  act(() => {
    createRoot(el).render(<MemoryRouter>{node}</MemoryRouter>);
  });
  return el;
}

const row = fixture('sample-row').spec;

describe('the sections', () => {
  it('links the full log through the one branch constant', () => {
    const el = render(<Decisions spec={row} />);
    const a = el.querySelector('a');
    expect(a?.getAttribute('href')).toBe(
      `https://github.com/jack-temko/pset/blob/${LOG_BRANCH}/web/src/design/sample/sample-row/log.md`,
    );
    expect(logUrl('x.md')).toContain(`/blob/${LOG_BRANCH}/x.md`);
  });

  it('lists what gives way first one per line', () => {
    const el = render(<PriorityAndSizes spec={row} />);
    expect(el.querySelectorAll('ol li')).toHaveLength(2);
  });

  it('shows Replaced by under What only when set', () => {
    const el = render(
      <Decisions
        spec={{
          ...row,
          decisions: [
            { ...row.decisions[0], supersededBy: 'sample-row-d2' },
            row.decisions[1],
          ],
        }}
      />,
    );
    expect(el.textContent).toContain('Replaced by sample-row-d2');
    expect(el.textContent?.match(/Replaced by/g)).toHaveLength(1);
  });
});
