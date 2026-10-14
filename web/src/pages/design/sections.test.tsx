import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Design } from './index';
import { describe, expect, it } from 'vitest';

import { fixture } from '@/design/registry';
import { LOG_BRANCH, logUrl } from './lookup';
import { RulesPage } from './rules';
import { Decisions, PriorityAndSizes, RulesSection } from './sections';
import { RULES } from '@/design/rules';
import { VISION } from '@/design/vision';

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
    expect(el.textContent.match(/Replaced by/g)).toHaveLength(1);
  });

  it('opens the Rules tab with the vision, then every rule in one list', () => {
    const el = render(<RulesPage />);
    expect(el.textContent).toContain(VISION.line);
    expect(el.querySelectorAll('dt')).toHaveLength(VISION.facts.length);
    expect(el.querySelectorAll('section li')).toHaveLength(RULES.length);
    expect(el.textContent).toContain('failure-says-what');
    expect(el.textContent).toContain('1 unit');
  });

  it("lists a unit's rules flat, local ones labelled", () => {
    const el = render(<RulesSection spec={row} rulebook={RULES} />);
    expect(el.querySelectorAll('li')).toHaveLength(2);
    expect(el.textContent).toContain('local');
  });

  const at = (path: string) => {
    const el = document.createElement('div');
    act(() => {
      createRoot(el).render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/design/*" element={<Design />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    return el;
  };

  // One test per rule, so the cost of a rule is its own and a new rule adds
  // a test instead of lengthening one.
  it.each(RULES.map((r) => [r.id, r] as const))(
    'renders the page of the rule %s',
    (_id, r) => {
      const el = at(`/design/rules/${r.id}`);
      expect(el.querySelector('h1')?.textContent).toBe(r.id);
      expect(el.textContent).toContain(r.check);
      expect(el.textContent).toContain(r.scope);
      expect(el.textContent).toContain('Cited by');
    },
  );

  it('says which units cite a rule, or that none does', () => {
    const keep = at('/design/rules/keep-the-place');
    expect(keep.textContent).toContain('No unit cites it.');
    const cited = at('/design/rules/failure-says-what');
    expect(cited.textContent).toContain('Sample row');
  });

  it('shows a plain state for an unknown rule id', () => {
    const none = at('/design/rules/no-such-rule');
    expect(none.textContent).toContain('No rule with this id');
    expect(
      [...none.querySelectorAll('a')].some(
        (a) =>
          a.getAttribute('href') === '/design/rules' &&
          a.textContent === 'Back to Rules',
      ),
    ).toBe(true);
  });
});
