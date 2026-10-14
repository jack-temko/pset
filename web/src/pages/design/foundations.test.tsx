import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import { COLOURS, SPACING, TYPE } from '@/design/tokens';
import { Foundations } from './foundations';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render() {
  const el = document.createElement('div');
  act(() => {
    createRoot(el).render(<Foundations />);
  });
  return el;
}

describe('the Foundations page', () => {
  const el = render();

  it('draws under the ds class', () => {
    expect(el.firstElementChild?.classList.contains('ds')).toBe(true);
  });

  it('shows every colour with its value and measured contrast', () => {
    for (const c of COLOURS) {
      const row = el.querySelector(`[data-colour="${c.name}"]`);
      expect(row?.textContent, c.name).toContain(c.value);
      expect(row?.querySelectorAll('[data-ground]')).toHaveLength(c.on.length);
    }
    expect(el.querySelector('[data-colour="fg"]')?.textContent).toMatch(
      /on bg: \d+\.\d:1, needs 4\.5:1, passes/,
    );
  });

  it('shows the eight type steps, the spacing and the radii', () => {
    expect(TYPE).toHaveLength(8);
    for (const t of TYPE) {
      const row = el.querySelector(`[data-step="${t.id}"]`);
      expect(row?.textContent).toContain(t.sample);
      expect(row?.querySelector(`.ds-${t.id}`)).not.toBeNull();
    }
    expect(el.querySelectorAll('[data-space]')).toHaveLength(SPACING.length);
    expect(el.querySelectorAll('[data-radius]')).toHaveLength(4);
  });
});
