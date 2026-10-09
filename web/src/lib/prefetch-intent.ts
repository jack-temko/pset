import { useEffect, useRef } from 'react';

/** How long the pointer has to rest on a trigger before it counts as intent
 *  (instant.page uses 65ms): a pointer sweeping past asks for nothing. */
export const INTENT_MS = 60;

/** The handlers `usePrefetchIntent` returns, to spread on a trigger. */
export interface PrefetchIntent {
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
  onFocus: () => void;
}

/**
 * When to warm what a trigger will open. Runs `prefetch` once the pointer has
 * stayed on the trigger for INTENT_MS (cancelled if it leaves first), at once
 * on a press or on keyboard focus, and never for a touch pointer's hover,
 * which isn't a hover. `prefetch` should be cheap to repeat: a query already
 * cached isn't asked for again.
 */
export function usePrefetchIntent(prefetch: () => void): PrefetchIntent {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(prefetch);
  useEffect(() => {
    latest.current = prefetch;
  });
  const cancel = () => {
    clearTimeout(timer.current);
  };
  useEffect(() => cancel, []);
  const now = () => {
    cancel();
    latest.current();
  };
  return {
    onPointerEnter: (e) => {
      if (e.pointerType === 'touch') return;
      cancel();
      timer.current = setTimeout(() => {
        latest.current();
      }, INTENT_MS);
    },
    onPointerLeave: cancel,
    onPointerDown: now,
    onFocus: now,
  };
}
