import { Check, ChevronRight, Copy, LoaderCircle, X } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react';

import { Button } from '@/units/button';
import { Tag } from '@/units/tag';
import { Document } from './blocks';
import { doneLine, liveLine, summary, type Question, type Turn } from './types';

export type { Question, Turn } from './types';

/** Past this far from the foot, a growing answer stops pulling the
 *  conversation down: the student scrolled back to read. */
const STICK_PX = 48;

/** The one line at the top of an answer (ask-d2, ask-d3). While Ask works it
 *  names only the call in flight, replacing itself; when the answer ends it
 *  turns, in the same place and the same height, into the folded summary,
 *  which opens to the calls. */
function CallLine({
  turn,
  open,
  onToggle,
}: {
  turn: Turn;
  open: boolean;
  onToggle: () => void;
}) {
  const row =
    'ds-small flex h-(--ds-small-line) max-w-full items-center gap-2 text-(--ds-fg-muted)';
  if (turn.status === 'working') {
    const text = turn.inFlight
      ? liveLine(turn.inFlight)
      : turn.blocks.length > 0
        ? 'Writing'
        : 'Thinking';
    return (
      <p className={row}>
        <LoaderCircle
          className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
        <span className="min-w-0 truncate">{text}</span>
      </p>
    );
  }
  if (turn.calls.length === 0)
    return (
      <p className={row}>
        <span className="size-4 shrink-0" aria-hidden />
        {/* Isolated: only a finished answer says it read nothing. */}
        <span className="min-w-0 truncate">
          {turn.status === 'done' ? summary(turn.calls) : ''}
        </span>
      </p>
    );
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`${row} cursor-pointer hover:text-(--ds-fg)`}
      >
        <ChevronRight
          className={`size-4 shrink-0 ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
        <span className="min-w-0 truncate">{summary(turn.calls)}</span>
      </button>
      {open && (
        <ul className="ds-small mt-1 space-y-1 pl-6 text-(--ds-fg-muted)">
          {turn.calls.map((c, i) => (
            <li key={i} className="[overflow-wrap:anywhere]">
              {doneLine(c)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Copier({ from }: { from: React.RefObject<HTMLDivElement | null> }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => {
      setCopied(false);
    }, 1500);
    return () => {
      clearTimeout(t);
    };
  }, [copied]);
  return (
    <Button
      variant="quiet"
      icon={copied ? Check : Copy}
      onPress={() => {
        const text = from.current?.innerText ?? '';
        navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
          },
          () => {
            // Blocked clipboard: the button just does not confirm.
          },
        );
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function TurnView({
  turn,
  open,
  onToggle,
  onRetry,
  onUndo,
  onEdit,
  onPage,
  onSettings,
}: {
  turn: Turn;
  open: boolean;
  onToggle: () => void;
  onRetry?: (id: string) => void;
  onUndo?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPage?: (material: string, page: number) => void;
  onSettings?: () => void;
}) {
  const doc = useRef<HTMLDivElement>(null);
  const finished = turn.status === 'done' || turn.status === 'stopped';
  return (
    <section className="space-y-3">
      <div className="flex flex-col items-end gap-2">
        {turn.about && <Tag>{`About ${turn.about}`}</Tag>}
        {turn.image && (
          <img
            src={turn.image}
            alt="Attached to the question"
            className="max-h-24 max-w-[60%] rounded-(--ds-radius-control) border border-(--ds-border-muted)"
          />
        )}
        <p className="ds-body max-w-[85%] rounded-(--ds-radius-panel) bg-(--ds-neutral-soft) px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {turn.question}
        </p>
      </div>
      <div className="space-y-3">
        <CallLine turn={turn} open={open} onToggle={onToggle} />
        {turn.remembered && (
          <p className="ds-small flex max-w-[680px] flex-wrap items-center gap-x-1 text-(--ds-fg-muted)">
            <span className="[overflow-wrap:anywhere]">
              {`Remembered: ${turn.remembered}`}
            </span>
            <Button variant="quiet" onPress={() => onUndo?.(turn.id)}>
              Undo
            </Button>
            {onEdit && (
              <Button
                variant="quiet"
                onPress={() => {
                  onEdit(turn.id);
                }}
              >
                Edit
              </Button>
            )}
          </p>
        )}
        <div ref={doc} className="space-y-3">
          <Document blocks={turn.blocks} onPage={onPage} />
        </div>
        {turn.status === 'stopped' && (
          <p className="ds-small text-(--ds-fg-muted)">Stopped</p>
        )}
        {turn.status === 'failed' && turn.failure && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="ds-small max-w-[680px] text-(--ds-danger) [overflow-wrap:anywhere]">
              {`Couldn't answer: ${turn.failure.why}`}
            </p>
            <Button variant="quiet" onPress={() => onRetry?.(turn.id)}>
              Try again
            </Button>
            {turn.failure.setup && (
              <Button variant="quiet" onPress={onSettings}>
                Open Settings
              </Button>
            )}
          </div>
        )}
        {/* The slot is there while the answer is written, so Copy arriving
            moves nothing. */}
        <div className="flex h-(--ds-control) items-center">
          {finished && turn.blocks.length > 0 && <Copier from={doc} />}
        </div>
      </div>
    </section>
  );
}

