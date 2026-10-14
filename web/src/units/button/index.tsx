import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Tooltip } from '@/units/tooltip';

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
 *  (a tooltip) mark it. Its look is the default shape whatever its variant, since muted
 *  text does not reach its contrast on a solid ground. */
const NOT_READY =
  'border-(--ds-border) bg-transparent text-(--ds-fg-muted) cursor-default';

/** How long a reason opened by a press stays. */
export const REASON_MS = 4000;

/** Never disabled (button-d4): busy keeps its exact size, ignores presses and
 *  keeps focus, and a button that is not ready stays pressable and says why in
 *  a tooltip. The tooltip shows on hover and focus like any other; a press
 *  opens it, and it stays until the pointer leaves, blur, Escape, a change of
 *  `notReady` or 4 seconds. */
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
  /** Forces the reason's tooltip open (the design page only). */
  reasonOpen?: boolean;
  onPress?: () => void;
  type?: 'button' | 'submit';
  children: ReactNode;
}) {
  /** A press opened the reason's tooltip. */
  const [pressed, setPressed] = useState(false);
  const hide = () => {
    setPressed(false);
  };

  // A stale reason never outlives the state it explained: when `notReady`
  // changes or clears, the press is dropped before anything is drawn.
  const [seen, setSeen] = useState(notReady);
  if (seen !== notReady) {
    setSeen(notReady);
    hide();
  }

  useEffect(() => {
    if (!pressed) return;
    const t = setTimeout(hide, REASON_MS);
    return () => {
      clearTimeout(t);
    };
  }, [pressed]);

  const look = notReady ? NOT_READY : LOOKS[variant];
  // Busy with no icon: the label keeps its box but is not drawn, and the
  // spinner sits over it, so the button cannot change size (button-d3).
  const covered = busy && !Icon;

  const button = (
    <button
      type={type}
      aria-busy={busy || undefined}
      aria-disabled={notReady ? true : undefined}
      style={{ fontWeight: 500 }}
      className={`ds-body relative inline-flex h-(--ds-control) max-w-full min-w-16 items-center justify-center rounded-(--ds-radius-control) border gap-2 px-3 whitespace-nowrap ${look}`}
      onClick={(e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        if (notReady) {
          e.preventDefault();
          setPressed(true);
          return;
        }
        onPress?.();
      }}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === 'Escape') hide();
      }}
      onPointerLeave={hide}
    >
      {Icon && (
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
      )}
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
  );

  return (
    <span className="relative inline-flex max-w-full min-w-0 align-top">
      {notReady ? (
        <Tooltip text={notReady} open={pressed || Boolean(reasonOpen)}>
          {button}
        </Tooltip>
      ) : (
        button
      )}
      {busy && (
        <span role="status" className="sr-only">
          {busyLabel}
        </span>
      )}
    </span>
  );
}
