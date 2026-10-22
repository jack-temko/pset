import type { ComponentPropsWithRef, ReactNode } from 'react';

export type LinkTone = 'accent' | 'fg' | 'muted';

const TONES: Record<LinkTone, string> = {
  accent: 'text-(--ds-accent)',
  fg: 'text-(--ds-fg)',
  muted: 'text-(--ds-fg-muted)',
};

/** What the link adds to the anchor. */
export interface LinkOwnProps {
  href: string;
  inline?: boolean;
  /** `accent` is the link colour; `fg` and `muted` quieten a link in a list
   *  or a path (link-d3). */
  tone?: LinkTone;
  weight?: 'regular' | 'medium';
  /** The step of a standalone link; an inline link takes the text's own.
   *  `brand` is the wordmark's, and only the wordmark's. */
  size?: 'body' | 'small' | 'brand';
  /** Draws the hover or focus look without either (the design page only). */
  forceState?: 'hover' | 'focus';
  className?: string;
  children?: ReactNode;
}

/** The anchor's own props (`onClick`, `ref` and the rest) pass through, so
 *  a router-aware screen can intercept navigation. */
export type LinkProps = Omit<ComponentPropsWithRef<'a'>, keyof LinkOwnProps> &
  LinkOwnProps;

/** Goes somewhere (link-d2). Underlined inside text; plain when it stands
 *  alone, underlined on hover and focus (link-d1). The anchor's own props
 *  (`onClick`, `ref` and the rest) pass through, so a router-aware screen
 *  can intercept navigation. */
export function Link({
  href,
  inline = false,
  tone = 'accent',
  weight = 'regular',
  size = 'body',
  forceState,
  className,
  children,
  ...rest
}: LinkProps) {
  const underline =
    inline || forceState
      ? 'underline'
      : 'hover:underline focus-visible:underline';
  const forced =
    forceState === 'focus'
      ? 'outline-(length:--ds-focus-width) outline-offset-(--ds-focus-offset) outline-solid outline-(--ds-accent)'
      : '';
  return (
    <a
      {...rest}
      href={href}
      className={`${TONES[tone]} underline-offset-2 ${inline ? '' : `ds-${size}`} ${weight === 'medium' ? 'font-medium' : ''} max-w-full [overflow-wrap:anywhere] ${underline} ${forced} ${className ?? ''}`}
    >
      {children}
    </a>
  );
}
