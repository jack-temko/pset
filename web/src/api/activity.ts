import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { del, get } from './client';
import type { Kind, Week } from './gen/activity';

export type * from './gen/activity';

/** Monday 00:00 of this week, in the student's own time zone. */
function weekStart(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}

export const useWeek = () =>
  useQuery({
    queryKey: ['week'],
    queryFn: () =>
      get<Week>(`/api/week?since=${encodeURIComponent(weekStart())}`),
    // Time accrues without events: fresh each visit to Home.
    staleTime: 0,
  });

/** Forget all time spent, in every book. Questions worked stay: they come
 *  from homework. */
export function useClearActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del<undefined>('/api/study'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['week'] }),
  });
}

/** How often the stretch in progress is saved. */
const SAVE = 30_000;

/**
 * How long without input before the student has gone: long with a
 * homework question open, since that's worked on paper, shorter while
 * reading or asking.
 */
export const IDLE: Record<Kind, number> = {
  homework: 20 * 60_000,
  reading: 5 * 60_000,
  asking: 5 * 60_000,
};

/** A stretch that ends for want of input ends this long after the last. */
const GRACE = 60_000;

type Open = {
  id: string;
  kind: Kind;
  question?: string;
  started: number;
  ended: number;
};

/** What the workspace's timer shows: whether time is counting now, and
 *  how much this sitting has counted. */
export type StudyTime = { counting: boolean; seconds: number };

/**
 * The study time as a store, so the one-second count re-renders nothing:
 * the timer in the top bar subscribes (`useStudyClock`), and a snapshot is
 * only new when what it shows changes (counting or not, or the minute).
 * Rendering the workspace once a second made every page, formula and
 * transcript card redraw with it.
 */
export type StudyClock = {
  get: () => StudyTime;
  set: (t: StudyTime) => void;
  subscribe: (fn: () => void) => () => void;
};

function newStudyClock(): StudyClock {
  let shown: StudyTime = { counting: false, seconds: 0 };
  const subs = new Set<() => void>();
  return {
    get: () => shown,
    set: (t) => {
      if (
        t.counting === shown.counting &&
        Math.floor(t.seconds / 60) === Math.floor(shown.seconds / 60)
      )
        return;
      shown = t;
      subs.forEach((f) => {
        f();
      });
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
}

/** The clock's time, re-rendering only the caller, and only when it changes. */
export function useStudyClock(clock: StudyClock): StudyTime {
  return useSyncExternalStore(clock.subscribe, clock.get);
}

/**
 * Counts time in a book, as stretches: while the tab is visible and the
 * student hasn't been away longer than IDLE, one stretch per kind of
 * thing they're doing. `kind` is read each second, so it follows where
 * they last clicked or typed. The stretch in progress is saved every
 * half-minute and once more as the tab hides or closes, each time with
 * its end no later than a minute after the last input: time with no
 * input only counts once the student is back. Spec: design/backend.md,
 * "Time spent".
 */
export function useStudyTime(
  bookId: string,
  kind: () => Kind,
  question?: () => string | undefined,
): StudyClock {
  const kindRef = useRef(kind);
  // oxlint-disable-next-line react/refs -- the latest props in a ref, so the timers read current values without restarting
  kindRef.current = kind;
  const questionRef = useRef(question);
  // oxlint-disable-next-line react/refs -- the latest props in a ref, so the timers read current values without restarting
  questionRef.current = question;
  const [clock] = useState(newStudyClock);
  useEffect(() => {
    let lastInput = Date.now();
    let open: Open | null = null;
    let saved = 0;
    let closedMs = 0;
    const save = (o: Open, going = false) => {
      const body = JSON.stringify({
        id: o.id,
        bookId,
        kind: o.kind,
        questionId: o.question,
        started: new Date(o.started).toISOString(),
        ended: new Date(o.ended).toISOString(),
      });
      // keepalive lets the last save outlive a closing tab.
      fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: going,
      }).catch(() => {});
    };
    const close = (now: number, going = false) => {
      if (!open) return;
      open.ended = Math.max(open.started, Math.min(now, lastInput + GRACE));
      save(open, going);
      closedMs += open.ended - open.started;
      open = null;
    };
    const tick = () => {
      const now = Date.now();
      const k = kindRef.current();
      // Homework time is for the question open, when one is: moving to
      // another starts a new stretch, so the time can be said by question.
      const qid = k === 'homework' ? questionRef.current?.() : undefined;
      const away = now - lastInput > IDLE[k];
      if (document.visibilityState !== 'visible' || away) {
        close(now);
      } else {
        if (open && (open.kind !== k || open.question !== qid)) close(now);
        if (!open) {
          // Saved first at the half-minute, or as it closes: never empty.
          open = {
            id: crypto.randomUUID(),
            kind: k,
            question: qid,
            started: now,
            ended: now,
          };
          saved = now;
        }
        open.ended = now;
        if (now - saved >= SAVE) {
          saved = now;
          save({ ...open, ended: Math.min(now, lastInput + GRACE) });
        }
      }
      const live = open ? now - open.started : 0;
      clock.set({
        counting: open !== null,
        seconds: Math.floor((closedMs + live) / 1000),
      });
    };
    const touch = () => {
      lastInput = Date.now();
    };
    // Leaving the tab is the student's own act: they were there until now.
    const going = () => {
      touch();
      close(Date.now(), true);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'scroll'] as const;
    events.forEach((e) => {
      window.addEventListener(e, touch, { passive: true, capture: true });
    });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') touch();
      else going();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', going);
    const timer = setInterval(tick, 1000);
    tick();
    return () => {
      clearInterval(timer);
      going();
      events.forEach((e) => {
        window.removeEventListener(e, touch, { capture: true });
      });
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', going);
    };
  }, [bookId, clock]);
  return clock;
}
