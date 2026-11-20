import type { UpdateStatus } from './sample';

/** What a key test or save said. */
export type KeyAnswer = { ok: true } | { ok: false; failure: string };

/** What a check for updates found. */
export interface UpdateFound {
  status: UpdateStatus;
  latest?: string;
  notes?: readonly string[];
}

/**
 * Everything Settings can do, given to the page by whoever shows it: the
 * real screen does it against the server, the design page with
 * `SAMPLE_ACTIONS`. Each returns once it is done, or throws the server's
 * ApiError; the page says what happened in the row that asked.
 */
export interface SettingsActions {
  saveName: (name: string) => Promise<void>;
  /** Tries a key and writes nothing. */
  testKey: (key: string) => Promise<KeyAnswer>;
  /** Tests a key, then keeps it only if it works. */
  saveKey: (key: string) => Promise<KeyAnswer>;
  checkUpdate: () => Promise<UpdateFound>;
  /** Installs the newer version: PSet restarts, and the page reloads when
   *  it is back. */
  applyUpdate: () => Promise<void>;
  /** Runs a failing check's fix (an action). */
  fix: (checkId: string) => Promise<void>;
  tryAgain: (incidentId: string) => Promise<void>;
  /** Puts an incident away; Ctrl+Z brings it back. */
  dismiss: (incidentId: string) => Promise<void>;
  /** An incident's trace, as lines to read: its step, the model calls,
   *  what changed around it. */
  trace: (incidentId: string) => Promise<readonly string[]>;
  /** Forgets every stretch of study time. Can't be undone. */
  clearHistory: () => Promise<void>;
  /** A fresh install. Can't be undone. */
  reset: () => Promise<void>;
}

const wait = (ms: number) =>
  new Promise<void>((r) => {
    setTimeout(r, ms);
  });

/** The design page's actions: nothing is saved or sent. A key that looks
 *  like OpenRouter's works. */
export const SAMPLE_ACTIONS: SettingsActions = {
  saveName: () => wait(200),
  testKey: async (key) => {
    await wait(800);
    return key.trim().startsWith('sk-or-')
      ? { ok: true }
      : {
          ok: false,
          failure: 'OpenRouter refused this key. Check it and paste it again.',
        };
  },
  saveKey: (key) => SAMPLE_ACTIONS.testKey(key),
  checkUpdate: async () => {
    await wait(1000);
    return { status: 'current' };
  },
  applyUpdate: () => new Promise<void>(() => undefined),
  fix: () => wait(800),
  tryAgain: () => wait(600),
  dismiss: () => wait(200),
  trace: async () => {
    await wait(400);
    return [
      'Step: reading pages, failed on try 3 of 3',
      'deepseek/deepseek-v3.2, 4.1 s, refused: 401',
      'Changed since: the key was saved again',
    ];
  },
  clearHistory: () => wait(300),
  reset: () => wait(300),
};
