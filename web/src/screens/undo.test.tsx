import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearPressed, pressUndo } from '@/data/undo';
import { TOAST_MS } from '@/units/undo-toast';

import { UndoToastHost } from './undo';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const fetchMock = vi.fn<typeof fetch>();
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <MemoryRouter>
        <UndoToastHost />
      </MemoryRouter>,
    );
  });
});
afterEach(() => {
  act(() => {
    root.unmount();
    clearPressed();
  });
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const press = async () => {
  await act(async () => {
    await pressUndo();
  });
};

describe('the undo toast', () => {
  it('says what Ctrl+Z took back, and leaves by itself', async () => {
    fetchMock.mockResolvedValue(
      reply(200, {
        action: 'a1',
        undo: 'u1',
        said: 'Renamed back to Problem set 4.',
        seq: 2,
      }),
    );
    await press();
    expect(host.textContent).toContain('Renamed back to Problem set 4.');
    expect(host.textContent).toContain('Redo');
    act(() => {
      vi.advanceTimersByTime(TOAST_MS);
    });
    expect(host.textContent).toBe('');
  });

  it('redoes by the undo’s own id, and says that instead', async () => {
    fetchMock
      .mockResolvedValueOnce(
        reply(200, { action: 'a1', undo: 'u1', said: 'Renamed back.', seq: 2 }),
      )
      .mockResolvedValueOnce(
        reply(200, {
          action: 'u1',
          undo: 'u2',
          said: 'Renamed again.',
          seq: 3,
        }),
      );
    await press();
    const redo = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Redo',
    );
    await act(async () => {
      redo?.click();
      // Lets the redo answer; the toast's own 6 s is not reached.
      await vi.advanceTimersByTimeAsync(0);
    });
    const body = fetchMock.mock.calls[1]?.[1]?.body;
    expect(typeof body === 'string' ? JSON.parse(body) : body).toEqual({
      action: 'u1',
    });
    expect(host.textContent).toContain('Renamed again.');
  });

  it('says why when there is nothing to undo, with no Redo', async () => {
    fetchMock.mockResolvedValue(
      reply(409, {
        id: 'store.nothing_to_undo',
        what: 'There’s nothing to undo.',
        scope: 'inline',
        chain: ['store.nothing_to_undo'],
      }),
    );
    await press();
    expect(host.textContent).toContain('There’s nothing to undo.');
    expect(host.textContent).not.toContain('Redo');
  });
});
