import { createContext, useContext, useEffect, useState } from 'react';

import { MOTION } from './tokens';

/** Arrival motion (ideas/skeleton-grill.md D3, step 6). The first time each
 *  screen shows its data after PSet starts, figures roll, bars grow,
 *  sparklines rise and heat squares fade in; after that values just appear.
 *  And when a screen's quiet form was on screen (its read outlasted the
 *  grace), what it draws below its title fades in (opacity only). */

/** Whether the parts drawn now are arriving: read by the figures, bars,
 *  sparklines and heat squares, set by `Arrives`. */
export const Arriving = createContext(false);

/** Whether the screen's quiet form was on screen past the grace: set by
 *  `waits`, read by `Arrives`. */
export const QuietSeen = createContext(false);

/** The design page's Arriving mode: play the arrival every time the data
 *  comes, not only on the first open. */
export const ReplayArrivals = createContext(false);

/** The screens that have shown their data since the page loaded (A4). */
const opened = new Set<string>();

/** Whether a screen's data is arriving now, for the first time this session:
 *  decided when `ready` turns true and held while it stays true. */
export function useFirstOpen(screen: string, ready: boolean): boolean {
  const replay = useContext(ReplayArrivals);
  const [first, setFirst] = useState<boolean | null>(null);
  if (!ready && first !== null) setFirst(null);
  // Marked opened after the render, so a render run twice (StrictMode)
  // decides the same both times.
  useEffect(() => {
    if (ready) opened.add(screen);
  }, [ready, screen]);
  if (ready && first === null) {
    const now = replay || !opened.has(screen);
    setFirst(now);
    return now;
  }
  return first === true;
}

/** Whether to move: the browser can animate and the student has not asked
 *  for less motion. Tests run where neither exists. */
export function moves(el: Element): boolean {
  return (
    'animate' in el &&
    'matchMedia' in window &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Whether a bar is at its value: false for the first frame of a bar that
 *  is arriving, so its width or height transition grows it from empty. */
export function useGrown(): boolean {
  const arriving = useContext(Arriving);
  const [grown, setGrown] = useState(!arriving);
  useEffect(() => {
    if (grown) return;
    const id = requestAnimationFrame(() => {
      setGrown(true);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [grown]);
  return grown;
}

/** How long an arrival takes, in ms. */
export const ARRIVE_MS = MOTION.arrive;
