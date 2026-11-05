import { useEffect, useRef, useState } from 'react';

import { Ask, type Question, type Turn } from './index';
import { script } from './script';

let counter = 0;

/** The pane with a conversation that answers itself, so it can be tried:
 *  send, watch the line, Stop, Try again. */
export function SampleAsk({
  course,
  turns: start,
  start: running,
  ...rest
}: Omit<
  React.ComponentProps<typeof Ask>,
  'turns' | 'onSend' | 'onStop' | 'onRetry' | 'onClear' | 'onUndo'
> & {
  turns: readonly Turn[];
  /** Begin with the last turn writing itself. */
  start?: boolean;
}) {
  const [turns, setTurns] = useState(start);
  const timers = useRef<number[]>([]);

  const stop = () => {
    for (const id of timers.current.splice(0)) clearTimeout(id);
  };
  useEffect(() => stop, []);

  const play = (id: string) => {
    stop();
    let at = 0;
    for (const s of script()) {
      at += s.after;
      timers.current.push(
        window.setTimeout(() => {
          setTurns((all) => all.map((t) => (t.id === id ? s.step(t) : t)));
        }, at),
      );
    }
  };

  // The first turn of the example writes itself as soon as it is shown.
  const first = useRef(running);
  useEffect(() => {
    if (!first.current) return;
    first.current = false;
    const last = start.at(-1);
    if (last) play(last.id);
    // Under StrictMode the effect runs, is cleaned up and runs again: the
    // cleanup stops the timers, so it must also arm the second run.
    return () => {
      stop();
      first.current = running;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, on show
  }, []);

  const ask = (q: Question) => {
    counter += 1;
    const id = `n${String(counter)}`;
    setTurns((all) => [
      ...all,
      {
        id,
        day: 'Today',
        question: q.text || 'Look at this.',
        about: q.about,
        image: q.image,
        status: 'working',
        blocks: [],
      },
    ]);
    play(id);
  };

  return (
    <Ask
      {...rest}
      course={course}
      turns={turns}
      onSend={ask}
      onStop={() => {
        stop();
        setTurns((all) =>
          all.map((t) =>
            t.status === 'working'
              ? {
                  ...t,
                  status: 'stopped',
                  // The step in flight is as far as it got: done.
                  blocks: t.blocks.map((b) =>
                    b.k === 'run' && b.current
                      ? {
                          ...b,
                          calls: [...b.calls, b.current],
                          current: undefined,
                        }
                      : b,
                  ),
                }
              : t,
          ),
        );
      }}
      onRetry={(id) => {
        setTurns((all) =>
          all.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'working',
                  failure: undefined,
                  blocks: [],
                  remembered: undefined,
                }
              : t,
          ),
        );
        play(id);
      }}
      onUndo={(id) => {
        setTurns((all) =>
          all.map((t) => (t.id === id ? { ...t, remembered: undefined } : t)),
        );
      }}
      onClear={() => {
        stop();
        setTurns([]);
      }}
    />
  );
}
