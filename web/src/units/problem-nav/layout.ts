/** The four ways to move through the set: a bar of segments, plain numbers,
 *  a picker of titled problems, a titled list at the left. */
export type NavView = 'segments' | 'numbers' | 'picker' | 'list';

/** The list sits at the left of the pane, about 200 wide. */
export const LIST_WIDTH = 200;

/** Whether the view sits beside the problem rather than above it. */
export const beside = (view: NavView) => view === 'list';
