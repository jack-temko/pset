import { useSyncExternalStore } from 'react';

/** The tab being dragged, if any. A drag's data cannot be read until the drop,
 *  and a side must know on the way over, so the id is kept here. */
let current: string | null = null;
const EVENT = 'pset-tab-drag';

export const TAB_MIME = 'application/x-pset-tab';

export function startDrag(id: string, e: React.DragEvent) {
  e.dataTransfer.setData(TAB_MIME, id);
  e.dataTransfer.effectAllowed = 'move';
  current = id;
  window.dispatchEvent(new Event(EVENT));
}

export function endDrag() {
  current = null;
  window.dispatchEvent(new Event(EVENT));
}

export const draggedTab = () => current;

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener(EVENT, cb);
  };
};

/** The id of the tab being dragged anywhere on the page, or null. */
export function useDraggedTab() {
  return useSyncExternalStore(subscribe, draggedTab, () => null);
}
