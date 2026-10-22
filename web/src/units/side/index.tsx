import { useState, type ComponentProps, type ReactNode } from 'react';

import { Tabs } from '@/units/tabs';
import { draggedTab, endDrag } from '@/units/tabs/drag';

/** The one look of a drop target (side-d3): a translucent accent fill over the
 *  whole side, tab row and pane, with no outline, so nothing competes with the
 *  open tab's underline. A side and a folded side's half both use it. */
export function DropFill() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 bg-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)]"
    />
  );
}

/** One side of the workspace: a row of tabs over the open tab's pane. The
 *  tab row is drawn at once; the pane is whatever the caller gives, a pane or
 *  its skeleton, so a side loads on its own (side-d1). A tab from the other
 *  side dragged anywhere over it, row or pane, tints the whole side and lands
 *  at the end of its tabs (or before the tab it is dropped on). A tab of this
 *  side only shows an insertion bar in its row. */
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
  const foreign = (id: string | null) =>
    id !== null && !tabs.tabs.some((t) => t.id === id);
  return (
    <section
      aria-label={tabs.label}
      className="relative flex h-full min-w-0 flex-col"
      onDragOver={(e) => {
        if (!foreign(draggedTab())) return;
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
        if (!foreign(id) || id === null) return;
        e.preventDefault();
        onDropTab(id, null);
        endDrag();
      }}
    >
      <Tabs
        {...tabs}
        onDropTab={(id, before) => {
          setOver(false);
          onDropTab(id, before);
        }}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      {(over || dropping) && <DropFill />}
    </section>
  );
}
