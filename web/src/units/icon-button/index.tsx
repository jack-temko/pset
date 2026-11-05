import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { REASON_MS } from '@/units/button';
import {
  buttonLook,
  NOT_READY,
  type ButtonVariant,
} from '@/units/button/looks';
import { Tooltip } from '@/units/tooltip';

/** A square button that is only its icon. Its name shows in a tooltip on hover
 *  and focus, and is what assistive tech hears. The same looks as Button, never
 *  disabled (button-d4): not ready, its tooltip says why instead of its name.
 *  Busy, the spinner takes the icon's place and the size holds. */
export function IconButton({
  icon: Icon,
  label,
  variant = 'quiet',
  busy,
  notReady,
  reasonOpen,
  onPress,
}: {
  icon: LucideIcon;
  /** Its name, one or two words: the tooltip and what assistive tech hears. */
  label: string;
  variant?: ButtonVariant;
  busy?: boolean;
  /** The reason it cannot act yet. Set means not ready. */
  notReady?: string;
  /** Forces the tooltip open (the design page only). */
  reasonOpen?: boolean;
  onPress?: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const hide = () => {
    setPressed(false);
  };
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

  const look = notReady ? NOT_READY : buttonLook(variant);
  return (
    <span className="relative inline-flex shrink-0 align-top">
      <Tooltip
        text={notReady ?? label}
        open={pressed || Boolean(reasonOpen)}
        onClose={hide}
      >
        <button
          type="button"
          aria-label={label}
          aria-busy={busy || undefined}
          aria-disabled={notReady ? true : undefined}
          className={`inline-flex size-(--ds-control) items-center justify-center rounded-(--ds-radius-control) border ${look}`}
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
        >
          {busy ? (
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <Icon className="size-4" aria-hidden />
          )}
        </button>
      </Tooltip>
    </span>
  );
}
