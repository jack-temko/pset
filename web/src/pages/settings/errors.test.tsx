import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Group } from '@/api/errors';
import { Errors } from './errors';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let calls: string[];
let kept: Group[];

const reply = (status: number, body: unknown) =>
  ({
    status,
    ok: status < 400,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

beforeEach(() => {
  calls = [];
  kept = [
    {
      id: 'import.failed',
      what: "Couldn't prepare Calculus.",
      count: 2,
      last: '2026-10-10T18:42:00Z',
      incidents: [
        {
          incident: 'E7K2QF',
          at: '2026-10-10T18:42:00Z',
          what: "Couldn't prepare Calculus.",
          chain: ['import.failed', 'key.out_of_credit'],
          route: 'job prepare',
          detail: 'import.failed: key.out_of_credit',
        },
        {
          incident: 'H3M9XD',
          at: '2026-10-10T18:10:00Z',
          what: "Couldn't prepare Statistics.",
          chain: ['import.failed', 'key.out_of_credit'],
          route: 'job prepare',
          detail: 'import.failed: key.out_of_credit',
        },
      ],
    },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (init?.method === 'DELETE') {
        kept = [];
        return Promise.resolve(reply(204, undefined));
      }
      return Promise.resolve(reply(200, kept));
    }),
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
  host.remove();
  vi.unstubAllGlobals();
});

const settle = async () => {
  for (let i = 0; i < 5; i++)
    await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
};
const button = (name: string) =>
  [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes(name),
  );
const click = async (el: Element | undefined) => {
  await act(async () => {
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
  await settle();
};

async function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <Errors />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
  await settle();
}

describe('Settings, Errors', () => {
  it('says so when there are none', async () => {
    kept = [];
    await show();
    expect(host.textContent).toContain('No errors so far.');
    expect(button('Clear all')).toBeUndefined();
  });

  it('lists errors by id with their count, opening onto the incidents', async () => {
    await show();
    expect(host.textContent).toContain("Couldn't prepare Calculus.");
    expect(host.textContent).toContain('2 times');
    expect(host.textContent).not.toContain('E7K2QF');
    await click(button("Couldn't prepare Calculus."));
    expect(host.textContent).toContain('E7K2QF');
    expect(host.textContent).toContain('H3M9XD');
    expect(host.textContent).toContain('import.failed > key.out_of_credit');
  });

  it('clears all only after asking, then shows the empty list', async () => {
    await show();
    await click(button('Clear all'));
    expect(calls).not.toContain('DELETE /api/errors');
    expect(document.body.textContent).toContain('Clear every kept error?');
    const confirm = [...document.querySelectorAll('button')]
      .filter((b) => b.textContent === 'Clear all')
      .at(-1);
    await click(confirm);
    expect(calls).toContain('DELETE /api/errors');
    expect(host.textContent).toContain('No errors so far.');
  });
});
