/** Where the student was in each set (S8): the id of the current problem. */
export interface Memory {
  get: (setId: string) => string | undefined;
  set: (setId: string, problemId: string) => void;
}

/** A memory that lasts as long as the page. The workspace will swap in one
 *  that lasts across visits; the pane only asks. */
export function pageMemory(): Memory {
  const at = new Map<string, string>();
  return {
    get: (setId) => at.get(setId),
    set: (setId, problemId) => {
      at.set(setId, problemId);
    },
  };
}

/** The one the pane uses when it is given none. */
export const sessionMemory: Memory = pageMemory();

/** The key under which the memory notes whether the student was on the summary
 *  of a set (a place too, S8), beside the problem they were on. */
export const summaryKey = (setId: string) => `${setId}#summary`;
