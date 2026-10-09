import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import type { Usage } from '@/api/gen/usage';
import { QueryClientProvider } from '@tanstack/react-query';

import { makeQueryClient } from '@/api/query';
import type { Detail } from '@/api/gen/usage';
import { UsageSummary, UsageTrigger } from '.';

// React reads this to know updates are wrapped in act().
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** The text of a UsageLine, rendered. */
function textOf(u: Usage): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => root.render(<UsageSummary usage={u} />));
  const text = host.textContent ?? '';
  act(() => root.unmount());
  return text;
}

const usage = (over: Partial<Usage> = {}): Usage => ({
  rows: [
    {
      model: 'deepseek/deepseek-v4',
      ms: 21_400,
      tokens: 9_812,
      cost: 0.0041,
      calls: 3,
    },
    {
      model: 'perceptron/isaac-0.2',
      ms: 3_200,
      tokens: 1_204,
      cost: 0.0006,
      calls: 1,
    },
  ],
  total: { ms: 24_600, tokens: 11_016, cost: 0.0047, calls: 4 },
  failed: 0,
  ...over,
});

describe('UsageSummary', () => {
  it('reads model, time, tokens, cost, in that order, with the other models counted', () => {
    expect(textOf(usage())).toBe('deepseek-v4 +1 · $0.0047');
  });

  it('marks a minimum when a call reported nothing, and says nothing for no calls', () => {
    const partial = usage({
      total: { ms: 5_000, tokens: 800, cost: 0.001, calls: 2, uncounted: 1 },
      rows: [{ model: 'a/b', ms: 5_000, calls: 2 }],
    });
    expect(textOf(partial)).toBe('b · ≥ $0.0010');
    expect(textOf(usage({ rows: [] }))).toBe('');
  });
});

// jsdom has no modal dialog; this is enough of one to see it open.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};

const detail: Detail = {
  total: {
    ms: 24_600,
    tokensIn: 9_000,
    tokensOut: 2_016,
    cost: 0.0047,
    calls: 2,
    failed: 1,
  },
  stages: [
    {
      name: 'Guide',
      attempts: 2,
      calls: 2,
      ms: 24_600,
      tokensIn: 9_000,
      tokensOut: 2_016,
      cost: 0.0047,
    },
  ],
  runs: [
    {
      label: 'Calls',
      calls: [
        {
          id: 1,
          at: '2026-09-29T10:00:00Z',
          stage: 'Guide',
          asked: 'a/b',
          ms: 900,
          error: 'rate limited (429)',
        },
      ],
    },
  ],
};

describe('UsageTrigger', () => {
  const mount = () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <QueryClientProvider client={makeQueryClient()}>
          <UsageTrigger
            usage={usage()}
            source={{ kind: 'question', id: 'q1' }}
            name="Problem 3.14"
            detail={detail}
          />
        </QueryClientProvider>,
      ),
    );
    return { host, root };
  };

  it('is a focusable button reading the line, and opens the details on a click', () => {
    const { host, root } = mount();
    const button = host.querySelector('button')!;
    expect(button.textContent).toBe('deepseek-v4 +1 · $0.0047');
    expect(button.getAttribute('aria-label')).toBe(
      'Usage details for Problem 3.14',
    );
    expect(button.hasAttribute('data-copy-skip')).toBe(true);
    // The line is not for copying: Inter, never mono.
    expect(button.innerHTML).not.toMatch(/font-mono|figure/);
    expect(document.querySelector('dialog')).toBeNull();
    act(() => button.click());
    const dialog = document.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.textContent).toContain('Usage · Problem 3.14');
    // Totals, the stage, and the failed call with its error.
    expect(dialog.textContent).toContain('Failed1');
    expect(dialog.textContent).toContain('Guide');
    expect(dialog.textContent).toContain('rate limited (429)');
    act(() => root.unmount());
    host.remove();
  });

  it('draws nothing for a job that made no call', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() =>
      root.render(
        <QueryClientProvider client={makeQueryClient()}>
          <UsageTrigger
            usage={usage({ rows: [] })}
            source={{ kind: 'read', id: 'r1' }}
            name="Read"
          />
        </QueryClientProvider>,
      ),
    );
    expect(host.textContent).toBe('');
    act(() => root.unmount());
  });
});