/** Clear, at the very top: it asks first, in the same row, how many turns
 *  go; memories stay (ask-d7). */
function Top({
  turns,
  clearing,
  onClearing,
  onClear,
}: {
  turns: number;
  clearing: boolean;
  onClearing: (v: boolean) => void;
  onClear?: () => void;
}) {
  // Cancel takes the trigger's place at the right and the focus, so a second
  // click on the same spot cancels; the destructive button sits beside it.
  const cancel = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (clearing) cancel.current?.querySelector('button')?.focus();
  }, [clearing]);
  return (
    <div className="flex min-h-(--ds-control) items-center justify-between gap-3">
      {clearing ? (
        <>
          <p className="ds-small min-w-0 flex-1 truncate">
            {`Clear ${String(turns)} ${turns === 1 ? 'question' : 'questions'}? Memories stay.`}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="danger"
              onPress={() => {
                onClearing(false);
                onClear?.();
              }}
            >
              Clear
            </Button>
            <span ref={cancel} className="inline-flex">
              <Button
                variant="quiet"
                onPress={() => {
                  onClearing(false);
                }}
              >
                Cancel
              </Button>
            </span>
          </div>
        </>
      ) : (
        <>
          <span className="ds-label text-(--ds-fg-muted)">
            Start of conversation
          </span>
          <Button
            variant="quiet"
            onPress={() => {
              onClearing(true);
            }}
          >
            Clear
          </Button>
        </>
      )}
    </div>
  );
}

function Day({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-(--ds-border-muted)" />
      <span className="ds-label text-(--ds-fg-muted)">{label}</span>
      <span className="h-px flex-1 bg-(--ds-border-muted)" />
    </div>
  );
}

function fileOf(files: FileList | null | undefined) {
  return [...(files ?? [])].find((f) => f.type.startsWith('image/'));
}

/** The composer (ask-d6, ask-d8, ask-d11): what the question is about, a
 *  picture if you pasted or dropped one, the box and one button. While Ask
 *  answers the box stays yours and the button says Stop. */
