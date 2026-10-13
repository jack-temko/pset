import { LoaderCircle, type LucideIcon } from 'lucide-react';
import {
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

/** Never disabled (button-d4): busy ignores presses and keeps focus, and a
 *  button that is not ready stays pressable and says why. */
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
  const [shown, setShown] = useState(false);
  const [pinned, setPinned] = useState<number>();

  // The width is held while busy, measured as the press begins, so the
  // spinner can take the icon's place (or the padding) without the button
  // growing or shrinking.
  useLayoutEffect(() => {
    if (busy) setPinned(ref.current?.offsetWidth);
    else setPinned(undefined);
  }, [busy]);

  const slot = Icon || busy;
  const open = Boolean(notReady) && (shown || Boolean(reasonOpen));
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
        aria-describedby={notReady ? reasonId : undefined}
        style={{ fontWeight: 500, width: pinned }}
        className={`ds-body inline-flex h-(--ds-control) max-w-full min-w-16 items-center justify-center rounded-(--ds-radius-control) border ${tight ? 'gap-1 px-0.5' : 'gap-2 px-3'} whitespace-nowrap ${look}`}
        onClick={(e) => {
          if (busy) {
            e.preventDefault();
            return;
          }
          if (notReady) {
            e.preventDefault();
            setShown(true);
            return;
          }
          onPress?.();
        }}
        onFocus={() => {
          if (notReady) setShown(true);
        }}
        onBlur={() => {
          setShown(false);
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
        <span
          id={reasonId}
          aria-live="polite"
          className="ds-small pointer-events-none absolute top-full left-0 z-10 mt-1 w-max max-w-80 text-(--ds-fg-muted)"
        >
          {open ? notReady : ''}
        </span>
      )}
    </span>
  );
}
