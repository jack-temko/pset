import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Place } from '@/api/gen/place';

import {
  clearPlace,
  flushPlaces,
  keepPlace,
  onPlaceFailed,
  readPlaces,
  resetPlacesForTest,
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

const page = (n: number): PlaceInput => ({
  ownerKind: 'material',
  ownerId: 'm1',
  kind: 'page',
  tabId: 't1',
  page: n,
  down: 0,
});

const kept = (input: PlaceInput, id = 'p1', seq = 5): Place => ({
  ...input,
  id,
  seq,
  group: 'where',
});

/** Lets every waiting promise and timer up to `ms` run. */
const pass = async (ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms);
};

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  resetPlacesForTest();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('places', () => {
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

  it('writes the newest of a burst once, after a pause', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(reply(200, kept(page(3)))),
    );
    keepPlace(page(1));
    keepPlace(page(2));
    keepPlace(page(3));
    await pass(WRITE_MS - 1);
    expect(fetchMock).not.toHaveBeenCalled();
    await pass(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(initOf(0)?.method).toBe('PUT');
    expect(bodyOf(0)).toEqual(page(3));
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
    answer(reply(200, { places: [kept(page(2), 'p1')] }));
    await reading;
    // The read only lends its id: a clear now deletes the server's row.
    fetchMock.mockResolvedValue(reply(204));
    clearPlace(page(9));
    await pass();
    expect(urlOf(1)).toBe('/api/places/p1');
    expect(initOf(1)?.method).toBe('DELETE');
  });

  it('clears after the write before it, never past it', async () => {
    let answer: (r: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise((r) => {
        answer = r;
      }),
    );
    const draft: PlaceInput = {
      ownerKind: 'course',
      ownerId: 'c1',
      kind: 'ask_draft',
      text: 'why is',
    };
    keepPlace(draft);
    await pass(WRITE_MS);
    // Sent while the write is on its way: the delete must wait for its id.
    clearPlace(draft);
    fetchMock.mockResolvedValue(reply(204));
    answer(reply(200, kept(draft, 'd7')));
    await pass();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(1)).toBe('/api/places/d7');
  });

  it('sends what is waiting with keepalive as the page goes', () => {
    fetchMock.mockResolvedValue(reply(200, kept(page(4))));
    keepPlace(page(4));
    flushPlaces({ leaving: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(initOf(0)?.keepalive).toBe(true);
    expect(bodyOf(0)).toEqual(page(4));
  });

  it('tells the error module when a write is refused', async () => {
    const failed = vi.fn();
    onPlaceFailed(failed);
    fetchMock.mockResolvedValue(
      reply(400, {
        id: 'place.bad',
        what: 'PSet couldn’t remember where you were.',
        scope: 'inline',
        chain: ['place.bad'],
      }),
    );
    keepPlace(page(1));
    await pass(WRITE_MS);
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'place.bad' }),
    );
  });
});
