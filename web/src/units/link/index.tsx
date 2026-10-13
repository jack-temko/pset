import type { ReactNode } from 'react';

/** Goes somewhere (link-d2). Underlined inside text; plain when it stands
 *  alone, underlined on hover and focus (link-d1). */
export function Link({
  href,
  inline = false,
  forceState,
  children,
}: {
  href: string;
  inline?: boolean;
  /** Draws the hover or focus look without either (the design page only). */
  forceState?: 'hover' | 'focus';
  children: ReactNode;
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
      href={href}
      className={`text-(--ds-accent) underline-offset-2 ${inline ? '' : 'ds-body'} ${underline} ${forced}`}
    >
      {children}
    </a>
  );
}