function Composer({
  about,
  image,
  running,
  focus,
  onAbout,
  onImage,
  onSend,
  onStop,
}: {
  about?: string;
  image?: string;
  running: boolean;
  focus?: boolean;
  onAbout: (v: string | undefined) => void;
  onImage: (v: string | undefined) => void;
  onSend: (text: string) => void;
  onStop?: () => void;
}) {
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focus) box.current?.focus({ preventScroll: true });
  }, [focus]);

  const take = (file: File | undefined) => {
    if (!file) return false;
    const read = new FileReader();
    read.onload = () => {
      if (typeof read.result === 'string') onImage(read.result);
    };
    read.readAsDataURL(file);
    return true;
  };
  const ready = text.trim() !== '' || image !== undefined;
  const send = () => {
    if (running || !ready) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div
      className="shrink-0 border-t border-(--ds-border-muted) bg-(--ds-bg) px-6 py-3"
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
      }}
      onDrop={(e: DragEvent) => {
        const file = fileOf(e.dataTransfer.files);
        // Anything else dropped is left alone, not opened in place of the pane.
        e.preventDefault();
        take(file);
      }}
    >
      {(about || image) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {about && (
            <span className="ds-label inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-(--ds-border) pr-1 pl-2 text-(--ds-fg-muted)">
              <span className="min-w-0 truncate">{`About ${about}`}</span>
              <button
                type="button"
                aria-label={`Stop asking about ${about}`}
                onClick={() => {
                  onAbout(undefined);
                }}
                className="grid size-4 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-(--ds-hover)"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          )}
          {image && (
            <span className="relative inline-flex">
              <img
                src={image}
                alt="Pasted image"
                className="h-12 max-w-24 rounded-(--ds-radius-control) border border-(--ds-border-muted) object-cover"
              />
              <button
                type="button"
                aria-label="Remove the image"
                onClick={() => {
                  onImage(undefined);
                }}
                className="absolute -top-1 -right-1 grid size-4 cursor-pointer place-items-center rounded-full border border-(--ds-border) bg-(--ds-bg-raised) text-(--ds-fg) hover:bg-(--ds-hover)"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={box}
          value={text}
          placeholder="Ask a question"
          aria-label="Your question"
          onChange={(e) => {
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
          onPaste={(e: ClipboardEvent) => {
            if (take(fileOf(e.clipboardData.files))) e.preventDefault();
          }}
          className="ds-body block h-[84px] min-w-0 flex-1 resize-none rounded-(--ds-radius-control) border border-(--ds-border) bg-transparent px-3 py-2 text-(--ds-fg) placeholder:text-(--ds-fg-muted)"
        />
        {running ? (
          <Button onPress={onStop}>Stop</Button>
        ) : (
          <Button
            variant="primary"
            notReady={ready ? undefined : 'Write a question first'}
            onPress={send}
          >
            Send
          </Button>
        )}
      </div>
    </div>
  );
}

/** The Ask pane: one running conversation about a course, and the box that
 *  adds to it. */
export function Ask({
  course,
  turns,
  about,
  startImage,
  focusBox,
  startOpen,
  startClearing,
  onSend,
  onStop,
  onRetry,
  onClear,
  onUndo,
  onEdit,
  onPage,
  onSettings,
}: {
  course: string;
  turns: readonly Turn[];
  about?: string;
  startImage?: string;
  focusBox?: boolean;
  startOpen?: readonly string[];
  startClearing?: boolean;
  onSend?: (q: Question) => void;
  onStop?: () => void;
  onRetry?: (turnId: string) => void;
  onClear?: () => void;
  onUndo?: (turnId: string) => void;
  onEdit?: (turnId: string) => void;
  onPage?: (material: string, page: number) => void;
  onSettings?: () => void;
}) {
  const [chip, setChip] = useState(about);
  const [image, setImage] = useState(startImage);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(startOpen),
  );
  const [clearing, setClearing] = useState(startClearing ?? false);

  // A new "Ask about this" brings its chip in.
  const [seen, setSeen] = useState(about);
  if (seen !== about) {
    setSeen(about);
    setChip(about);
  }

  // Opened at the latest turn, and kept there while an answer grows, unless
  // the student scrolled back to read (ask-d12).
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const inner = useRef<HTMLDivElement>(null);
  const empty = turns.length === 0;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [turns]);
  // Images, math and plots settle after the first paint: while the student
  // is at the foot, the foot stays where they are.
  useEffect(() => {
    const el = scroller.current;
    const body = inner.current;
    if (!el || !body || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    watch.observe(body);
    return () => {
      watch.disconnect();
    };
  }, [empty]);

  const running = turns.some((t) => t.status === 'working');

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-(--ds-bg) text-(--ds-fg)">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {empty ? (
          <div className="flex min-h-full flex-col justify-end px-6 py-4">
            <p className="ds-small text-(--ds-fg-muted)">
              {`Ask anything about ${course}. It reads your materials.`}
            </p>
          </div>
        ) : (
          <div ref={inner} className="space-y-6 px-6 py-4">
            <Top
              turns={turns.length}
              clearing={clearing}
              onClearing={setClearing}
              onClear={onClear}
            />
            {turns.map((t, i) => {
              const label = t.day !== turns[i - 1]?.day ? t.day : undefined;
              return (
                <div key={t.id} className="space-y-6">
                  {label && <Day label={label} />}
                  <TurnView
                    turn={t}
                    open={open.has(t.id)}
                    onToggle={() => {
                      setOpen((o) => {
                        const next = new Set(o);
                        if (!next.delete(t.id)) next.add(t.id);
                        return next;
                      });
                    }}
                    onRetry={onRetry}
                    onUndo={onUndo}
                    onEdit={onEdit}
                    onPage={onPage}
                    onSettings={onSettings}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Composer
        about={chip}
        image={image}
        running={running}
        focus={focusBox}
        onAbout={setChip}
        onImage={setImage}
        onSend={(text) => {
          stick.current = true;
          onSend?.({ text, about: chip, image });
          setChip(undefined);
          setImage(undefined);
        }}
        onStop={onStop}
      />
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) motion-reduce:animate-none ${className}`}
    />
  );
}

/** The pane while it loads: the top row, a question and the lines of an
 *  answer as quiet bars, and the composer at its own size. */
export function AskSkeleton() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-(--ds-bg)">
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="space-y-6 px-6 py-4">
          <div className="flex min-h-(--ds-control) items-center">
            <Bar className="h-3 w-32" />
          </div>
          <div className="flex justify-end">
            <Bar className="h-[38px] w-2/3" />
          </div>
          <div className="space-y-3">
            <div className="flex h-(--ds-small-line) items-center">
              <Bar className="h-3 w-48" />
            </div>
            {['w-full', 'w-full', 'w-1/2'].map((w, i) => (
              <div
                key={i}
                className="flex h-(--ds-reading-line) max-w-[680px] items-center"
              >
                <Bar className={`h-4 ${w}`} />
              </div>
            ))}
            <div className="h-(--ds-control)" />
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-(--ds-border-muted) px-6 py-3">
        <div className="flex items-end gap-2">
          <Bar className="h-[84px] min-w-0 flex-1" />
          <Bar className="h-(--ds-control) w-16" />
        </div>
      </div>
    </div>
  );
}
