import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'default' | 'quiet' | 'danger';

const LOOKS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-(--ds-accent-solid) text-(--ds-on-accent) hover:bg-(--ds-accent-solid-hover) active:bg-(--ds-accent-solid-pressed)',
  default:
    'border-(--ds-border) bg-transparent text-(--ds-fg) hover:bg-(--ds-hover) active:bg-(--ds-pressed)',
  quiet:
    'border-transparent bg-transparent text-(--ds-fg) hover:bg-(--ds-hover) active:bg-(--ds-pressed)',
  danger:
    'border-transparent bg-(--ds-danger-solid) text-(--ds-on-danger) hover:bg-(--ds-danger-solid-hover) active:bg-(--ds-danger-solid-pressed)',
};

/** A not-ready button has no fill and no hover: muted text and its reason
 *  mark it. Its look is the default shape whatever its variant, since muted
 *  text does not reach its contrast on a solid ground. */
const NOT_READY =
  'border-(--ds-border) bg-transparent text-(--ds-fg-muted) cursor-default';

/** How long a reason revealed by a click alone stays (no focus to blur). */
export const REASON_MS = 4000;

/** Never disabled (button-d4): busy keeps its exact size, ignores presses and keeps focus, and a
 *  button that is not ready stays pressable and says why. The reason shows on
 *  focus and on a press, and goes on blur, Escape, a change of `notReady`,
 *  the pointer leaving after a click-only reveal, or after 4 seconds of one. */
export function Button({
  variant = 'default',
  icon: Icon,
  busy,
  busyLabel = 'Working',
  notReady,
  reasonOpen,
  onPress,
  type = 'button',
  children,
}: {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  busy?: boolean;
  /** What assistive tech hears while busy. */
  busyLabel?: string;
  /** The reason it cannot act yet. Set means not ready. */
  notReady?: string;
  /** Shows the reason without a press or focus (the design page only). */
  reasonOpen?: boolean;
  onPress?: () => void;
  type?: 'button' | 'submit';
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  const pointerDown = useRef(false);
  /** How the reason was revealed: by focus (it goes on blur) or by a click
   *  that did not focus the button (Safari, Firefox on Mac, touch). */
  const [shown, setShown] = useState<'focus' | 'click'>();
  /** Set by a press: the one polite announcement. Focus is announced by
   *  aria-describedby instead, so nothing is read twice. */
  const [announced, setAnnounced] = useState('');

  const hide = () => {
    setShown(undefined);
    setAnnounced('');
  };

  // A stale reason never outlives the state it explained: when `notReady`
  // changes or clears, the reveal is dropped before anything is drawn.
  const [seen, setSeen] = useState(notReady);
  if (seen !== notReady) {
    setSeen(notReady);
    hide();
  }

  useEffect(() => {
    if (shown !== 'click') return;
    const t = setTimeout(hide, REASON_MS);
    return () => {
      clearTimeout(t);
    };
  }, [shown]);

  const slot = Icon && (
    <span className="flex size-4 shrink-0 items-center justify-center">
      {busy ? (
        <LoaderCircle
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      ) : (
        <Icon className="size-4" aria-hidden />
      )}
    </span>
  );
  const open = Boolean(notReady) && (Boolean(shown) || Boolean(reasonOpen));
  const look = notReady ? NOT_READY : LOOKS[variant];
  // Busy with no icon: the label keeps its box but is not drawn, and the
  // spinner sits over it, so the button cannot change size (button-d3).
  const covered = busy && !Icon;

  return (
    <span className="relative inline-flex max-w-full min-w-0 align-top">
      <button
        ref={ref}
        type={type}
        aria-busy={busy || undefined}
        aria-disabled={notReady ? true : undefined}
        aria-describedby={open ? reasonId : undefined}
        style={{ fontWeight: 500 }}
        className={`ds-body relative inline-flex h-(--ds-control) max-w-full min-w-16 items-center justify-center rounded-(--ds-radius-control) border gap-2 px-3 whitespace-nowrap ${look}`}
        onClick={(e) => {
          pointerDown.current = false;
          if (busy) {
            e.preventDefault();
            return;
          }
          if (notReady) {
            e.preventDefault();
            setAnnounced(notReady);
            // A pointer press (mouse or touch, detail above 0) is a reveal
            // that goes by itself, whether or not the browser focused the
            // button; Enter or Space (detail 0) is a keyboard reveal that
            // stays until blur.
            setShown((cur) => (e.detail > 0 ? 'click' : (cur ?? 'focus')));
            return;
          }
          onPress?.();
        }}
        onPointerDown={() => {
          pointerDown.current = true;
        }}
        onFocus={() => {
          // Focus that a pointer press brought is the press's, not a reveal.
          if (notReady && !pointerDown.current) setShown('focus');
          pointerDown.current = false;
        }}
        onBlur={() => {
          pointerDown.current = false;
          hide();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide();
        }}
        onPointerLeave={() => {
          if (shown === 'click') hide();
        }}
      >
        {slot}
        <span
          className="min-w-0 truncate"
          style={covered ? { visibility: 'hidden' } : undefined}
          aria-hidden={covered || undefined}
        >
          {children}
        </span>
        {covered && (
          <>
            {/* The label is hidden, so the name is kept for assistive tech. */}
            <span className="sr-only">{children}</span>
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center"
            >
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            </span>
          </>
        )}
      </button>
      {busy && (
        <span role="status" className="sr-only">
          {busyLabel}
        </span>
      )}
      {notReady && (
        <>
          <span role="status" className="sr-only">
            {announced}
          </span>
          {open && (
            <span
              id={reasonId}
              aria-hidden
              className="ds-small pointer-events-none absolute top-full left-0 z-20 mt-1 w-max max-w-[240px] rounded-(--ds-radius-tag) border border-(--ds-border-muted) bg-(--ds-bg-raised) px-2 py-1 text-(--ds-fg-muted)"
            >
              {notReady}
            </span>
          )}
        </>
      )}
    </span>
  );
}
