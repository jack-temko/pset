import { useState, type ComponentProps, type ReactNode } from 'react';

import { Tabs } from '@/units/tabs';
import { draggedTab, endDrag } from '@/units/tabs/drag';

/** One side of the workspace: a row of tabs over the open tab's pane. The
 *  tab row is drawn at once; the pane is whatever the caller gives, a pane or
 *  its skeleton, so a side loads on its own (side-d1). A tab dragged over the
 *  pane is dropped at the end of this side's tabs. */
export function Side({
  body,
  dropping,
  onDropTab,
  ...tabs
}: ComponentProps<typeof Tabs> & {
  body: ReactNode;
  /** Draws the drop look without a drag (the design page only). */
  dropping?: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <section aria-label={tabs.label} className="flex h-full min-w-0 flex-col">
      <Tabs {...tabs} onDropTab={onDropTab} />
      <div
        className={`relative min-h-0 flex-1 overflow-y-auto ${over || dropping ? 'outline-2 -outline-offset-2 outline-(--ds-accent)' : ''}`}
        onDragOver={(e) => {
          if (!draggedTab()) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setOver(false);
        }}
        onDrop={(e) => {
          const id = draggedTab();
          setOver(false);
          if (!id) return;
          e.preventDefault();
          onDropTab(id, null);
          endDrag();
        }}
      >
        {body}
      </div>
    </section>
  );
}
