import { useContext, type ReactNode } from 'react';

import { Arriving, QuietSeen, useFirstOpen } from './arrival';

/** What a screen draws below its title. While the screen waits it is empty;
 *  when the data comes it fades in if the quiet form was seen, and its
 *  figures, bars and squares arrive if this is the screen's first open since
 *  PSet started (loading D3). The box is there either way, so nothing in it
 *  or around it is drawn again at the flip. */
export function Arrives({
  screen,
  ready,
  className,
  children,
}: {
  /** Which screen, for the first open. */
  screen: string;
  /** The data is in. */
  ready: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const first = useFirstOpen(screen, ready);
  const seen = useContext(QuietSeen);
  const fade = ready && seen ? 'ds-arrive' : '';
  return (
    <div className={`${className ?? ''} ${fade}`.trim() || undefined}>
      <Arriving.Provider value={ready && first}>{children}</Arriving.Provider>
    </div>
  );
}
