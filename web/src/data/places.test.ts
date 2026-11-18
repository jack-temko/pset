import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Place } from '@/api/gen/place';

import {
  clearPlace,
  currentPlace,
  flushPlaces,
  KEEPALIVE_MAX,
  keepPlace,
  onPlaceFailed,
  readPlaces,
  resetPlacesForTest,
  RETRY_MS,
  TRIES,
  WRITE_MS,
  type PlaceInput,
} from './places';

const fetchMock = vi.fn<typeof fetch>();

const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const urlOf = (i: number) => {
  const u = fetchMock.mock.calls[i]?.[0];
  return typeof u === 'string' ? u : '';
};
const initOf = (i: number) => fetchMock.mock.calls[i]?.[1];
const bodyOf = (i: number) => {
  const b = initOf(i)?.body;
  return typeof b === 'string' ? (JSON.parse(b) as unknown) : undefined;
};

const page = (n: number, tabId = 't1'): PlaceInput => ({
  ownerKind: 'material',
  ownerId: 'm1',
  kind: 'page',
  tabId,
  page: n,
  down: 0,
});

const draft: PlaceInput = {
  ownerKind: 'course',
  ownerId: 'c1',
  kind: 'ask_draft',
  text: 'why is',
};

const kept = (input: PlaceInput, id = 'p1', seq = 5): Place => ({
  ...input,
  id,
  seq,
  group: 'where',
});

/** Answers every call with a fresh 200: a Response's body is read once. */
const ok = () => {
  fetchMock.mockImplementation(() =>
    Promise.resolve(reply(200, kept(page(1)))),
  );
};

/** Lets every waiting promise and timer up to `ms` run. */
const pass = async (ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms);
};

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  resetPlacesForTest();
  setHidden(false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('reading', () => {
  it('reads a thing’s places once per tab', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(reply(200, { places: [] })),
    );
    await readPlaces([{ kind: 'material', id: 'm1' }]);
    await readPlaces([{ kind: 'material', id: 'm1' }]);
    await readPlaces([
      { kind: 'material', id: 'm1' },
      { kind: 'set', id: 's1' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(0)).toBe('/api/places?owner=material%3Am1');
    expect(urlOf(1)).toBe('/api/places?owner=set%3As1');
  });

  it('reads again after a failed read', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(() => Promise.resolve(reply(200, { places: [] })));
    await readPlaces([{ kind: 'material', id: 'm1' }]);
    await readPlaces([{ kind: 'material', id: 'm1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps this tab’s write over a read that lands after it', async () => {
    let answer: (r: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise((r) => {
        answer = r;
      }),
    );
    const reading = readPlaces([{ kind: 'material', id: 'm1' }]);
    keepPlace(page(9));
    answer(reply(200, { places: [kept(page(2))] }));
    await reading;
    expect(currentPlace(page(9))?.page).toBe(9);
  });
});

describe('writing', () => {
  it('writes the newest of a burst once, after a pause', async () => {
    ok();
    keepPlace(page(1));
    keepPlace(page(2));
    keepPlace(page(3));
    await pass(WRITE_MS - 1);
    expect(fetchMock).not.toHaveBeenCalled();
    await pass(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(initOf(0)?.method).toBe('PUT');
    expect(bodyOf(0)).toEqual(page(3));
    expect(initOf(0)?.keepalive).toBeFalsy();
  });

  it('keeps a tab’s page as the material’s last spot too', () => {
    ok();
    keepPlace(page(7));
    expect(currentPlace({ ...page(7), tabId: undefined })?.page).toBe(7);
  });

  it('keeps a place inside the server’s bounds', async () => {
    ok();
    keepPlace({ ...page(0), down: 1.0000001 });
    await pass(WRITE_MS);
    expect(bodyOf(0)).toMatchObject({ page: 1, down: 1 });
  });

  it('clears a sent draft by writing it empty, after the write before it', async () => {
    let answer: (r: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise((r) => {
        answer = r;
      }),
    );
    keepPlace(draft);
    await pass(WRITE_MS);
    clearPlace({ ownerKind: 'course', ownerId: 'c1', kind: 'ask_draft' });
    expect(currentPlace(draft)).toBeUndefined();
    ok();
    await pass();
    // Still waiting for the first write.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    answer(reply(200, kept(draft)));
    await pass();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(1)).toEqual({
      ownerKind: 'course',
      ownerId: 'c1',
      kind: 'ask_draft',
    });
  });

  it('tries again when the server could not be reached', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(() => Promise.resolve(reply(200, kept(page(4)))));
    keepPlace(page(4));
    await pass(WRITE_MS);
    await pass(RETRY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(1)).toEqual(page(4));
  });

  it('says nothing when the owner was removed', async () => {
    const failed = vi.fn();
    onPlaceFailed(failed);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        reply(404, {
          id: 'request.gone',
          what: 'That material isn’t there.',
          scope: 'inline',
          chain: ['request.gone'],
        }),
      ),
    );
    keepPlace(page(1));
    await pass(WRITE_MS);
    expect(failed).not.toHaveBeenCalled();
  });

  it('tells the error module when a write is refused, and goes on', async () => {
    onPlaceFailed(() => {
      throw new Error('a bug in the listener');
    });
    const failed = vi.fn();
    onPlaceFailed(failed);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        reply(400, {
          id: 'place.bad',
          what: 'PSet couldn’t remember where you were.',
          scope: 'inline',
          chain: ['place.bad'],
        }),
      ),
    );
    keepPlace(page(1));
    await pass(WRITE_MS);
    keepPlace(page(2));
    await pass(WRITE_MS);
    expect(failed).toHaveBeenCalledTimes(2);
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'place.bad' }),
    );
  });
});

describe('when the server stays away', () => {
  it('says so once the tries are spent', async () => {
    const failed = vi.fn();
    onPlaceFailed(failed);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    keepPlace(page(4));
    await pass(WRITE_MS);
    await pass(RETRY_MS);
    await pass(RETRY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(TRIES);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'request.unreachable' }),
    );
  });
});

describe('as the page goes', () => {
  it('writes at once, with keepalive, when the page is hidden', async () => {
    ok();
    keepPlace(page(4));
    setHidden(true);
    flushPlaces();
    await pass();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(initOf(0)?.keepalive).toBe(true);
  });

  it('sends a write on its way again as the page closes', async () => {
    fetchMock.mockReturnValueOnce(new Promise(() => undefined));
    keepPlace(page(5));
    await pass(WRITE_MS);
    ok();
    flushPlaces({ leaving: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(initOf(1)?.keepalive).toBe(true);
    expect(bodyOf(1)).toEqual(page(5));
  });

  it('sends a draft too big for keepalive as a plain write', async () => {
    ok();
    keepPlace({ ...draft, text: 'x'.repeat(KEEPALIVE_MAX) });
    setHidden(true);
    flushPlaces();
    await pass();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(initOf(0)?.keepalive).toBe(false);
  });
});
