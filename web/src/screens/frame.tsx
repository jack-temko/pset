import type { ReactNode } from 'react';

import '@/design/tokens.css';

/**
 * The page around every screen of the new design: the foundations' one
 * theme (`ds`, ideas/theme.md), filling the window. The old app's tokens
 * and theme stay with the old pages until the cut-over.
 */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="ds min-h-screen bg-(--ds-bg) text-(--ds-fg)">
      {children}
    </div>
  );
}
