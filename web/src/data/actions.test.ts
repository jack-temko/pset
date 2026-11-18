import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Condition } from '@/api/gen/condition';

import { blockedBy, canUndo, redo, runAction, undoAction } from './actions';
import { bindKey, isTyping, keyOf } from './keys';
import { clearPressed, pressUndo } from './undo';

const fetchMock = vi.fn<typeof fetch>();

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const sent = (i: number) => {
  const [url, init] = fetchMock.mock.calls[i] ?? [];
  const body = init?.body;
  return {
    url,
    body: typeof body === 'string' ? (JSON.parse(body) as unknown) : body,
  };
};

describe('actions', () => {
  it('posts an action to its route with its typed input', async () => {
    fetchMock.mockResolvedValue(reply(200, { action: 'a1', seq: 7 }));
    const done = await runAction('course.rename', { id: 'c1', name: 'Calc' });
    expect(sent(0)).toEqual({
      url: '/api/actions/course.rename',
      body: { id: 'c1', name: 'Calc' },
    });
    expect(done).toEqual({ action: 'a1', seq: 7 });
  });

  it('offers Undo only when the reply names an action', () => {
    expect(canUndo({ action: 'a1', seq: 1 })).toBe(true);
    expect(canUndo({ seq: 1 })).toBe(false);
    expect(canUndo({ action: '', seq: 1 })).toBe(false);
  });

  it('undoes by id, and redoes by the undo’s own id', async () => {
    const undone = { action: 'a1', undo: 'u1', said: 'Renamed back.', seq: 9 };
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, undone)));
    await undoAction('a1');
    await redo(undone);
    expect(sent(0)).toEqual({ url: '/api/undo', body: { action: 'a1' } });
    expect(sent(1)).toEqual({ url: '/api/undo', body: { action: 'u1' } });
  });

  it('is blocked by a need that does not hold, and only by a need', () => {
    const c = (id: Condition['id'], holds: boolean): Condition => ({
      id,
      holds,
      seq: 1,
      since: '',
    });
    // material.add needs the PDF reader.
    expect(blockedBy('material.add', [c('pdf_reader', false)])?.id).toBe(
      'pdf_reader',
    );
    expect(blockedBy('material.add', [c('pdf_reader', true)])).toBeUndefined();
    expect(blockedBy('material.add', [c('key', false)])).toBeUndefined();
    // Not read yet: taken to hold.
    expect(blockedBy('material.add', [])).toBeUndefined();
    expect(blockedBy('course.add', [c('pdf_reader', false)])).toBeUndefined();
  });
});

const press = (
  init: KeyboardEventInit,
  target: EventTarget = document.body,
) => {
  const e = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(e);
  return e;
};

describe('keys', () => {
  it('names keys as the catalog writes them', () => {
    const k = (init: KeyboardEventInit) =>
      keyOf(new KeyboardEvent('keydown', init));
    expect(k({ key: 'd' })).toBe('d');
    expect(k({ key: 'D', shiftKey: true })).toBe('shift+d');
    expect(k({ key: 'z', ctrlKey: true })).toBe('ctrl+z');
    expect(k({ key: 'z', metaKey: true })).toBe('ctrl+z');
    expect(k({ key: 'Z', metaKey: true, shiftKey: true })).toBe('ctrl+shift+z');
    expect(k({ key: '?', shiftKey: true })).toBe('?');
    expect(k({ key: 'Escape' })).toBe('escape');
  });

  it('knows a text box from a button', () => {
    const el = (html: string) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.firstElementChild;
    };
    expect(isTyping(el('<input>'))).toBe(true);
    expect(isTyping(el('<textarea></textarea>'))).toBe(true);
    expect(isTyping(el('<input type="checkbox">'))).toBe(false);
    expect(isTyping(el('<button></button>'))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });

  it('runs the newest binding, and gives the key back when it goes', () => {
    const page = vi.fn();
    const dialog = vi.fn();
    const unPage = bindKey('escape', page);
    const unDialog = bindKey('escape', dialog);
    expect(press({ key: 'Escape' }).defaultPrevented).toBe(true);
    expect(dialog).toHaveBeenCalledTimes(1);
    expect(page).not.toHaveBeenCalled();
    unDialog();
    press({ key: 'Escape' });
    expect(page).toHaveBeenCalledTimes(1);
    unPage();
    expect(press({ key: 'Escape' }).defaultPrevented).toBe(false);
  });

  it('leaves keys to a text box, unless bound while typing', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const done = vi.fn();
    const palette = vi.fn();
    const un = [
      bindKey('d', done),
      bindKey('ctrl+z', done),
      bindKey('ctrl+k', palette, { whileTyping: true }),
    ];
    expect(press({ key: 'd' }, input).defaultPrevented).toBe(false);
    expect(press({ key: 'z', ctrlKey: true }, input).defaultPrevented).toBe(
      false,
    );
    press({ key: 'k', ctrlKey: true }, input);
    expect(done).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledTimes(1);
    un.forEach((u) => {
      u();
    });
    input.remove();
  });

  it('does not repeat an action for a held key', () => {
    const run = vi.fn();
    const un = bindKey('ctrl+z', run);
    press({ key: 'z', ctrlKey: true });
    press({ key: 'z', ctrlKey: true, repeat: true });
    expect(run).toHaveBeenCalledTimes(1);
    un();
  });
});

describe('Ctrl+Z', () => {
  afterEach(() => {
    clearPressed();
  });

  it('sends one undo at a time, so two presses take back two actions', async () => {
    let open = 0;
    let most = 0;
    fetchMock.mockImplementation(async () => {
      open++;
      most = Math.max(most, open);
      await new Promise((r) => setTimeout(r, 5));
      open--;
      return reply(200, { action: 'a', undo: 'u', said: 'x', seq: 1 });
    });
    await Promise.all([pressUndo(), pressUndo()]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(most).toBe(1);
    expect(sent(0).body).toEqual({ newest: true });
  });

  it('keeps going after a refusal', async () => {
    fetchMock
      .mockResolvedValueOnce(
        reply(409, {
          id: 'store.nothing_to_undo',
          what: 'There’s nothing to undo.',
          scope: 'inline',
          chain: ['store.nothing_to_undo'],
        }),
      )
      .mockResolvedValueOnce(
        reply(200, { action: 'a', undo: 'u', said: 'x', seq: 1 }),
      );
    await pressUndo();
    await pressUndo();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
