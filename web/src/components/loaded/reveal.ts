/**
 * The reveal train. Like React's Suspense, which reveals loaded content at
 * most once every 300ms so nearby sections appear together: a box whose
 * skeleton was seen reveals at once if nothing revealed in the last REVEAL_MS,
 * and otherwise joins the next reveal, REVEAL_MS after the last. Everything
 * that joined the same wait appears in the same frame.
 */
export const REVEAL_MS = 300;
let lastReveal = -Infinity;
let waiting: Set<() => void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Whether a box may reveal now (nothing revealed in the last REVEAL_MS).
 *  Pure: it is asked while rendering, and a render may be thrown away. */
export function canReveal(): boolean {
  return Date.now() - lastReveal >= REVEAL_MS;
}

/** A reveal happened: the next box waits for the train. Called from a
 *  layout effect, once the reveal is committed. */
export function claimReveal() {
  lastReveal = Date.now();
}

/** Join the next reveal; returns the way out (the box went pending again). */
export function joinReveal(go: () => void): () => void {
  if (!waiting) {
    waiting = new Set();
    timer = setTimeout(
      () => {
        const run = waiting;
        waiting = null;
        lastReveal = Date.now();
        run?.forEach((f) => {
          f();
        });
      },
      Math.max(0, lastReveal + REVEAL_MS - Date.now()),
    );
  }
  waiting.add(go);
  return () => {
    waiting?.delete(go);
    if (waiting?.size === 0) {
      clearTimeout(timer);
      waiting = null;
    }
  };
}

/** Forget the last reveal (tests, so one test's reveal doesn't hold the next). */
export function resetRevealTrain() {
  clearTimeout(timer);
  waiting = null;
  lastReveal = -Infinity;
}
