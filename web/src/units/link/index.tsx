import type { ComponentPropsWithRef } from 'react';

/** Goes somewhere (link-d2). Underlined inside text; plain when it stands
 *  alone, underlined on hover and focus (link-d1). The anchor's own props
 *  (`onClick`, `ref` and the rest) pass through, so a router-aware screen
 *  can intercept navigation. */
export function Link({
  href,
  inline = false,
  forceState,
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<'a'>, 'href'> & {
  href: string;
  inline?: boolean;
  /** Draws the hover or focus look without either (the design page only). */
  forceState?: 'hover' | 'focus';
}) {
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
      className={`text-(--ds-accent) underline-offset-2 ${inline ? '' : 'ds-body'} max-w-full [overflow-wrap:anywhere] ${underline} ${forced} ${className ?? ''}`}
    >
      {children}
    </a>
  );
}
