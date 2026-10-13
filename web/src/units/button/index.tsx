import { LoaderCircle, type LucideIcon } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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

/** Never disabled (button-d4): busy ignores presses and keeps focus, and a
 *  button that is not ready stays pressable and says why. The reason shows on
 *  focus and on a press, and goes on blur, Escape, a change of `notReady`,
 *  the pointer leaving after a click-only reveal, or after 4 seconds of one. */
export function Button({
  variant = 'default',
  icon: Icon,
  busy,
  notReady,
  reasonOpen,
  onPress,
  type = 'button',
  children,
}: {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  busy?: boolean;
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
  /** How the reason was revealed: by focus (it goes on blur) or by a click
   *  that did not focus the button (Safari, Firefox on Mac, touch). */
  const [shown, setShown] = useState<'focus' | 'click'>();
  /** Set by a press: the one polite announcement. Focus is announced by
   *  aria-describedby instead, so nothing is read twice. */
  const [announced, setAnnounced] = useState('');
  const [pinned, setPinned] = useState<number>();

  const hide = () => {
    setShown(undefined);
    setAnnounced('');
  };

  // The width is held while busy. It is read after the busy render commits,
  // which gives the resting width only because the busy layout equals the
  // resting one (the spinner takes the icon's slot or the padding).
  useLayoutEffect(() => {
    // oxlint-disable-next-line react-hooks/set-state-in-effect -- measuring the committed layout needs an effect
    setPinned(busy ? ref.current?.getBoundingClientRect().width : undefined);
  }, [busy]);

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

  const slot = Icon || busy;
  const open = Boolean(notReady) && (Boolean(shown) || Boolean(reasonOpen));
  const look = notReady ? NOT_READY : LOOKS[variant];
  // With no icon, a busy button fits its spinner into its own padding.
  const tight = busy && !Icon;

  return (
    <span className="relative inline-flex max-w-full align-top">
      <button
        ref={ref}
        type={type}
        aria-busy={busy || undefined}
        aria-disabled={notReady ? true : undefined}
        aria-describedby={open ? reasonId : undefined}
        style={{ fontWeight: 500, width: pinned }}
        className={`ds-body inline-flex h-(--ds-control) max-w-full min-w-16 items-center justify-center rounded-(--ds-radius-control) border ${tight ? 'gap-1 px-[2px]' : 'gap-2 px-3'} whitespace-nowrap ${look}`}
        onClick={(e) => {
          if (busy) {
            e.preventDefault();
            return;
          }
          if (notReady) {
            e.preventDefault();
            setAnnounced(notReady);
            // A click that left the button unfocused has no blur to hide it.
            setShown((s) =>
              document.activeElement === ref.current ? (s ?? 'focus') : 'click',
            );
            return;
          }
          onPress?.();
        }}
        onFocus={() => {
          if (notReady) setShown('focus');
        }}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide();
        }}
        onPointerLeave={() => {
          if (shown === 'click') hide();
        }}
      >
        {slot && (
          <span className="flex size-4 shrink-0 items-center justify-center">
            {busy ? (
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : (
              Icon && <Icon className="size-4" aria-hidden />
            )}
          </span>
        )}
        <span className="min-w-0 truncate">{children}</span>
      </button>
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
