/** Where the student was in a material (M8): the exact scroll spot, as how
 *  many pages have scrolled past the top (so it survives a resize), the zoom
 *  as a multiple of fit width, and the printed page it was reported on. */
export interface Place {
  at: number;
  zoom: number;
  page?: number;
}

/** Kept per tab, so a material open twice keeps two places. */
export interface Memory {
  get: (tabId: string) => Place | undefined;
  set: (tabId: string, place: Place) => void;
}

/** A memory that lasts as long as the page. The workspace will swap in one
 *  that lasts across visits; the pane only asks. */
export function pageMemory(): Memory {
  const at = new Map<string, Place>();
  return {
    get: (tabId) => at.get(tabId),
    set: (tabId, place) => {
      at.set(tabId, place);
    },
  };
}

/** The one the pane uses when it is given none. */
export const sessionMemory: Memory = pageMemory();
